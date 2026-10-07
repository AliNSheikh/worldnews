import crypto from 'crypto';
import { db } from '../server/db.js';
import { getPersistenceProvider } from '../server/persistence.js';
import {
  fetchAndParseRssFeed,
  generateNewsSitemapXml,
  generateRobotsTxt,
  generateRssXml,
  generateSitemapXml,
  runRssImportJob,
} from '../server/rss.js';
import { getCrawlerStatus, runCrawlerCycle } from '../server/crawler.js';

export const maxDuration = 60;

const adminCookieName = 'world_news_admin_session';
let fallbackAppPromise: Promise<any> | null = null;

function getAdminConfig() {
  const adminPassword = process.env.ADMIN_PASSWORD || '';
  const adminSessionSecret = process.env.ADMIN_SESSION_SECRET || adminPassword;
  return { adminPassword, adminSessionSecret };
}

function parseCookies(header = ''): Record<string, string> {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf('=');
        return idx >= 0
          ? [decodeURIComponent(part.slice(0, idx)), decodeURIComponent(part.slice(idx + 1))]
          : [decodeURIComponent(part), ''];
      })
  );
}

function signAdminSession(expiresAt: number, secret: string): string {
  const payload = String(expiresAt);
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function isValidAdminSession(token: string | undefined, secret: string): boolean {
  if (!token || !secret) return false;
  const [expiresRaw, signature] = token.split('.');
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || !signature) return false;

  const expected = crypto.createHmac('sha256', secret).update(expiresRaw).digest('base64url');
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return (
    expectedBuffer.length === signatureBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}

function isAdminRequest(req: any): boolean {
  const { adminSessionSecret } = getAdminConfig();
  const cookies = parseCookies(req.headers?.cookie || '');
  return isValidAdminSession(cookies[adminCookieName], adminSessionSecret);
}

function sendJson(res: any, statusCode: number, payload: unknown): void {
  if (res.headersSent) return;
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: any): Promise<Record<string, any>> {
  if (req.body && typeof req.body === 'object') return req.body as Record<string, any>;
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body) as Record<string, any>;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? (JSON.parse(raw) as Record<string, any>) : {};
}

function requireAdminOrReply(req: any, res: any): boolean {
  if (isAdminRequest(req)) return true;
  sendJson(res, 401, { error: 'Administrator authentication required.', code: 'ADMIN_REQUIRED' });
  return false;
}

function sourceIdFrom(pathname: string): string | null {
  const match = pathname.match(/^\/api\/sources\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function sourceActionFrom(pathname: string, action: 'test' | 'import'): string | null {
  const match = pathname.match(new RegExp(`^/api/sources/([^/]+)/${action}$`));
  return match ? decodeURIComponent(match[1]) : null;
}

function articleIdFrom(pathname: string): string | null {
  const match = pathname.match(/^\/api\/articles\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function articleActionFrom(pathname: string, action: 'view'): string | null {
  const match = pathname.match(new RegExp(`^/api/articles/([^/]+)/${action}$`));
  return match ? decodeURIComponent(match[1]) : null;
}

function categoryIdFrom(pathname: string): string | null {
  const match = pathname.match(/^\/api\/categories\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function commentStatusIdFrom(pathname: string): string | null {
  const match = pathname.match(/^\/api\/comments\/([^/]+)\/status$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getOrigin(req: any): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const proto = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = req.headers?.host || req.headers?.['x-forwarded-host'] || 'localhost:3000';
  return `${proto}://${host}`;
}

async function handleAdminAuth(req: any, res: any, pathname: string): Promise<boolean> {
  const { adminPassword, adminSessionSecret } = getAdminConfig();
  const method = String(req.method || 'GET').toUpperCase();

  if (pathname === '/api/admin/login' && method === 'POST') {
    if (!adminPassword || !adminSessionSecret) {
      sendJson(res, 503, {
        error: 'Admin authentication is not configured. Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET in Vercel.',
        code: 'ADMIN_AUTH_NOT_CONFIGURED',
      });
      return true;
    }

    let body: Record<string, any>;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON request body.', code: 'INVALID_JSON' });
      return true;
    }

    const submitted = String(body.password || '');
    const submittedBuffer = Buffer.from(submitted);
    const passwordBuffer = Buffer.from(adminPassword);
    const valid =
      submittedBuffer.length === passwordBuffer.length &&
      crypto.timingSafeEqual(submittedBuffer, passwordBuffer);

    if (!valid) {
      sendJson(res, 401, { error: 'Invalid administrator credentials.', code: 'INVALID_CREDENTIALS' });
      return true;
    }

    const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
    const secure = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL) ? '; Secure' : '';
    res.setHeader(
      'Set-Cookie',
      `${adminCookieName}=${encodeURIComponent(signAdminSession(expiresAt, adminSessionSecret))}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`
    );
    sendJson(res, 200, { success: true, expiresAt: new Date(expiresAt).toISOString() });
    return true;
  }

  if (pathname === '/api/admin/session' && method === 'GET') {
    sendJson(res, 200, { authenticated: isAdminRequest(req) });
    return true;
  }

  if (pathname === '/api/admin/logout' && method === 'POST') {
    const secure = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL) ? '; Secure' : '';
    res.setHeader(
      'Set-Cookie',
      `${adminCookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`
    );
    sendJson(res, 200, { success: true });
    return true;
  }

  return false;
}

async function handleCoreRoutes(req: any, res: any, pathname: string): Promise<boolean> {
  const method = String(req.method || 'GET').toUpperCase();

  if (pathname === '/api/health' && method === 'GET') {
    await db.ready();
    sendJson(res, db.persistenceError ? 503 : 200, {
      status: db.persistenceError ? 'degraded' : 'healthy',
      time: new Date().toISOString(),
      articlesCount: db.articles.length,
      categoriesCount: db.categories.length,
      sourcesCount: db.sources.length,
      persistence: db.getPersistenceStatus(),
      persistenceProvider: getPersistenceProvider(),
      appwriteApiKeyConfigured: Boolean(process.env.APPWRITE_API_KEY),
      geminiApiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
    return true;
  }

  if (pathname === '/sitemap.xml' && method === 'GET') {
    await db.refresh(0);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.end(generateSitemapXml(getOrigin(req)));
    return true;
  }

  if (pathname === '/news-sitemap.xml' && method === 'GET') {
    await db.refresh(0);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.end(generateNewsSitemapXml(getOrigin(req)));
    return true;
  }

  if (pathname === '/rss.xml' && method === 'GET') {
    await db.refresh(0);
    const url = new URL(req.url || '/', 'http://localhost');
    const lang = url.searchParams.get('lang') || 'en';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.end(generateRssXml(getOrigin(req), lang as any));
    return true;
  }

  if (pathname === '/robots.txt' && method === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(generateRobotsTxt(getOrigin(req)));
    return true;
  }

  if (pathname === '/api/articles' && method === 'GET') {
    await db.refresh(0);
    const url = new URL(req.url || '/', 'http://localhost');
    const limitParam = Number(url.searchParams.get('limit') || 0);
    const offsetParam = Number(url.searchParams.get('offset') || 0);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    sendJson(res, 200, db.getArticles({
      category: url.searchParams.get('category') || undefined,
      status: url.searchParams.get('status') || undefined,
      search: url.searchParams.get('search') || undefined,
      limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined,
      offset: Number.isFinite(offsetParam) && offsetParam > 0 ? offsetParam : undefined,
    }));
    return true;
  }

  if (pathname === '/api/articles' && method === 'POST') {
    if (!requireAdminOrReply(req, res)) return true;
    await db.refresh(0);
    try {
      const created = db.createArticle(await readJsonBody(req));
      await db.flush();
      sendJson(res, 201, created);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 400, { error: message, code: 'ARTICLE_CREATE_FAILED' });
    }
    return true;
  }

  const viewArticleId = articleActionFrom(pathname, 'view');
  if (viewArticleId && method === 'POST') {
    await db.refresh(0);
    sendJson(res, 200, { views: db.incrementViews(viewArticleId) });
    return true;
  }

  const articleId = articleIdFrom(pathname);
  if (articleId && method === 'GET') {
    await db.refresh(0);
    const article = db.getArticleById(articleId) || db.getArticleBySlug(articleId);
    sendJson(res, article ? 200 : 404, article || { error: 'Article not found.' });
    return true;
  }

  if (articleId && method === 'PUT') {
    if (!requireAdminOrReply(req, res)) return true;
    await db.refresh(0);
    try {
      const updated = db.updateArticle(articleId, await readJsonBody(req));
      await db.flush();
      sendJson(res, 200, updated);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 404, { error: message, code: 'ARTICLE_UPDATE_FAILED' });
    }
    return true;
  }

  if (articleId && method === 'DELETE') {
    if (!requireAdminOrReply(req, res)) return true;
    await db.refresh(0);
    const deleted = db.deleteArticle(articleId);
    if (!deleted) {
      sendJson(res, 404, { error: 'Article not found.' });
      return true;
    }
    await db.flush();
    sendJson(res, 200, { success: true });
    return true;
  }

  if (pathname === '/api/categories' && method === 'GET') {
    await db.refresh(0);
    sendJson(res, 200, db.getCategories());
    return true;
  }

  const categoryId = categoryIdFrom(pathname);
  if (categoryId && method === 'PUT') {
    if (!requireAdminOrReply(req, res)) return true;
    await db.refresh(0);
    try {
      const updated = db.updateCategory(categoryId, await readJsonBody(req));
      await db.flush();
      sendJson(res, 200, updated);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 404, { error: message, code: 'CATEGORY_UPDATE_FAILED' });
    }
    return true;
  }

  if (pathname === '/api/sources' && method === 'GET') {
    await db.refresh(0);
    sendJson(res, 200, db.getSources());
    return true;
  }

  if (pathname === '/api/sources' && method === 'POST') {
    if (!requireAdminOrReply(req, res)) return true;
    await db.refresh(0);
    try {
      const body = await readJsonBody(req);
      const name = String(body.name || '').trim();
      const rssUrl = String(body.rssUrl || '').trim();
      if (!name || !/^https?:\/\//i.test(rssUrl)) {
        sendJson(res, 400, { error: 'Source name and a valid HTTP(S) RSS URL are required.' });
        return true;
      }
      const created = db.addSource({
        ...body,
        name,
        rssUrl,
        category: String(body.category || 'world'),
        defaultLanguage: body.defaultLanguage || body.language || 'en',
        language: body.language || body.defaultLanguage || 'en',
        trustLevel: body.trustLevel || 'verified',
        isActive: body.isActive !== false,
        lastImport: body.lastImport || null,
        lastError: body.lastError || null,
        importFrequency: body.importFrequency || `Every ${Number(body.fetchIntervalMinutes || 60)} minutes`,
        fetchIntervalMinutes: Math.max(5, Number(body.fetchIntervalMinutes || 60)),
        articlesCount: Number(body.articlesCount || 0),
      } as any);
      await db.flush();
      sendJson(res, 201, created);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 503, { error: message, code: 'SOURCE_CREATE_FAILED' });
    }
    return true;
  }

  const sourceId = sourceIdFrom(pathname);
  if (sourceId && method === 'PUT') {
    if (!requireAdminOrReply(req, res)) return true;
    await db.refresh(0);
    try {
      const updated = db.updateSource(sourceId, await readJsonBody(req));
      await db.flush();
      sendJson(res, 200, updated);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, message.includes('not found') ? 404 : 503, { error: message, code: 'SOURCE_UPDATE_FAILED' });
    }
    return true;
  }

  if (sourceId && method === 'DELETE') {
    if (!requireAdminOrReply(req, res)) return true;
    await db.refresh(0);
    try {
      const deleted = db.deleteSource(sourceId);
      if (!deleted) {
        sendJson(res, 404, { error: 'Source not found.' });
        return true;
      }
      await db.flush();
      sendJson(res, 200, { success: true, id: sourceId });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 503, { error: message, code: 'SOURCE_DELETE_FAILED' });
    }
    return true;
  }

  const testSourceId = sourceActionFrom(pathname, 'test');
  if (testSourceId && method === 'POST') {
    if (!requireAdminOrReply(req, res)) return true;
    await db.refresh(0);
    const source = db.getSources().find((item) => item.id === testSourceId);
    if (!source) {
      sendJson(res, 404, { error: 'Source not found.' });
      return true;
    }
    const started = Date.now();
    const items = await fetchAndParseRssFeed(source.rssUrl, 10000);
    sendJson(res, items.length ? 200 : 422, {
      success: items.length > 0,
      parsedItems: items.length,
      responseTimeMs: Date.now() - started,
      sample: items.slice(0, 3),
      message: items.length
        ? `Connected to '${source.name}' and parsed ${items.length} feed items.`
        : `No valid RSS/Atom items could be parsed from '${source.name}'.`,
    });
    return true;
  }

  const importSourceId = sourceActionFrom(pathname, 'import');
  if (importSourceId && method === 'POST') {
    if (!requireAdminOrReply(req, res)) return true;
    await db.refresh(0);
    try {
      const result = await runRssImportJob(importSourceId);
      await db.flush();
      sendJson(res, result.success ? 200 : 422, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 500, { success: false, error: message, code: 'SOURCE_IMPORT_FAILED' });
    }
    return true;
  }

  if (pathname === '/api/comments' && method === 'GET') {
    await db.refresh(0);
    const url = new URL(req.url || '/', 'http://localhost');
    sendJson(res, 200, db.getComments(
      url.searchParams.get('articleId') || undefined,
      url.searchParams.get('status') || undefined
    ));
    return true;
  }

  if (pathname === '/api/comments' && method === 'POST') {
    await db.refresh(0);
    try {
      const clientIp = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1');
      const created = db.addComment(await readJsonBody(req) as any, clientIp);
      await db.flush();
      sendJson(res, 201, created);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 429, { error: message, code: 'COMMENT_CREATE_FAILED' });
    }
    return true;
  }

  const commentId = commentStatusIdFrom(pathname);
  if (commentId && method === 'PUT') {
    if (!requireAdminOrReply(req, res)) return true;
    await db.refresh(0);
    try {
      const body = await readJsonBody(req);
      const updated = db.updateCommentStatus(commentId, body.status);
      await db.flush();
      sendJson(res, 200, updated);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 404, { error: message, code: 'COMMENT_UPDATE_FAILED' });
    }
    return true;
  }

  if (pathname === '/api/settings' && method === 'GET') {
    await db.refresh(0);
    sendJson(res, 200, db.getSettings());
    return true;
  }

  if (pathname === '/api/settings' && method === 'PUT') {
    if (!requireAdminOrReply(req, res)) return true;
    await db.refresh(0);
    const updated = db.updateSettings(await readJsonBody(req));
    await db.flush();
    sendJson(res, 200, updated);
    return true;
  }

  if (pathname === '/api/logs' && method === 'GET') {
    await db.refresh(0);
    sendJson(res, 200, db.getLogs());
    return true;
  }

  if (pathname === '/api/admin/persistence/sync' && method === 'POST') {
    if (!requireAdminOrReply(req, res)) return true;
    await db.ready();
    try {
      const result = await db.syncAllToPersistence();
      sendJson(res, 200, { success: true, ...result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 503, { success: false, error: message, persistence: db.getPersistenceStatus() });
    }
    return true;
  }

  if (pathname === '/api/crawler/status' && method === 'GET') {
    await db.ready();
    sendJson(res, 200, getCrawlerStatus());
    return true;
  }

  if ((pathname === '/api/crawler/run-now' || pathname === '/api/automation/run') && method === 'POST') {
    if (!requireAdminOrReply(req, res)) return true;
    await db.refresh(0);
    const result = pathname === '/api/automation/run'
      ? await runRssImportJob()
      : await runCrawlerCycle();
    await db.flush();
    sendJson(res, result.success ? 200 : 422, result);
    return true;
  }

  if (pathname === '/api/cron/hourly' && method === 'GET') {
    const cronSecret = process.env.CRON_SECRET || '';
    if (!cronSecret || req.headers?.authorization !== `Bearer ${cronSecret}`) {
      sendJson(res, cronSecret ? 401 : 503, {
        error: cronSecret ? 'Unauthorized cron request.' : 'CRON_SECRET is not configured.',
      });
      return true;
    }
    await db.refresh(0);
    const result = await runCrawlerCycle();
    await db.flush();
    sendJson(res, result.success ? 200 : 422, { ...result, ranAt: new Date().toISOString() });
    return true;
  }

  return false;
}

async function getFallbackApp() {
  if (!fallbackAppPromise) {
    fallbackAppPromise = import('../server/app.js')
      .then(({ createApp }) => createApp({ serveFrontend: false }))
      .catch((error) => {
        fallbackAppPromise = null;
        throw error;
      });
  }
  return fallbackAppPromise;
}

export default async function handler(req: any, res: any) {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;

  try {
    if (await handleAdminAuth(req, res, pathname)) return;
    if (await handleCoreRoutes(req, res, pathname)) return;

    // Less-common legacy endpoints remain available behind a lazy fallback. If a
    // legacy module fails, core login/database/crawler routes above stay healthy.
    const app = await getFallbackApp();
    return app(req, res);
  } catch (error: unknown) {
    console.error('[World News API] Request failed:', error);
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, {
      error: 'The newsroom API request failed.',
      code: 'API_RUNTIME_FAILED',
      detail: message,
    });
  }
}

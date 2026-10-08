import crypto from 'crypto';
import { db } from '../server/db';
import { fetchAndParseRssFeed, runRssImportJob } from '../server/rss';
import { getCrawlerStatus, runCrawlerCycle } from '../server/crawler';
import { getPersistenceProvider } from '../server/persistence';

export const maxDuration = 60;
const COOKIE = 'world_news_admin_session';

function json(res: any, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function cookieMap(header = ''): Record<string, string> {
  return Object.fromEntries(
    header
      .split(';')
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => {
        const i = v.indexOf('=');
        return i >= 0
          ? [decodeURIComponent(v.slice(0, i)), decodeURIComponent(v.slice(i + 1))]
          : [v, ''];
      })
  );
}

function isAdmin(req: any): boolean {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
  const token = cookieMap(req.headers?.cookie || '')[COOKIE];
  if (!secret || !token) return false;
  const [expiresRaw, signature] = token.split('.');
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires <= Date.now() || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(expiresRaw).digest('base64url');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isCron(req: any): boolean {
  const secret = String(process.env.CRON_SECRET || '');
  return Boolean(secret && req.headers?.authorization === `Bearer ${secret}`);
}

function statusPayload() {
  const crawler = getCrawlerStatus();
  const logs = db.getLogs();
  const latest = logs[0] || null;
  return {
    status: db.persistenceError ? 'degraded' : 'healthy',
    ...crawler,
    persistenceProvider: getPersistenceProvider(),
    tursoDatabaseUrlConfigured: Boolean(process.env.TURSO_DATABASE_URL),
    tursoAuthTokenConfigured: Boolean(process.env.TURSO_AUTH_TOKEN || process.env.TURSO_DATABASE_AUTH_TOKEN),
    totalArticlesIngested: db.articles.length,
    lastImportedCount: latest?.importedCount || 0,
    lastRunStatus: latest?.status || null,
    translationProviderConfigured: false,
    enabledLanguages: ['en'],
    recentLogs: logs.slice(0, 12).map((log) => ({
      timestamp: log.completedAt || log.startedAt,
      message:
        log.errorMessage ||
        `${log.source}: ${log.importedCount} article(s) imported (${log.status}).`,
      articlesAdded: log.importedCount,
      status: log.status,
    })),
  };
}

export default async function handler(req: any, res: any) {
  try {
    const url = new URL(req.url || '/', 'https://local');
    const action = String(url.searchParams.get('action') || 'status');
    const sourceId = String(url.searchParams.get('id') || '');
    const method = String(req.method || 'GET').toUpperCase();

    await db.refresh(action === 'status' ? 15000 : 5000);

    if (action === 'status') {
      return json(res, 200, statusPayload());
    }

    if (action === 'cron') {
      if (!isCron(req)) {
        return json(res, process.env.CRON_SECRET ? 401 : 503, {
          error: process.env.CRON_SECRET ? 'Unauthorized cron request.' : 'CRON_SECRET is not configured.',
        });
      }
      const result = await runCrawlerCycle();
      await db.flush();
      return json(res, 200, { ...result, hasMore: false, ranAt: new Date().toISOString() });
    }

    if (method !== 'POST' || !isAdmin(req)) {
      return json(res, 401, { error: 'Administrator authentication required.' });
    }

    if (action === 'translate') {
      return json(res, 200, {
        success: true,
        translatedArticles: 0,
        remaining: 0,
        message: 'English-only mode is enabled. Translation jobs are disabled.',
      });
    }

    if (action === 'test') {
      const source = db.getSources().find((item) => item.id === sourceId);
      if (!source) return json(res, 404, { error: 'Source not found.' });
      const started = Date.now();
      const items = await fetchAndParseRssFeed(source.rssUrl, 10000);
      return json(res, items.length ? 200 : 422, {
        success: items.length > 0,
        status: items.length ? 'active' : 'empty',
        responseTimeMs: Date.now() - started,
        parsedItems: items.length,
        sample: items.slice(0, 3),
        message: items.length
          ? `Connected to '${source.name}' and parsed ${items.length} feed items.`
          : `No RSS/Atom items could be parsed from '${source.name}'.`,
      });
    }

    if (action === 'import') {
      if (!sourceId) return json(res, 400, { error: 'Source id is required.' });
      const result = await runRssImportJob(sourceId);
      await db.flush();
      return json(res, 200, {
        ...result,
        newArticlesCount: result.count,
        persisted: result.count,
        hasMore: false,
      });
    }

    if (action === 'run') {
      const result = await runCrawlerCycle();
      await db.flush();
      return json(res, 200, { ...result, count: result.newArticlesCount, hasMore: false });
    }

    return json(res, 404, { error: 'Unknown crawler action.' });
  } catch (error: any) {
    console.error('[direct-crawler]', error);
    return json(res, 503, {
      success: false,
      error: error?.message || String(error),
      code: 'DIRECT_TURSO_CRAWLER_FAILED',
    });
  }
}

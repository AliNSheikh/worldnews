import crypto from 'crypto';

export const maxDuration = 60;

const adminCookieName = 'world_news_admin_session';
let appPromise: Promise<any> | null = null;

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

async function readJsonBody(req: any): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') return req.body as Record<string, unknown>;
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body) as Record<string, unknown>;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
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

    let body: Record<string, unknown>;
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

async function handleDirectRuntimeRoutes(req: any, res: any, pathname: string): Promise<boolean> {
  const method = String(req.method || 'GET').toUpperCase();

  if (pathname === '/api/health' && method === 'GET') {
    const [{ db }, persistenceModule] = await Promise.all([
      import('../server/db'),
      import('../server/persistence'),
    ]);
    await db.ready();

    sendJson(res, 200, {
      status: db.persistenceError ? 'degraded' : 'healthy',
      time: new Date().toISOString(),
      articlesCount: db.articles.length,
      categoriesCount: db.categories.length,
      sourcesCount: db.sources.length,
      persistence: db.getPersistenceStatus(),
      appwriteApiKeyConfigured: Boolean(process.env.APPWRITE_API_KEY),
      geminiApiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
      persistenceProvider: persistenceModule.getPersistenceProvider(),
    });
    return true;
  }

  if (pathname === '/api/admin/persistence/sync' && method === 'POST') {
    if (!isAdminRequest(req)) {
      sendJson(res, 401, { error: 'Administrator authentication required.' });
      return true;
    }

    const { db } = await import('../server/db');
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
    const [{ db }, { getCrawlerStatus }] = await Promise.all([
      import('../server/db'),
      import('../server/crawler'),
    ]);
    await db.ready();
    sendJson(res, 200, getCrawlerStatus());
    return true;
  }

  if ((pathname === '/api/crawler/run-now' || pathname === '/api/automation/run') && method === 'POST') {
    if (!isAdminRequest(req)) {
      sendJson(res, 401, { error: 'Administrator authentication required.' });
      return true;
    }

    const [{ db }, { runCrawlerCycle }] = await Promise.all([
      import('../server/db'),
      import('../server/crawler'),
    ]);
    await db.ready();
    const result = await runCrawlerCycle();
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

    const [{ db }, { runCrawlerCycle }] = await Promise.all([
      import('../server/db'),
      import('../server/crawler'),
    ]);
    await db.ready();
    const result = await runCrawlerCycle();
    sendJson(res, result.success ? 200 : 422, { ...result, ranAt: new Date().toISOString() });
    return true;
  }

  return false;
}

async function getApp() {
  if (!appPromise) {
    appPromise = import('../server/app').then(({ createApp }) => createApp({ serveFrontend: false }));
  }
  return appPromise;
}

export default async function handler(req: any, res: any) {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;

  try {
    if (await handleAdminAuth(req, res, pathname)) return;
    if (await handleDirectRuntimeRoutes(req, res, pathname)) return;

    const app = await getApp();
    return app(req, res);
  } catch (error) {
    console.error('[World News API] Function invocation failed:', error);
    appPromise = null;

    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, {
      error: 'The newsroom API failed to initialize or execute.',
      code: 'API_RUNTIME_FAILED',
      detail: message,
    });
  }
}

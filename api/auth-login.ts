import { createHmac, timingSafeEqual } from 'node:crypto';

export const maxDuration = 10;

const COOKIE_NAME = 'world_news_admin_session';

function sendJson(res: any, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

async function readBody(req: any): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) return JSON.parse(req.body);
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

function sign(expiresAt: number, secret: string) {
  const payload = String(expiresAt);
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export default async function handler(req: any, res: any) {
  if (String(req.method || '').toUpperCase() !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  const adminPassword = process.env.ADMIN_PASSWORD || '';
  const sessionSecret = process.env.ADMIN_SESSION_SECRET || adminPassword;
  if (!adminPassword || !sessionSecret) {
    return sendJson(res, 503, {
      error: 'Admin authentication is not configured. Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET in Vercel.',
      code: 'ADMIN_AUTH_NOT_CONFIGURED',
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await readBody(req);
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON request body.', code: 'INVALID_JSON' });
  }

  const submitted = Buffer.from(String(body.password || ''));
  const expected = Buffer.from(adminPassword);
  const valid = submitted.length === expected.length && timingSafeEqual(submitted, expected);
  if (!valid) {
    return sendJson(res, 401, { error: 'Invalid administrator credentials.', code: 'INVALID_CREDENTIALS' });
  }

  const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
  const secure = process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(sign(expiresAt, sessionSecret))}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`
  );
  return sendJson(res, 200, { success: true, expiresAt: new Date(expiresAt).toISOString() });
}

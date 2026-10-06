import { createHmac, timingSafeEqual } from 'node:crypto';

export const maxDuration = 10;

const COOKIE_NAME = 'world_news_admin_session';

function sendJson(res: any, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function parseCookies(header = ''): Record<string, string> {
  return Object.fromEntries(header.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const idx = part.indexOf('=');
    return idx >= 0
      ? [decodeURIComponent(part.slice(0, idx)), decodeURIComponent(part.slice(idx + 1))]
      : [decodeURIComponent(part), ''];
  }));
}

function validSession(token: string | undefined, secret: string): boolean {
  if (!token || !secret) return false;
  const [expiresRaw, signature] = token.split('.');
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || !signature) return false;
  const expected = createHmac('sha256', secret).update(expiresRaw).digest('base64url');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req: any, res: any) {
  if (String(req.method || '').toUpperCase() !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }
  const adminPassword = process.env.ADMIN_PASSWORD || '';
  const secret = process.env.ADMIN_SESSION_SECRET || adminPassword;
  const cookies = parseCookies(req.headers?.cookie || '');
  return sendJson(res, 200, { authenticated: validSession(cookies[COOKIE_NAME], secret) });
}

import crypto from 'crypto';
import Parser from 'rss-parser';
import { createClient } from '@libsql/client';

export const maxDuration = 30;
const COOKIE = 'world_news_admin_session';

function clean(value: string | undefined): string {
  return String(value || '').trim().replace(/^['"]+|['"]+$/g, '');
}

function json(res: any, status: number, value: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(JSON.stringify(value));
}

function cookieMap(header = ''): Record<string, string> {
  return Object.fromEntries(
    header
      .split(';')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => {
        const index = value.indexOf('=');
        return index >= 0
          ? [decodeURIComponent(value.slice(0, index)), decodeURIComponent(value.slice(index + 1))]
          : [value, ''];
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

function parsePayload(value: unknown): any {
  if (value && typeof value === 'object') return value;
  return JSON.parse(String(value || '{}'));
}

export default async function handler(req: any, res: any) {
  let stage = 'request-init';
  try {
    if (String(req.method || 'GET').toUpperCase() !== 'POST' || !isAdmin(req)) {
      return json(res, 401, { error: 'Administrator authentication required.' });
    }

    const url = new URL(req.url || '/', 'https://local');
    const sourceId = String(url.searchParams.get('id') || '');
    if (!sourceId) return json(res, 400, { error: 'Source id is required.' });

    stage = 'connect-turso';
    const databaseUrl = clean(process.env.TURSO_DATABASE_URL);
    const authToken = clean(process.env.TURSO_AUTH_TOKEN || process.env.TURSO_DATABASE_AUTH_TOKEN);
    if (!databaseUrl || !authToken) {
      throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required.');
    }
    const db = createClient({ url: databaseUrl, authToken });

    stage = 'read-source';
    const sourceResult = await db.execute({
      sql: 'SELECT payload FROM newsroom_sources WHERE id = ? LIMIT 1',
      args: [sourceId],
    });
    if (!sourceResult.rows.length) return json(res, 404, { error: 'Source not found.' });
    const source = parsePayload(sourceResult.rows[0].payload);

    stage = 'fetch-rss';
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(String(source.rssUrl || ''), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsDiscover/1.0; +https://www.newsdiscover.org)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      return json(res, 422, {
        success: false,
        status: 'error',
        responseTimeMs: Date.now() - started,
        parsedItems: 0,
        message: 'Feed returned HTTP ' + response.status + '.',
      });
    }

    const xml = await response.text();
    stage = 'parse-rss';
    const parser = new Parser();
    const feed = await parser.parseString(xml);
    const items = Array.isArray(feed.items) ? feed.items : [];

    return json(res, items.length ? 200 : 422, {
      success: items.length > 0,
      status: items.length ? 'active' : 'empty',
      responseTimeMs: Date.now() - started,
      parsedItems: items.length,
      sample: items.slice(0, 3).map((item: any) => ({
        title: item.title || '',
        link: item.link || '',
        pubDate: item.pubDate || item.isoDate || '',
        description: item.contentSnippet || item.content || item.summary || '',
      })),
      message: items.length
        ? 'Connected to “' + String(source.name || sourceId) + '” and parsed ' + items.length + ' feed item(s).'
        : 'The feed responded, but no RSS/Atom items were parsed.',
    });
  } catch (error: any) {
    console.error('[direct-source-test]', stage, error);
    return json(res, 503, {
      code: 'DIRECT_SOURCE_TEST_FAILED',
      stage,
      error: {
        name: error?.name || 'Error',
        message: error?.message || String(error),
      },
    });
  }
}

import crypto from 'crypto';

export const maxDuration = 30;

const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/indexing';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_PUBLISH_URL = 'https://indexing.googleapis.com/v3/urlNotifications:publish';
const INDEXNOW_URL = 'https://api.indexnow.org/indexnow';
const INDEXNOW_KEY = '37889c93b7a4871999be40b8144667bc';

function clean(value: string | undefined): string {
  return String(value || '').trim().replace(/^['"]+|['"]+$/g, '');
}

function json(res: any, status: number, value: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(JSON.stringify(value));
}

async function requestText(req: any): Promise<string> {
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function secret(): string {
  return String(process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || '');
}

function verifySignature(rawBody: string, provided: string): boolean {
  const key = secret();
  if (!key || !provided) return false;
  const expected = crypto.createHmac('sha256', key).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(provided));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function privateKeyFromEnv(): string {
  return clean(process.env.GOOGLE_INDEXING_PRIVATE_KEY)
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n');
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function uniqueUrls(values: unknown): string[] {
  const urls = Array.isArray(values) ? values : [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of urls) {
    try {
      const url = new URL(String(raw || '').trim());
      if (!['http:', 'https:'].includes(url.protocol)) continue;
      url.hash = '';
      const normalized = url.toString();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(normalized);
    } catch {}
  }
  return result;
}

async function googleAccessToken() {
  const clientEmail = clean(process.env.GOOGLE_INDEXING_CLIENT_EMAIL);
  const privateKey = privateKeyFromEnv();
  if (!clientEmail || !privateKey) {
    throw new Error('GOOGLE_INDEXING_CLIENT_EMAIL or GOOGLE_INDEXING_PRIVATE_KEY is not configured.');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({
    iss: clientEmail,
    scope: GOOGLE_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })).toString('base64url');
  const unsigned = header + '.' + claims;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url');

  const response = await fetchWithTimeout(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth-type:jwt-bearer',
      assertion: unsigned + '.' + signature,
    }).toString(),
  }, 12000);

  const payload: any = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token) {
    throw new Error(
      'Google OAuth HTTP ' + response.status + ': ' +
      JSON.stringify(payload || { error: 'Unable to obtain access token.' })
    );
  }
  return String(payload.access_token);
}

async function submitGoogle(urls: string[]) {
  try {
    const token = await googleAccessToken();
    let submitted = 0;
    const errors: string[] = [];
    const queue = [...urls];
    const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (queue.length) {
        const url = queue.shift();
        if (!url) return;
        try {
          const response = await fetchWithTimeout(GOOGLE_PUBLISH_URL, {
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url, type: 'URL_UPDATED' }),
          }, 10000);
          if (response.status === 200) {
            submitted += 1;
          } else {
            const body = (await response.text()).slice(0, 600);
            errors.push(url + ': HTTP ' + response.status + ' ' + body);
          }
        } catch (error: any) {
          errors.push(url + ': ' + (error?.message || String(error)));
        }
      }
    });
    await Promise.all(workers);
    return {
      service: 'google',
      ok: errors.length === 0,
      submitted,
      errors,
    };
  } catch (error: any) {
    return {
      service: 'google',
      ok: false,
      submitted: 0,
      errors: [error?.message || String(error)],
    };
  }
}

async function submitIndexNow(urls: string[]) {
  const groups = new Map<string, string[]>();
  for (const raw of urls) {
    try {
      const url = new URL(raw);
      const list = groups.get(url.origin) || [];
      list.push(url.toString());
      groups.set(url.origin, list);
    } catch {}
  }

  let submitted = 0;
  const errors: string[] = [];
  for (const [origin, urlList] of groups) {
    const host = new URL(origin).host;
    try {
      const response = await fetchWithTimeout(INDEXNOW_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host,
          key: INDEXNOW_KEY,
          keyLocation: origin + '/' + INDEXNOW_KEY + '.txt',
          urlList,
        }),
      }, 12000);
      if (response.ok || response.status === 202) {
        submitted += urlList.length;
      } else {
        errors.push(origin + ': HTTP ' + response.status + ' ' + (await response.text()).slice(0, 600));
      }
    } catch (error: any) {
      errors.push(origin + ': ' + (error?.message || String(error)));
    }
  }

  return {
    service: 'indexnow',
    ok: errors.length === 0,
    submitted,
    errors,
  };
}

export default async function handler(req: any, res: any) {
  if (String(req.method || 'GET').toUpperCase() !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed.' });
  }

  const rawBody = await requestText(req);
  if (!verifySignature(rawBody, String(req.headers?.['x-newsdiscover-indexing-signature'] || ''))) {
    return json(res, 401, { error: 'Unauthorized indexing request.' });
  }

  let body: any = {};
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return json(res, 400, { error: 'Invalid JSON body.' });
  }

  const urls = uniqueUrls(body.urls);
  if (!urls.length) {
    return json(res, 400, { error: 'No valid URLs supplied.' });
  }

  const [google, indexNow] = await Promise.all([
    submitGoogle(urls),
    submitIndexNow(urls),
  ]);

  return json(res, 200, {
    success: google.ok || indexNow.ok,
    urls,
    results: [google, indexNow],
    completedAt: new Date().toISOString(),
  });
}

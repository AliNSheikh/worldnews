import crypto from 'crypto';
export const maxDuration = 30;

const COOKIE = 'world_news_admin_session';
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/indexing';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_PUBLISH_URL = 'https://indexing.googleapis.com/v3/urlNotifications:publish';
const INDEXNOW_KEY = '37889c93b7a4871999be40b8144667bc';

let githubJwksCache: { expiresAt: number; keys: any[] } = {
  expiresAt: 0,
  keys: [],
};

function clean(value: string | undefined): string {
  return String(value || '').trim().replace(/^['"]+|['"]+$/g, '');
}

function sendJson(res: any, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(JSON.stringify(payload, null, 2));
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

function decodeJwtPart(value: string): any {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

async function verifyGitHubDiagnosticOidc(req: any): Promise<boolean> {
  if (String(req.headers?.['x-newsdiscover-indexing-test'] || '') !== 'github-actions') {
    return false;
  }

  const authorization = String(req.headers?.authorization || '');
  if (!authorization.startsWith('Bearer ')) return false;

  const token = authorization.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  try {
    const header = decodeJwtPart(parts[0]);
    const claims = decodeJwtPart(parts[1]);
    const now = Math.floor(Date.now() / 1000);

    if (header.alg !== 'RS256' || !header.kid) return false;
    if (claims.iss !== 'https://token.actions.githubusercontent.com') return false;

    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audience.includes('newsdiscover.org')) return false;
    if (claims.repository !== 'AliNSheikh/worldnews') return false;
    if (claims.ref !== 'refs/heads/main') return false;
    if (!['push', 'workflow_dispatch'].includes(String(claims.event_name || ''))) return false;

    const expectedWorkflowRef =
      'AliNSheikh/worldnews/.github/workflows/indexing-diagnostic.yml@refs/heads/main';
    if (claims.workflow_ref !== expectedWorkflowRef) return false;

    if (typeof claims.exp !== 'number' || claims.exp <= now) return false;
    if (typeof claims.nbf === 'number' && claims.nbf > now + 30) return false;

    if (githubJwksCache.expiresAt <= Date.now() || !githubJwksCache.keys.length) {
      const response = await fetch(
        'https://token.actions.githubusercontent.com/.well-known/jwks',
        { headers: { Accept: 'application/json' } }
      );
      if (!response.ok) return false;
      const jwks: any = await response.json();
      githubJwksCache = {
        expiresAt: Date.now() + 60 * 60 * 1000,
        keys: Array.isArray(jwks.keys) ? jwks.keys : [],
      };
    }

    const jwk = githubJwksCache.keys.find((key: any) => key.kid === header.kid);
    if (!jwk) return false;

    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    return crypto.verify(
      'RSA-SHA256',
      Buffer.from(parts[0] + '.' + parts[1]),
      publicKey,
      Buffer.from(parts[2], 'base64url')
    );
  } catch {
    return false;
  }
}

async function isAuthorized(req: any): Promise<boolean> {
  if (isAdmin(req)) return true;
  return verifyGitHubDiagnosticOidc(req);
}

function privateKeyFromEnv(): string {
  return clean(process.env.GOOGLE_INDEXING_PRIVATE_KEY)
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n');
}

function targetUrlFromRequest(req: any): string {
  const configured = clean(process.env.APP_URL).replace(/\/$/, '');
  const origin = /^https?:\/\//i.test(configured)
    ? configured
    : 'https://www.newsdiscover.org';

  const requestUrl = new URL(req.url || '/', 'https://local');
  const requested = String(requestUrl.searchParams.get('url') || '').trim();
  if (!requested) return origin + '/';

  const candidate = new URL(requested);
  if (candidate.origin !== new URL(origin).origin) {
    throw new Error('Diagnostic URL must use the configured site origin.');
  }
  candidate.hash = '';
  return candidate.toString();
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs = 12000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function googleAccessToken(): Promise<{
  accessToken?: string;
  status: number;
  response: any;
}> {
  const clientEmail = clean(process.env.GOOGLE_INDEXING_CLIENT_EMAIL);
  const privateKey = privateKeyFromEnv();

  if (!clientEmail || !privateKey) {
    return {
      status: 0,
      response: {
        error: 'GOOGLE_INDEXING_CLIENT_EMAIL or GOOGLE_INDEXING_PRIVATE_KEY is not configured.',
      },
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT' })
  ).toString('base64url');
  const claims = Buffer.from(
    JSON.stringify({
      iss: clientEmail,
      scope: GOOGLE_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  ).toString('base64url');
  const unsigned = header + '.' + claims;
  const signature = crypto
    .sign('RSA-SHA256', Buffer.from(unsigned), privateKey)
    .toString('base64url');

  const response = await fetchWithTimeout(
    GOOGLE_TOKEN_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: unsigned + '.' + signature,
      }).toString(),
    }
  );

  const text = await response.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {}

  return {
    accessToken: response.ok && body?.access_token ? String(body.access_token) : undefined,
    status: response.status,
    response: body,
  };
}

async function testGoogle(targetUrl: string) {
  try {
    const token = await googleAccessToken();
    if (!token.accessToken) {
      return {
        status: token.status,
        response: token.response,
        error: 'Google OAuth token request failed; URL notification was not sent.',
      };
    }

    const response = await fetchWithTimeout(
      GOOGLE_PUBLISH_URL,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: targetUrl,
          type: 'URL_UPDATED',
        }),
      }
    );

    const text = await response.text();
    let body: any = text;
    try {
      body = JSON.parse(text);
    } catch {}

    return {
      status: response.status,
      response: body,
      ...(response.ok ? {} : { error: 'Google Indexing API returned HTTP ' + response.status + '.' }),
    };
  } catch (error: any) {
    return {
      status: 0,
      response: null,
      error: error?.message || String(error),
    };
  }
}

async function testIndexNow(targetUrl: string) {
  const target = new URL(targetUrl);
  const keyLocation = target.origin + '/' + INDEXNOW_KEY + '.txt';

  let keyFileVerified = false;
  let keyFileStatus = 0;
  let keyFileResponse = '';

  try {
    const verification = await fetchWithTimeout(
      keyLocation,
      { method: 'GET', headers: { 'Cache-Control': 'no-cache' } }
    );
    keyFileStatus = verification.status;
    keyFileResponse = (await verification.text()).trim();
    keyFileVerified = verification.ok && keyFileResponse === INDEXNOW_KEY;
  } catch (error: any) {
    keyFileResponse = error?.message || String(error);
  }

  try {
    const response = await fetchWithTimeout(
      'https://api.indexnow.org/indexnow',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host: target.host,
          key: INDEXNOW_KEY,
          keyLocation,
          urlList: [targetUrl],
        }),
      }
    );

    const responseText = await response.text();
    return {
      status: response.status,
      keyFileVerified,
      keyFileStatus,
      keyLocation,
      response: responseText || null,
      ...(response.ok || response.status === 202
        ? {}
        : { error: 'IndexNow returned HTTP ' + response.status + '.' }),
    };
  } catch (error: any) {
    return {
      status: 0,
      keyFileVerified,
      keyFileStatus,
      keyLocation,
      response: null,
      error: error?.message || String(error),
    };
  }
}

export default async function handler(req: any, res: any) {
  const method = String(req.method || 'GET').toUpperCase();
  if (!['GET', 'POST'].includes(method)) {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  if (!(await isAuthorized(req))) {
    return sendJson(res, 401, {
      error: 'Administrator session or authorized GitHub Actions diagnostic token required.',
    });
  }

  let targetUrl: string;
  try {
    targetUrl = targetUrlFromRequest(req);
  } catch (error: any) {
    return sendJson(res, 400, { error: error?.message || String(error) });
  }

  const [googleIndexing, indexNow] = await Promise.all([
    testGoogle(targetUrl),
    testIndexNow(targetUrl),
  ]);

  const summary = {
    targetUrl,
    googleIndexing,
    indexNow,
    testedAt: new Date().toISOString(),
  };

  console.log('[indexing-diagnostic]', JSON.stringify(summary));
  return sendJson(res, 200, summary);
}

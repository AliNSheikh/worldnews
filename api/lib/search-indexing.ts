import crypto from 'crypto';

const GOOGLE_INDEXING_SCOPE = 'https://www.googleapis.com/auth/indexing';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_INDEXING_URL = 'https://indexing.googleapis.com/v3/urlNotifications:publish';

export const INDEXNOW_KEY = '37889c93b7a4871999be40b8144667bc';

type IndexingArticle = {
  category?: string;
  status?: string;
  translations?: Record<string, {
    slug?: string;
    translationStatus?: string;
  } | undefined>;
};

type SubmissionResult = {
  service: 'google' | 'indexnow';
  ok: boolean;
  skipped?: boolean;
  submitted?: number;
  error?: string;
};

function clean(value: string | undefined): string {
  return String(value || '').trim().replace(/^['"]+|['"]+$/g, '');
}

function privateKeyFromEnv(): string {
  return clean(process.env.GOOGLE_INDEXING_PRIVATE_KEY)
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n');
}

function siteOrigin(): string {
  const configured = clean(process.env.APP_URL).replace(/\/$/, '');
  return /^https?:\/\//i.test(configured)
    ? configured
    : 'https://www.newsdiscover.org';
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getGoogleAccessToken(): Promise<string | null> {
  const clientEmail = clean(process.env.GOOGLE_INDEXING_CLIENT_EMAIL);
  const privateKey = privateKeyFromEnv();
  if (!clientEmail || !privateKey) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: 'RS256', typ: 'JWT' });
  const claims = base64UrlJson({
    iss: clientEmail,
    scope: GOOGLE_INDEXING_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  });
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
    },
    12000
  );

  const payload: any = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token) {
    const detail = payload?.error_description || payload?.error || 'Unable to obtain access token.';
    throw new Error('Google OAuth token request failed: ' + detail);
  }

  return String(payload.access_token);
}

function uniqueValidUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of urls) {
    try {
      const url = new URL(String(raw || '').trim());
      if (!/^https?:$/i.test(url.protocol)) continue;
      url.hash = '';
      const normalized = url.toString();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(normalized);
    } catch {}
  }

  return result;
}

export function buildArticleUrls(article: IndexingArticle, origin = siteOrigin()): string[] {
  if (!article || article.status !== 'published') return [];

  const cleanOrigin = String(origin || '').trim().replace(/\/$/, '');
  if (!/^https?:\/\//i.test(cleanOrigin)) return [];

  const category = encodeURIComponent(String(article.category || 'world'));
  const translations = article.translations || {};
  const urls: string[] = [];

  for (const [language, translation] of Object.entries(translations)) {
    const slug = String(translation?.slug || '').trim();
    if (!slug) continue;
    if (translation?.translationStatus && translation.translationStatus !== 'complete') continue;

    const encodedSlug = encodeURIComponent(slug);
    const path =
      language === 'en'
        ? '/news/' + category + '/' + encodedSlug
        : '/' + encodeURIComponent(language) + '/news/' + category + '/' + encodedSlug;
    urls.push(cleanOrigin + path);
  }

  return uniqueValidUrls(urls);
}

async function submitGoogle(urls: string[]): Promise<SubmissionResult> {
  const clientEmail = clean(process.env.GOOGLE_INDEXING_CLIENT_EMAIL);
  const privateKey = privateKeyFromEnv();

  if (!clientEmail || !privateKey) {
    return {
      service: 'google',
      ok: false,
      skipped: true,
      submitted: 0,
      error: 'GOOGLE_INDEXING_CLIENT_EMAIL or GOOGLE_INDEXING_PRIVATE_KEY is not configured.',
    };
  }

  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    return {
      service: 'google',
      ok: false,
      skipped: true,
      submitted: 0,
      error: 'Google access token was not available.',
    };
  }

  let submitted = 0;
  const errors: string[] = [];

  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(
        GOOGLE_INDEXING_URL,
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url,
            type: 'URL_UPDATED',
          }),
        },
        12000
      );

      if (response.ok) {
        submitted += 1;
      } else {
        const detail = (await response.text()).slice(0, 500);
        errors.push(url + ': HTTP ' + response.status + ' ' + detail);
      }
    } catch (error: any) {
      errors.push(url + ': ' + (error?.message || String(error)));
    }
  }

  return {
    service: 'google',
    ok: errors.length === 0,
    submitted,
    error: errors.length ? errors.join(' | ') : undefined,
  };
}

async function submitIndexNow(urls: string[]): Promise<SubmissionResult> {
  const groups = new Map<string, string[]>();

  for (const raw of urls) {
    try {
      const url = new URL(raw);
      const origin = url.origin;
      const existing = groups.get(origin) || [];
      existing.push(url.toString());
      groups.set(origin, existing);
    } catch {}
  }

  if (!groups.size) {
    return {
      service: 'indexnow',
      ok: true,
      skipped: true,
      submitted: 0,
    };
  }

  let submitted = 0;
  const errors: string[] = [];

  for (const [origin, urlList] of groups) {
    const parsed = new URL(origin);
    try {
      const response = await fetchWithTimeout(
        'https://api.indexnow.org/indexnow',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            host: parsed.host,
            key: INDEXNOW_KEY,
            keyLocation: origin + '/' + INDEXNOW_KEY + '.txt',
            urlList,
          }),
        },
        12000
      );

      if (response.ok || response.status === 202) {
        submitted += urlList.length;
      } else {
        const detail = (await response.text()).slice(0, 500);
        errors.push(origin + ': HTTP ' + response.status + ' ' + detail);
      }
    } catch (error: any) {
      errors.push(origin + ': ' + (error?.message || String(error)));
    }
  }

  return {
    service: 'indexnow',
    ok: errors.length === 0,
    submitted,
    error: errors.length ? errors.join(' | ') : undefined,
  };
}

export async function submitUrlsForIndexing(urls: string[]) {
  const normalized = uniqueValidUrls(urls);
  if (!normalized.length) {
    return {
      urls: [],
      results: [] as SubmissionResult[],
    };
  }

  const results = await Promise.all([
    submitGoogle(normalized).catch((error: any) => ({
      service: 'google' as const,
      ok: false,
      submitted: 0,
      error: error?.message || String(error),
    })),
    submitIndexNow(normalized).catch((error: any) => ({
      service: 'indexnow' as const,
      ok: false,
      submitted: 0,
      error: error?.message || String(error),
    })),
  ]);

  for (const result of results) {
    if (!result.ok && !result.skipped) {
      console.warn('[search-indexing]', result.service, result.error || 'submission failed');
    }
  }

  return { urls: normalized, results };
}

export async function submitPublishedArticleForIndexing(
  article: IndexingArticle,
  origin = siteOrigin()
) {
  return submitUrlsForIndexing(buildArticleUrls(article, origin));
}

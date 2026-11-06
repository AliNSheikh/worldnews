import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/indexing';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_PUBLISH_URL = 'https://indexing.googleapis.com/v3/urlNotifications:publish';
const INDEXNOW_URL = 'https://api.indexnow.org/indexnow';

const GOOGLE_BULK_DAILY_LIMIT = 190;
const GOOGLE_DELAY_MS = 500;
const INDEXNOW_BATCH_SIZE = 5000;
const DEFAULT_ORIGIN = 'https://www.newsdiscover.org';
const DEFAULT_INDEXNOW_KEY = '37889c93b7a4871999be40b8144667bc';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(SCRIPT_DIR, 'indexing-state.json');

function clean(value) {
  return String(value || '').trim().replace(/^['"]+|['"]+$/g, '');
}

function privateKeyFromEnv() {
  return clean(process.env.GOOGLE_INDEXING_PRIVATE_KEY)
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n');
}

function siteOrigin() {
  const configured = clean(process.env.APP_URL).replace(/\/$/, '');
  return /^https?:\/\//i.test(configured) ? configured : DEFAULT_ORIGIN;
}

function googleQuotaDatePacific(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + '-' + values.month + '-' + values.day;
}

function stateQuotaDate(googleDaily = {}) {
  return String(googleDaily.quotaDatePacific || googleDaily.dateUtc || '');
}

function defaultState() {
  return {
    googleSubmittedUrls: [],
    indexNowSubmittedUrls: [],
    googleDaily: {
      quotaDatePacific: googleQuotaDatePacific(),
      requestsAttempted: 0,
      successfulSubmissions: 0,
    },
    lastRunAt: null,
  };
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))];
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return defaultState();

  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const state = {
      ...defaultState(),
      ...parsed,
      googleSubmittedUrls: uniqueStrings(parsed.googleSubmittedUrls),
      indexNowSubmittedUrls: uniqueStrings(parsed.indexNowSubmittedUrls),
      googleDaily: {
        ...defaultState().googleDaily,
        ...(parsed.googleDaily || {}),
      },
    };

    const currentQuotaDate = googleQuotaDatePacific();
    const storedQuotaDate = stateQuotaDate(state.googleDaily);

    if (storedQuotaDate !== currentQuotaDate) {
      state.googleDaily = {
        quotaDatePacific: currentQuotaDate,
        requestsAttempted: 0,
        successfulSubmissions: 0,
      };
    } else {
      state.googleDaily = {
        quotaDatePacific: currentQuotaDate,
        requestsAttempted: Number(state.googleDaily.requestsAttempted || 0),
        successfulSubmissions: Number(state.googleDaily.successfulSubmissions || 0),
      };
    }

    return state;
  } catch (error) {
    throw new Error('Unable to read ' + STATE_FILE + ': ' + (error?.message || error));
  }
}

function saveState(state) {
  state.googleSubmittedUrls = uniqueStrings(state.googleSubmittedUrls);
  state.indexNowSubmittedUrls = uniqueStrings(state.indexNowSubmittedUrls);
  state.lastRunAt = new Date().toISOString();

  const temporary = STATE_FILE + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n', 'utf8');
  fs.renameSync(temporary, STATE_FILE);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeUrl(raw, expectedOrigin) {
  try {
    const url = new URL(String(raw || '').trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    if (expectedOrigin && url.origin !== expectedOrigin) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function buildArticleUrls(articles, origin) {
  const urls = [];

  for (const article of Array.isArray(articles) ? articles : []) {
    if (article?.status !== 'published') continue;
    const category = encodeURIComponent(String(article.category || 'world'));

    for (const [language, translation] of Object.entries(article.translations || {})) {
      const slug = String(translation?.slug || '').trim();
      if (!slug) continue;
      if (translation?.translationStatus && translation.translationStatus !== 'complete') continue;

      const encodedSlug = encodeURIComponent(slug);
      const route = language === 'en'
        ? '/news/' + category + '/' + encodedSlug
        : '/' + encodeURIComponent(language) + '/news/' + category + '/' + encodedSlug;

      urls.push(origin + route);
    }
  }

  return uniqueStrings(urls.map((url) => normalizeUrl(url, origin)).filter(Boolean));
}

function decodeXml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function fetchUrlsFromApi(origin) {
  const endpoint = origin + '/api/articles?status=published&limit=5000&offset=0&sort=newest';
  const response = await fetchWithTimeout(endpoint, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'NewsDiscover-Bulk-Indexer/1.0',
    },
  });

  if (!response.ok) {
    throw new Error('Published article API returned HTTP ' + response.status);
  }

  const articles = await response.json();
  if (!Array.isArray(articles)) {
    throw new Error('Published article API did not return an array.');
  }

  const urls = buildArticleUrls(articles, origin);
  if (!urls.length && articles.length) {
    throw new Error('Published article API returned articles but no indexable language routes.');
  }

  return urls;
}

async function fetchUrlsFromSitemap(origin) {
  const sitemapUrl = clean(process.env.POST_SITEMAP_URL) || origin + '/post-sitemap.xml';
  const response = await fetchWithTimeout(sitemapUrl, {
    headers: {
      Accept: 'application/xml,text/xml,*/*',
      'User-Agent': 'NewsDiscover-Bulk-Indexer/1.0',
      'Cache-Control': 'no-cache',
    },
  });

  if (!response.ok) {
    throw new Error('Post sitemap returned HTTP ' + response.status);
  }

  const xml = await response.text();
  const urls = [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)]
    .map((match) => decodeXml(match[1]).trim())
    .map((url) => normalizeUrl(url, origin))
    .filter(Boolean);

  return uniqueStrings(urls);
}

async function fetchPublishedUrls(origin) {
  try {
    const urls = await fetchUrlsFromApi(origin);
    console.log('[bulk-index] Loaded ' + urls.length + ' published URLs from the public articles API.');
    return { source: 'articles-api', urls };
  } catch (error) {
    console.warn('[bulk-index] Articles API unavailable, falling back to post-sitemap.xml:', error?.message || error);
    const urls = await fetchUrlsFromSitemap(origin);
    console.log('[bulk-index] Loaded ' + urls.length + ' published URLs from post-sitemap.xml.');
    return { source: 'post-sitemap', urls };
  }
}

function jwtPart(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

async function getGoogleAccessToken() {
  const clientEmail = clean(process.env.GOOGLE_INDEXING_CLIENT_EMAIL);
  const privateKey = privateKeyFromEnv();

  if (!clientEmail || !privateKey) {
    return {
      accessToken: null,
      error: 'GOOGLE_INDEXING_CLIENT_EMAIL or GOOGLE_INDEXING_PRIVATE_KEY is not configured.',
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const header = jwtPart({ alg: 'RS256', typ: 'JWT' });
  const claims = jwtPart({
    iss: clientEmail,
    scope: GOOGLE_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  });
  const unsigned = header + '.' + claims;

  let signature;
  try {
    signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url');
  } catch (error) {
    return {
      accessToken: null,
      error: 'Unable to sign Google JWT: ' + (error?.message || error),
    };
  }

  try {
    const response = await fetchWithTimeout(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: unsigned + '.' + signature,
      }).toString(),
    });

    const text = await response.text();
    let body = text;
    try {
      body = JSON.parse(text);
    } catch {}

    if (!response.ok || !body?.access_token) {
      return {
        accessToken: null,
        error: 'Google OAuth HTTP ' + response.status + ': ' + JSON.stringify(body),
      };
    }

    return { accessToken: String(body.access_token), error: null };
  } catch (error) {
    return {
      accessToken: null,
      error: 'Google OAuth request failed: ' + (error?.message || error),
    };
  }
}

async function submitIndexNow(urls, state, origin) {
  const alreadySubmitted = new Set(state.indexNowSubmittedUrls);
  const pending = urls.filter((url) => !alreadySubmitted.has(url));
  const key = clean(process.env.INDEXNOW_KEY) || DEFAULT_INDEXNOW_KEY;
  const keyLocation = origin + '/' + key + '.txt';

  const summary = {
    pending: pending.length,
    submitted: 0,
    batches: 0,
    errors: [],
  };

  for (let offset = 0; offset < pending.length; offset += INDEXNOW_BATCH_SIZE) {
    const batch = pending.slice(offset, offset + INDEXNOW_BATCH_SIZE);
    if (!batch.length) continue;

    try {
      const response = await fetchWithTimeout(INDEXNOW_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host: new URL(origin).host,
          key,
          keyLocation,
          urlList: batch,
        }),
      }, 30000);

      const body = await response.text();
      summary.batches += 1;

      if (response.ok || response.status === 202) {
        state.indexNowSubmittedUrls.push(...batch);
        state.indexNowSubmittedUrls = uniqueStrings(state.indexNowSubmittedUrls);
        summary.submitted += batch.length;
        saveState(state);
        console.log('[bulk-index] IndexNow accepted batch of ' + batch.length + ' URL(s) with HTTP ' + response.status + '.');
      } else {
        const message = 'IndexNow HTTP ' + response.status + ': ' + body.slice(0, 1000);
        summary.errors.push(message);
        console.error('[bulk-index]', message);
      }
    } catch (error) {
      const message = 'IndexNow request failed: ' + (error?.message || error);
      summary.errors.push(message);
      console.error('[bulk-index]', message);
    }
  }

  return summary;
}

async function submitGoogle(urls, state) {
  const currentQuotaDate = googleQuotaDatePacific();
  if (stateQuotaDate(state.googleDaily) !== currentQuotaDate) {
    state.googleDaily = {
      quotaDatePacific: currentQuotaDate,
      requestsAttempted: 0,
      successfulSubmissions: 0,
    };
    saveState(state);
  } else if (!state.googleDaily.quotaDatePacific) {
    state.googleDaily = {
      quotaDatePacific: currentQuotaDate,
      requestsAttempted: Number(state.googleDaily.requestsAttempted || 0),
      successfulSubmissions: Number(state.googleDaily.successfulSubmissions || 0),
    };
    saveState(state);
  }

  const alreadySubmitted = new Set(state.googleSubmittedUrls);
  const unindexed = urls.filter((url) => !alreadySubmitted.has(url));
  const remainingBulkQuota = Math.max(
    0,
    GOOGLE_BULK_DAILY_LIMIT - Number(state.googleDaily.requestsAttempted || 0)
  );
  const candidates = unindexed.slice(0, remainingBulkQuota);

  const summary = {
    pending: unindexed.length,
    selectedThisRun: candidates.length,
    attempted: 0,
    submitted: 0,
    stoppedOn429: false,
    errors: [],
  };

  if (!candidates.length) {
    console.log('[bulk-index] No Google URLs selected. Remaining bulk quota today: ' + remainingBulkQuota + '.');
    return summary;
  }

  const token = await getGoogleAccessToken();
  if (!token.accessToken) {
    summary.errors.push(token.error);
    console.error('[bulk-index]', token.error);
    return summary;
  }

  for (let index = 0; index < candidates.length; index += 1) {
    const url = candidates[index];

    let response;
    let responseBody = '';

    try {
      response = await fetchWithTimeout(GOOGLE_PUBLISH_URL, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          type: 'URL_UPDATED',
        }),
      }, 15000);
      responseBody = await response.text();
    } catch (error) {
      state.googleDaily.requestsAttempted += 1;
      summary.attempted += 1;
      saveState(state);

      const message = url + ': request failed: ' + (error?.message || error);
      summary.errors.push(message);
      console.error('[bulk-index]', message);

      if (index < candidates.length - 1) await sleep(GOOGLE_DELAY_MS);
      continue;
    }

    state.googleDaily.requestsAttempted += 1;
    summary.attempted += 1;

    if (response.status === 200) {
      state.googleSubmittedUrls.push(url);
      state.googleSubmittedUrls = uniqueStrings(state.googleSubmittedUrls);
      state.googleDaily.successfulSubmissions += 1;
      summary.submitted += 1;
      saveState(state);
      console.log(
        '[bulk-index] Google accepted ' + url +
        ' (' + state.googleDaily.requestsAttempted + '/' + GOOGLE_BULK_DAILY_LIMIT + ' bulk requests today).'
      );
    } else {
      saveState(state);

      const message = url + ': Google HTTP ' + response.status + ': ' + responseBody.slice(0, 1000);
      summary.errors.push(message);
      console.error('[bulk-index]', message);

      if (response.status === 429) {
        summary.stoppedOn429 = true;
        console.warn('[bulk-index] Google returned 429. Saving progress and stopping Google submissions gracefully.');
        break;
      }

      if (response.status === 401 || response.status === 403) {
        console.warn('[bulk-index] Google authorization failed. Stopping this run to avoid wasting quota.');
        break;
      }
    }

    if (index < candidates.length - 1) await sleep(GOOGLE_DELAY_MS);
  }

  return summary;
}

async function main() {
  const origin = siteOrigin();
  const state = loadState();
  saveState(state);

  const fetched = await fetchPublishedUrls(origin);
  const urls = fetched.urls;

  const [indexNow, googleIndexing] = await Promise.all([
    submitIndexNow(urls, state, origin),
    submitGoogle(urls, state),
  ]);

  saveState(state);

  const summary = {
    ok: true,
    origin,
    urlSource: fetched.source,
    publishedUrlCount: urls.length,
    googleIndexing,
    indexNow,
    stateFile: path.relative(process.cwd(), STATE_FILE),
    googleBulkDailyLimit: GOOGLE_BULK_DAILY_LIMIT,
    googleQuotaTimezone: 'America/Los_Angeles',
    googleDailyState: state.googleDaily,
    completedAt: new Date().toISOString(),
  };

  console.log('\n' + JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error('[bulk-index] Fatal error:', error?.stack || error?.message || error);
  process.exitCode = 1;
});

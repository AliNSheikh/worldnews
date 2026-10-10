import crypto from 'crypto';
import Parser from 'rss-parser';
import { createClient } from '@libsql/client';

export const maxDuration = 60;
const COOKIE = 'world_news_admin_session';
const HOUR_MS = 60 * 60 * 1000;
const MINIMUM_LOOKBACK_MS = HOUR_MS;
const MAX_RECOVERY_LOOKBACK_MS = 12 * HOUR_MS;
const SCHEDULE_GUARD_MS = 50 * 60 * 1000;

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
    header.split(';').map((v) => v.trim()).filter(Boolean).map((v) => {
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

let githubJwksCache: { expiresAt: number; keys: any[] } = {
  expiresAt: 0,
  keys: [],
};

function decodeJwtPart(value: string): any {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

async function verifyGitHubSchedulerOidc(req: any): Promise<boolean> {
  const marker = String(req.headers?.['x-newsdiscover-scheduler'] || '');
  if (marker !== 'github-actions') return false;

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
    if (!['schedule', 'workflow_dispatch'].includes(String(claims.event_name || ''))) return false;

    const expectedWorkflowRef =
      'AliNSheikh/worldnews/.github/workflows/hourly-crawler.yml@refs/heads/main';
    if (claims.workflow_ref !== expectedWorkflowRef) return false;

    if (typeof claims.exp !== 'number' || claims.exp <= now) return false;
    if (typeof claims.nbf === 'number' && claims.nbf > now + 30) return false;

    if (githubJwksCache.expiresAt <= Date.now() || !githubJwksCache.keys.length) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(
          'https://token.actions.githubusercontent.com/.well-known/jwks',
          {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
          }
        );
        if (!response.ok) return false;
        const jwks: any = await response.json();
        githubJwksCache = {
          expiresAt: Date.now() + 60 * 60 * 1000,
          keys: Array.isArray(jwks.keys) ? jwks.keys : [],
        };
      } finally {
        clearTimeout(timer);
      }
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

async function isCron(req: any): Promise<boolean> {
  const secret = String(process.env.CRON_SECRET || '');
  if (secret && req.headers?.authorization === 'Bearer ' + secret) return true;
  return verifyGitHubSchedulerOidc(req);
}

function connection() {
  const url = clean(process.env.TURSO_DATABASE_URL);
  const authToken = clean(process.env.TURSO_AUTH_TOKEN || process.env.TURSO_DATABASE_AUTH_TOKEN);
  if (!url || !authToken) throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required.');
  return createClient({ url, authToken });
}

function parsePayload(value: unknown): any {
  if (value && typeof value === 'object') return value;
  return JSON.parse(String(value || '{}'));
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
    rsquo: "'",
    lsquo: "'",
    rdquo: '"',
    ldquo: '"',
    ndash: '-',
    mdash: '—',
    hellip: '…',
  };

  return String(value || '')
    .replace(/&#(x?[0-9a-f]+);?/gi, (_match, code) => {
      const base = String(code).toLowerCase().startsWith('x') ? 16 : 10;
      const numeric = parseInt(base === 16 ? String(code).slice(1) : String(code), base);
      return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : _match;
    })
    .replace(/&([a-z]+);/gi, (match, name) => named[String(name).toLowerCase()] ?? match);
}

function normalizeExtractedText(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+'\s*(s|d|m|t|re|ve|ll)\b/gi, "'$1")
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([([{])\s+/g, '$1')
    .replace(/\s+([)\]}])/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function stripHtml(value: string): string {
  const withBlockSpacing = String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<\/?(?:article|aside|blockquote|br|div|figcaption|figure|footer|h[1-6]|header|li|main|nav|p|section|table|td|th|tr|ul|ol)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '');
  return normalizeExtractedText(withBlockSpacing);
}

function parseTagAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(tag))) {
    attrs[match[1].toLowerCase()] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attrs;
}

function extractMetaContent(html: string, names: string[]): string {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of metaTags) {
    const attrs = parseTagAttributes(tag);
    const key = String(attrs.property || attrs.name || attrs.itemprop || '').toLowerCase();
    if (wanted.has(key) && attrs.content) return normalizeExtractedText(attrs.content);
  }
  return '';
}

function absoluteUrl(candidate: string, pageUrl: string): string {
  const raw = decodeHtmlEntities(String(candidate || '').trim());
  if (!raw || /^(?:data|blob|javascript):/i.test(raw)) return '';
  try {
    return new URL(raw, pageUrl).toString();
  } catch {
    return '';
  }
}

function imageKey(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    ['w', 'width', 'h', 'height', 'q', 'quality', 'fit', 'crop', 'format', 'fm']
      .forEach((key) => url.searchParams.delete(key));
    return url.toString();
  } catch {
    return value;
  }
}

function addImage(
  assets: Array<{ url: string; alt?: string; caption?: string; source?: string }>,
  seen: Set<string>,
  rawUrl: string,
  pageUrl: string,
  details: { alt?: string; caption?: string; source?: string } = {}
) {
  const url = absoluteUrl(rawUrl, pageUrl);
  if (!url || !/^https?:\/\//i.test(url)) return;
  const key = imageKey(url);
  if (seen.has(key)) return;
  seen.add(key);
  assets.push({
    url,
    alt: normalizeExtractedText(details.alt || ''),
    caption: normalizeExtractedText(details.caption || ''),
    source: details.source || 'source-page',
  });
}

function extractJsonLd(html: string): any[] {
  const blocks = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  const values: any[] = [];
  for (const block of blocks) {
    const raw = block.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
    try {
      const parsed = JSON.parse(decodeHtmlEntities(raw));
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (queue.length) {
        const item = queue.shift();
        if (!item || typeof item !== 'object') continue;
        values.push(item);
        if (Array.isArray(item['@graph'])) queue.push(...item['@graph']);
      }
    } catch {}
  }
  return values;
}

function extractJsonLdImageValues(value: any): string[] {
  if (!value) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(extractJsonLdImageValues);
  if (typeof value === 'object') {
    return [value.url, value.contentUrl, value.thumbnailUrl]
      .filter(Boolean)
      .flatMap(extractJsonLdImageValues);
  }
  return [];
}

function extractPageImages(html: string, pageUrl: string, jsonLd: any[]) {
  const assets: Array<{ url: string; alt?: string; caption?: string; source?: string }> = [];
  const seen = new Set<string>();

  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of metaTags) {
    const attrs = parseTagAttributes(tag);
    const key = String(attrs.property || attrs.name || attrs.itemprop || '').toLowerCase();
    if (['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src', 'image'].includes(key)) {
      addImage(assets, seen, attrs.content || '', pageUrl, { source: 'metadata' });
    }
  }

  for (const item of jsonLd) {
    for (const candidate of extractJsonLdImageValues(item.image || item.thumbnailUrl)) {
      addImage(assets, seen, candidate, pageUrl, {
        alt: item.headline || item.name || '',
        source: 'structured-data',
      });
    }
  }

  const imageTags = html.match(/<img\b[^>]*>/gi) || [];
  for (const tag of imageTags) {
    const attrs = parseTagAttributes(tag);
    const width = Number(attrs.width || 0);
    const height = Number(attrs.height || 0);
    if ((width && width < 160) || (height && height < 120)) continue;

    const candidates = [
      attrs.src,
      attrs['data-src'],
      attrs['data-lazy-src'],
      attrs['data-original'],
    ].filter(Boolean) as string[];

    const srcset = attrs.srcset || attrs['data-srcset'] || '';
    if (srcset) {
      const largest = srcset
        .split(',')
        .map((part) => part.trim().split(/\s+/))
        .filter((part) => part[0])
        .sort((a, b) => {
          const aw = Number(String(a[1] || '').replace(/\D/g, '')) || 0;
          const bw = Number(String(b[1] || '').replace(/\D/g, '')) || 0;
          return bw - aw;
        })[0]?.[0];
      if (largest) candidates.unshift(largest);
    }

    for (const candidate of candidates) {
      addImage(assets, seen, candidate, pageUrl, {
        alt: attrs.alt || attrs.title || '',
        source: 'article-body',
      });
      break;
    }
  }

  return assets.slice(0, 24);
}

function collectMediaUrls(value: any): string[] {
  if (!value) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectMediaUrls);
  if (typeof value === 'object') {
    const direct = value.url || value.contentUrl || value?.$?.url;
    const nested = Object.values(value).flatMap(collectMediaUrls);
    return [...(direct ? [String(direct)] : []), ...nested];
  }
  return [];
}

function extractFeedImages(item: any, pageUrl: string) {
  const assets: Array<{ url: string; alt?: string; caption?: string; source?: string }> = [];
  const seen = new Set<string>();
  const enclosure = item?.enclosure?.url;
  if (enclosure) addImage(assets, seen, enclosure, pageUrl, { source: 'rss-enclosure' });

  const mediaCandidates = [
    ...collectMediaUrls(item?.['media:content']),
    ...collectMediaUrls(item?.['media:thumbnail']),
    ...collectMediaUrls(item?.media?.content),
    ...collectMediaUrls(item?.media?.thumbnail),
  ];
  mediaCandidates.forEach((candidate) =>
    addImage(assets, seen, candidate, pageUrl, { source: 'rss-media' })
  );

  const html = String(
    item?.['content:encoded'] || item?.content || item?.summary || item?.description || ''
  );
  for (const tag of html.match(/<img\b[^>]*>/gi) || []) {
    const attrs = parseTagAttributes(tag);
    const candidate = attrs.src || attrs['data-src'] || '';
    addImage(assets, seen, candidate, pageUrl, {
      alt: attrs.alt || '',
      source: 'rss-content',
    });
  }

  return assets;
}

function extractFeedDescription(item: any): string {
  const candidates = [
    item?.contentSnippet,
    item?.summary,
    item?.description,
    item?.['dc:description'],
    item?.content,
    item?.['content:encoded'],
  ];
  for (const value of candidates) {
    const cleaned = stripHtml(String(value || ''));
    if (cleaned.length >= 40) return cleaned;
  }
  return '';
}

function slugify(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'article-' + Date.now();
}

function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = '';
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid']
      .forEach((key) => url.searchParams.delete(key));
    url.searchParams.sort();
    return url.toString().replace(/\/$/, '');
  } catch {
    return String(raw || '').trim().replace(/#.*$/, '').replace(/\/$/, '');
  }
}

function itemDate(item: any): number {
  const value = item.pubDate || item.isoDate || item.published || item.updated || '';
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

async function fetchFeed(rssUrl: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsDiscover/1.0; +https://www.newsdiscover.org)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('Feed returned HTTP ' + response.status);
    const xml = await response.text();
    const parser = new Parser({
      customFields: {
        item: [
          ['content:encoded', 'content:encoded'],
          ['dc:description', 'dc:description'],
          ['media:content', 'media:content', { keepArray: true }],
          ['media:thumbnail', 'media:thumbnail', { keepArray: true }],
        ],
      },
    });
    return await parser.parseString(xml);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPageMetadata(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsDiscover/1.0; +https://www.newsdiscover.org)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    if (!response.ok) {
      return {
        description: '',
        images: [] as Array<{ url: string; alt?: string; caption?: string; source?: string }>,
        articleText: '',
      };
    }

    const html = (await response.text()).slice(0, 1_500_000);
    const jsonLd = extractJsonLd(html);

    const structuredDescription = jsonLd
      .map((item) => normalizeExtractedText(String(item.description || item.abstract || '')))
      .find((value) => value.length >= 40) || '';

    const description =
      extractMetaContent(html, ['og:description']) ||
      extractMetaContent(html, ['twitter:description']) ||
      extractMetaContent(html, ['description']) ||
      extractMetaContent(html, ['dc.description']) ||
      structuredDescription;

    const structuredBody = jsonLd
      .map((item) => stripHtml(String(item.articleBody || item.text || '')))
      .find((value) => value.length >= 100) || '';

    const articleBlock =
      html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ||
      html.match(/<(?:main|section|div)\b[^>]*(?:itemprop=["']articleBody["']|class=["'][^"']*(?:article-body|story-body|post-content|entry-content)[^"']*["'])[^>]*>([\s\S]*?)<\/(?:main|section|div)>/i)?.[1] ||
      '';

    const articleText = normalizeExtractedText(
      (structuredBody || stripHtml(articleBlock) || stripHtml(html)).slice(0, 16000)
    );

    return {
      description: normalizeExtractedText(description),
      images: extractPageImages(html, url, jsonLd),
      articleText,
    };
  } catch {
    return {
      description: '',
      images: [] as Array<{ url: string; alt?: string; caption?: string; source?: string }>,
      articleText: '',
    };
  } finally {
    clearTimeout(timer);
  }
}

function fallbackEditorial(title: string, description: string, body: string) {
  const cleanTitle = normalizeExtractedText(title);
  const summary = normalizeExtractedText((description || body || cleanTitle).slice(0, 450));
  const structuredBody = normalizeExtractedText((body || description || cleanTitle).slice(0, 7000));
  const words = cleanTitle.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
  const keywords = [...new Set(words)].slice(0, 8);
  return {
    title: cleanTitle,
    slug: slugify(cleanTitle),
    executiveSummary: summary,
    structuredBody,
    seoTitle: cleanTitle.slice(0, 65),
    metaDescription: summary.slice(0, 160),
    keywords,
    tags: keywords.slice(0, 5),
    imageAlt: cleanTitle,
    faq: [],
    entities: [],
  };
}

async function generateEditorial(title: string, description: string, body: string, sourceName: string, category: string) {
  const apiKey = clean(process.env.GEMINI_API_KEY);
  if (!apiKey) return fallbackEditorial(title, description, body);

  const model = clean(process.env.GEMINI_MODEL) || 'gemini-2.5-flash';
  const prompt = [
    'You are an English-language international news and SEO editor.',
    'Use ONLY the supplied source facts. Do not invent facts, quotations, numbers, dates, people or reactions.',
    'Rewrite the headline while preserving the exact event and meaning.',
    'Return JSON only with: title, slug, executiveSummary, structuredBody, seoTitle, metaDescription, keywords, tags, imageAlt, faq, entities.',
    'SEO title about 50-65 chars; meta description about 140-160 chars; 5-8 keywords; 3-6 tags.',
    'Source: ' + sourceName,
    'Category: ' + category,
    'Original headline: ' + title,
    'Source description: ' + description,
    'Source article text: ' + body.slice(0, 9000),
  ].join('\n\n');

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 14000);
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' +
        encodeURIComponent(model) +
        ':generateContent?key=' +
        encodeURIComponent(apiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timer);
    if (!response.ok) return fallbackEditorial(title, description, body);
    const payload: any = await response.json();
    const raw = payload?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('') || '';
    const parsed = JSON.parse(raw.replace(/^\s*```json\s*|\s*```\s*$/g, '').trim());
    const fallback = fallbackEditorial(title, description, body);
    return {
      title: normalizeExtractedText(String(parsed.title || fallback.title)),
      slug: slugify(String(parsed.slug || parsed.title || fallback.slug)),
      executiveSummary: normalizeExtractedText(String(parsed.executiveSummary || fallback.executiveSummary)),
      structuredBody: normalizeExtractedText(String(parsed.structuredBody || fallback.structuredBody)),
      seoTitle: normalizeExtractedText(String(parsed.seoTitle || parsed.title || fallback.seoTitle)).slice(0, 70),
      metaDescription: normalizeExtractedText(String(parsed.metaDescription || fallback.metaDescription)).slice(0, 180),
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter(Boolean).slice(0, 12) : fallback.keywords,
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter(Boolean).slice(0, 10) : fallback.tags,
      imageAlt: normalizeExtractedText(String(parsed.imageAlt || parsed.title || fallback.imageAlt)),
      faq: Array.isArray(parsed.faq) ? parsed.faq.slice(0, 5) : [],
      entities: Array.isArray(parsed.entities) ? parsed.entities.slice(0, 20) : [],
    };
  } catch {
    return fallbackEditorial(title, description, body);
  }
}

async function latestAutomatedRunAt(db: ReturnType<typeof createClient>): Promise<number | null> {
  const result = await db.execute('SELECT payload FROM newsroom_logs ORDER BY id DESC LIMIT 100');
  const timestamps = result.rows
    .map((row: any) => {
      try {
        return parsePayload(row.payload);
      } catch {
        return null;
      }
    })
    .filter((log: any) => log?.source === 'Hourly Automated AI Wire Retrieval Engine')
    .map((log: any) => new Date(log.completedAt || log.startedAt || 0).getTime())
    .filter((timestamp: number) => Number.isFinite(timestamp) && timestamp > 0);

  return timestamps.length ? Math.max(...timestamps) : null;
}

async function scheduledRunDecision(db: ReturnType<typeof createClient>) {
  const lastRunAt = await latestAutomatedRunAt(db);
  if (!lastRunAt) return { shouldRun: true, lastRunAt: null, elapsedMs: null };

  const elapsedMs = Date.now() - lastRunAt;
  return {
    shouldRun: elapsedMs >= SCHEDULE_GUARD_MS,
    lastRunAt,
    elapsedMs,
  };
}

async function recoveryLookbackMs(db: ReturnType<typeof createClient>, scheduled: boolean) {
  if (!scheduled) return MINIMUM_LOOKBACK_MS;
  const lastRunAt = await latestAutomatedRunAt(db);
  if (!lastRunAt) return 2 * HOUR_MS;
  const elapsed = Math.max(0, Date.now() - lastRunAt);
  return Math.min(
    MAX_RECOVERY_LOOKBACK_MS,
    Math.max(MINIMUM_LOOKBACK_MS, elapsed + 15 * 60 * 1000)
  );
}

async function runCycle(db: ReturnType<typeof createClient>, sourceId?: string, scheduled = false) {
  const startedAt = new Date().toISOString();
  const settingsResult = await db.execute("SELECT payload FROM newsroom_settings WHERE id = 'default' LIMIT 1");
  const settings = settingsResult.rows.length ? parsePayload(settingsResult.rows[0].payload) : {};
  const perSourceLimit = Math.max(1, Math.min(20, Number(settings.articlesPerSourcePerHour || 3)));
  const lookbackMs = await recoveryLookbackMs(db, scheduled);
  const recoveryHours = Math.max(1, Math.ceil(lookbackMs / HOUR_MS));
  const effectivePerSourceLimit = Math.min(40, perSourceLimit * recoveryHours);

  const sourceResult = sourceId
    ? await db.execute({ sql: 'SELECT payload FROM newsroom_sources WHERE id = ? LIMIT 1', args: [sourceId] })
    : await db.execute('SELECT payload FROM newsroom_sources');
  const sources = sourceResult.rows
    .map((row: any) => parsePayload(row.payload))
    .filter((source: any) => sourceId ? true : source.isActive !== false)
    .filter((source: any) => /^https?:\/\//i.test(String(source.rssUrl || '')));

  const existingResult = await db.execute('SELECT original_url FROM newsroom_articles WHERE original_url IS NOT NULL');
  const existing = new Set(existingResult.rows.map((row: any) => normalizeUrl(String(row.original_url || ''))));

  const diagnostics: any[] = [];
  const candidates: any[] = [];

  await Promise.all(
    sources.map(async (source: any) => {
      const diagnostic = {
        sourceId: source.id,
        sourceName: source.name,
        feedUrl: source.rssUrl,
        fetchedItems: 0,
        candidates: 0,
        imported: 0,
        error: null as string | null,
      };
      diagnostics.push(diagnostic);
      try {
        const feed = await fetchFeed(source.rssUrl);
        const items = Array.isArray(feed.items) ? feed.items : [];
        diagnostic.fetchedItems = items.length;
        const fresh = items
          .filter((item: any) => {
            const ts = itemDate(item);
            if (!ts) return false;
            const age = Date.now() - ts;
            const link = String(item.link || '').trim();
            return age >= 0 && age <= lookbackMs && /^https?:\/\//i.test(link) && !existing.has(normalizeUrl(link));
          })
          .sort((a: any, b: any) => itemDate(b) - itemDate(a))
          .slice(0, effectivePerSourceLimit);
        diagnostic.candidates = fresh.length;
        fresh.forEach((item: any) => candidates.push({ source, item, diagnostic }));
      } catch (error: any) {
        diagnostic.error = error?.message || String(error);
      }
    })
  );

  candidates.sort((a, b) => itemDate(b.item) - itemDate(a.item));

  let imported = 0;
  let published = 0;
  let review = 0;

  for (const candidate of candidates) {
    const { source, item, diagnostic } = candidate;
    const originalUrl = String(item.link || '').trim();
    const normalized = normalizeUrl(originalUrl);
    if (!originalUrl || existing.has(normalized)) continue;

    try {
      const page = await fetchPageMetadata(originalUrl);
      const feedDescription = extractFeedDescription(item);
      const description = normalizeExtractedText(
        page.description || feedDescription || String(item.title || '')
      );
      const sourceText = normalizeExtractedText(
        page.articleText || feedDescription || description
      );

      if (sourceText.length < 80) {
        diagnostic.error = diagnostic.error || 'Skipped because less than 80 characters of verifiable source text were available.';
        continue;
      }

      const editorial = await generateEditorial(
        normalizeExtractedText(String(item.title || '').trim()),
        description,
        sourceText,
        String(source.name || 'News Source'),
        String(source.category || 'world')
      );

      const now = new Date().toISOString();
      const pubRaw = item.pubDate || item.isoDate || item.published || item.updated || now;
      const publishedAt = Number.isFinite(new Date(pubRaw).getTime()) ? new Date(pubRaw).toISOString() : now;
      const pageImages = Array.isArray(page.images) ? page.images : [];
      const feedImages = extractFeedImages(item, originalUrl);
      const mergedImages: Array<{ url: string; alt?: string; caption?: string; source?: string }> = [];
      const imageSeen = new Set<string>();
      [...pageImages, ...feedImages].forEach((asset) => {
        if (!asset?.url) return;
        const key = imageKey(asset.url);
        if (imageSeen.has(key)) return;
        imageSeen.add(key);
        mergedImages.push(asset);
      });
      const image = mergedImages[0]?.url || '';
      const id = 'wire-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
      const article = {
        id,
        category: String(source.category || 'world'),
        editorialType: 'staff',
        originalSource: String(source.name || 'News Source'),
        originalUrl,
        originalDescription: description,
        officialImageUrl: image || undefined,
        image,
        images: mergedImages,
        imageCredit: image ? 'Upstream editorial image' : 'News Discover',
        imageProvenance: image ? 'Extracted from source/feed metadata' : 'No source image available',
        imageLicense: image ? 'Upstream editorial media; verify publishing rights before monetized use' : 'Not applicable',
        status: 'published',
        isBreaking: false,
        isPinned: false,
        priority: 5,
        views: 0,
        shares: 0,
        publishedAt,
        updatedAt: now,
        byline: 'News Discover International Desk',
        translations: {
          en: {
            language: 'en',
            title: editorial.title,
            slug: editorial.slug,
            executiveSummary: editorial.executiveSummary,
            structuredBody: editorial.structuredBody,
            seoTitle: editorial.seoTitle,
            metaDescription: editorial.metaDescription,
            keywords: editorial.keywords,
            tags: editorial.tags,
            imageAlt: editorial.imageAlt,
            faq: editorial.faq,
            translationStatus: 'complete',
            entities: editorial.entities,
          },
        },
        hasVideo: false,
      };

      await db.execute({
        sql: 'INSERT INTO newsroom_articles (id, original_url, category, status, published_at, updated_at, payload) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [id, originalUrl, article.category, article.status, publishedAt, now, JSON.stringify(article)],
      });
      existing.add(normalized);
      imported += 1;
      published += 1;
      diagnostic.imported += 1;

      const updatedSource = {
        ...source,
        lastImport: now,
        lastError: null,
        articlesCount: Number(source.articlesCount || 0) + diagnostic.imported,
      };
      await db.execute({
        sql: 'INSERT INTO newsroom_sources (id, payload) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload',
        args: [source.id, JSON.stringify(updatedSource)],
      });
    } catch (error: any) {
      diagnostic.error = error?.message || String(error);
    }
  }

  const completedAt = new Date().toISOString();
  const errors = diagnostics.map((d) => d.error).filter(Boolean);
  const log = {
    id: 'log-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex'),
    jobType: 'rss_sync',
    source: sourceId ? 'Manual RSS Source Import' : 'Hourly Automated AI Wire Retrieval Engine',
    startedAt,
    completedAt,
    status: imported > 0 ? 'success' : errors.length ? 'warning' : 'success',
    errorMessage: imported > 0 ? null : errors.join(' | ') || 'No new feed items found in the last 60 minutes.',
    importedCount: imported,
  };
  await db.execute({
    sql: 'INSERT INTO newsroom_logs (id, payload) VALUES (?, ?)',
    args: [log.id, JSON.stringify(log)],
  });

  return {
    success: true,
    newArticlesCount: imported,
    count: imported,
    publishedArticlesCount: published,
    reviewArticlesCount: review,
    scrapedSources: sources.map((source: any) => source.name),
    sourceDiagnostics: diagnostics,
    persistenceProvider: 'turso',
    hasMore: false,
    lookbackMinutes: Math.round(lookbackMs / 60000),
    message: imported
      ? 'Crawler persisted ' + imported + ' new article(s) directly to Turso.'
      : 'Crawler completed with no new articles from the last 60 minutes.',
    ranAt: completedAt,
  };
}

export default async function handler(req: any, res: any) {
  let stage = 'request-init';
  try {
    const url = new URL(req.url || '/', 'https://local');
    const action = String(url.searchParams.get('action') || 'status');
    const sourceId = String(url.searchParams.get('id') || '');
    const method = String(req.method || 'GET').toUpperCase();

    if (action === 'cron') {
      if (!(await isCron(req))) {
        return json(res, 401, {
          error: 'Unauthorized scheduled crawler request.',
        });
      }
    } else if (action !== 'status' && (method !== 'POST' || !isAdmin(req))) {
      return json(res, 401, { error: 'Administrator authentication required.' });
    }

    const db = connection();

    if (action === 'status') {
      const [articles, logs] = await Promise.all([
        db.execute('SELECT COUNT(*) AS total FROM newsroom_articles'),
        db.execute('SELECT payload FROM newsroom_logs ORDER BY id DESC LIMIT 12'),
      ]);
      const recentLogs = logs.rows.map((row: any) => parsePayload(row.payload));
      return json(res, 200, {
        status: 'healthy',
        isSchedulerActive: true,
        intervalMs: 60 * 60 * 1000,
        persistenceProvider: 'turso',
        tursoDatabaseUrlConfigured: true,
        tursoAuthTokenConfigured: true,
        totalArticlesIngested: Number(articles.rows[0]?.total || 0),
        lastImportedCount: Number(recentLogs[0]?.importedCount || 0),
        lastRunStatus: recentLogs[0]?.status || null,
        enabledLanguages: ['en'],
        recentLogs: recentLogs.map((log: any) => ({
          timestamp: log.completedAt || log.startedAt,
          message: log.errorMessage || (log.source + ': ' + log.importedCount + ' article(s) imported (' + log.status + ').'),
          articlesAdded: log.importedCount,
          status: log.status,
        })),
      });
    }

    if (action === 'translate') {
      return json(res, 200, {
        success: true,
        translatedArticles: 0,
        remaining: 0,
        message: 'English-only mode is enabled. Translation jobs are disabled.',
      });
    }

    if (action === 'import') {
      if (!sourceId) return json(res, 400, { error: 'Source id is required.' });
      return json(res, 200, await runCycle(db, sourceId));
    }

    if (action === 'cron') {
      const decision = await scheduledRunDecision(db);
      if (!decision.shouldRun) {
        return json(res, 200, {
          success: true,
          skipped: true,
          newArticlesCount: 0,
          count: 0,
          persistenceProvider: 'turso',
          message: 'Hourly crawler already ran recently; this redundant scheduler trigger was safely skipped.',
          lastRunAt: decision.lastRunAt ? new Date(decision.lastRunAt).toISOString() : null,
        });
      }
      return json(res, 200, await runCycle(db, undefined, true));
    }

    if (action === 'run') {
      return json(res, 200, await runCycle(db));
    }

    return json(res, 404, { error: 'Unknown crawler action.' });
  } catch (error: any) {
    console.error('[direct-crawler]', stage, error);
    return json(res, 503, {
      success: false,
      code: 'DIRECT_TURSO_CRAWLER_FAILED',
      stage,
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
  }
}

import crypto from 'crypto';
import Parser from 'rss-parser';
import { createClient } from '@libsql/client';

export const maxDuration = 60;
const COOKIE = 'world_news_admin_session';
const FRESH_WINDOW_MS = 60 * 60 * 1000;

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

function stripHtml(value: string): string {
  return String(value || '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
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

function pickFeedImage(item: any): string {
  const enclosure = item?.enclosure?.url;
  if (enclosure && /\.(?:jpe?g|png|webp)(?:\?|$)/i.test(enclosure)) return enclosure;
  const text = String(item?.content || item?.['content:encoded'] || item?.summary || item?.description || '');
  const match = text.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : '';
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
    const parser = new Parser();
    return await parser.parseString(xml);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPageMetadata(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsDiscover/1.0; +https://www.newsdiscover.org)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!response.ok) return { description: '', image: '', articleText: '' };
    const html = (await response.text()).slice(0, 800000);
    const description =
      html.match(/<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:description|description)["']/i)?.[1] ||
      '';
    const image =
      html.match(/<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i)?.[1] ||
      '';
    const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || '';
    const articleText = stripHtml(article || html).slice(0, 12000);
    return { description: stripHtml(description), image, articleText };
  } catch {
    return { description: '', image: '', articleText: '' };
  } finally {
    clearTimeout(timer);
  }
}

function fallbackEditorial(title: string, description: string, body: string) {
  const summary = (description || body || title).slice(0, 450).trim();
  const structuredBody = (body || description || title).slice(0, 7000).trim();
  const words = title.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
  const keywords = [...new Set(words)].slice(0, 8);
  return {
    title,
    slug: slugify(title),
    executiveSummary: summary,
    structuredBody,
    seoTitle: title.slice(0, 65),
    metaDescription: summary.slice(0, 160),
    keywords,
    tags: keywords.slice(0, 5),
    imageAlt: title,
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
      title: String(parsed.title || fallback.title),
      slug: slugify(String(parsed.slug || parsed.title || fallback.slug)),
      executiveSummary: String(parsed.executiveSummary || fallback.executiveSummary),
      structuredBody: String(parsed.structuredBody || fallback.structuredBody),
      seoTitle: String(parsed.seoTitle || parsed.title || fallback.seoTitle).slice(0, 70),
      metaDescription: String(parsed.metaDescription || fallback.metaDescription).slice(0, 180),
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter(Boolean).slice(0, 12) : fallback.keywords,
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter(Boolean).slice(0, 10) : fallback.tags,
      imageAlt: String(parsed.imageAlt || parsed.title || fallback.imageAlt),
      faq: Array.isArray(parsed.faq) ? parsed.faq.slice(0, 5) : [],
      entities: Array.isArray(parsed.entities) ? parsed.entities.slice(0, 20) : [],
    };
  } catch {
    return fallbackEditorial(title, description, body);
  }
}

async function runCycle(db: ReturnType<typeof createClient>, sourceId?: string) {
  const startedAt = new Date().toISOString();
  const settingsResult = await db.execute("SELECT payload FROM newsroom_settings WHERE id = 'default' LIMIT 1");
  const settings = settingsResult.rows.length ? parsePayload(settingsResult.rows[0].payload) : {};
  const perSourceLimit = Math.max(1, Math.min(20, Number(settings.articlesPerSourcePerHour || 3)));

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
            return age >= 0 && age <= FRESH_WINDOW_MS && /^https?:\/\//i.test(link) && !existing.has(normalizeUrl(link));
          })
          .sort((a: any, b: any) => itemDate(b) - itemDate(a))
          .slice(0, perSourceLimit);
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
      const feedDescription = stripHtml(
        String(item.contentSnippet || item.content || item.summary || item.description || '')
      );
      const description = (page.description || feedDescription || String(item.title || '')).trim();
      const sourceText = (page.articleText || feedDescription || description).trim();

      if (sourceText.length < 80) {
        diagnostic.error = diagnostic.error || 'Skipped because less than 80 characters of verifiable source text were available.';
        continue;
      }

      const editorial = await generateEditorial(
        String(item.title || '').trim(),
        description,
        sourceText,
        String(source.name || 'News Source'),
        String(source.category || 'world')
      );

      const now = new Date().toISOString();
      const pubRaw = item.pubDate || item.isoDate || item.published || item.updated || now;
      const publishedAt = Number.isFinite(new Date(pubRaw).getTime()) ? new Date(pubRaw).toISOString() : now;
      const image = page.image || pickFeedImage(item) || '';
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

    if (action === 'run' || action === 'cron') {
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

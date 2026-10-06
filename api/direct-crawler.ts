import crypto from 'crypto';

export const maxDuration = 60;

const ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
const PROJECT_ID = '6ac4bf0d00093b81fef7';
const DATABASE_ID = 'worldnews';
const COOKIE = 'world_news_admin_session';
const TABLES = {
  articles: 'newsroom_articles',
  sources: 'newsroom_sources',
  logs: 'newsroom_logs',
};
const LANGS = ['en', 'ar', 'de', 'es', 'fr'] as const;

type FeedItem = {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  content: string;
  imageUrl?: string;
};

function json(res: any, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function cookieMap(header = ''): Record<string, string> {
  return Object.fromEntries(header.split(';').map((v) => v.trim()).filter(Boolean).map((v) => {
    const i = v.indexOf('=');
    return i >= 0 ? [decodeURIComponent(v.slice(0, i)), decodeURIComponent(v.slice(i + 1))] : [v, ''];
  }));
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

function appwriteHeaders(): Record<string, string> {
  const key = String(process.env.APPWRITE_API_KEY || '').trim();
  if (!key) throw new Error('APPWRITE_API_KEY is missing from the active Vercel environment.');
  return {
    'X-Appwrite-Project': PROJECT_ID,
    'X-Appwrite-Key': key,
    'X-Appwrite-Response-Format': '2.3.0',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function aw(path: string, init: RequestInit = {}): Promise<any> {
  const r = await fetch(`${ENDPOINT}${path}`, { ...init, headers: { ...appwriteHeaders(), ...(init.headers || {}) } });
  const text = await r.text();
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  if (!r.ok) {
    const detail = typeof parsed === 'string' ? parsed : parsed?.message || JSON.stringify(parsed);
    throw new Error(`Appwrite ${r.status}: ${detail || r.statusText}`);
  }
  return parsed;
}

function tablePath(table: string): string {
  return `/tablesdb/${encodeURIComponent(DATABASE_ID)}/tables/${encodeURIComponent(table)}/rows`;
}

function safeRowId(id: string): string {
  if (/^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/.test(id)) return id;
  return `r_${crypto.createHash('sha256').update(id).digest('hex').slice(0, 34)}`;
}

function parsePayload(row: any): any | null {
  const raw = row?.data?.payload ?? row?.payload;
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

async function listPayloads(table: string): Promise<any[]> {
  const output: any[] = [];
  for (let offset = 0; offset < 5000; offset += 100) {
    const qs = new URLSearchParams();
    qs.append('queries[]', 'limit(100)');
    qs.append('queries[]', `offset(${offset})`);
    qs.set('total', 'false');
    qs.set('ttl', '0');
    const result = await aw(`${tablePath(table)}?${qs.toString()}`);
    const rows = Array.isArray(result?.rows) ? result.rows : [];
    for (const row of rows) {
      const value = parsePayload(row);
      if (value) output.push(value);
    }
    if (rows.length < 100) break;
  }
  return output;
}

async function upsert(table: string, id: string, value: any) {
  await aw(`${tablePath(table)}/${encodeURIComponent(safeRowId(id))}`, {
    method: 'PUT',
    body: JSON.stringify({ data: { payload: JSON.stringify(value) } }),
  });
}

function decodeEntities(value: string): string {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripHtml(value: string): string {
  return decodeEntities(String(value || ''))
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(block: string, names: string[]): string {
  for (const name of names) {
    const escaped = name.replace(':', '\\:');
    const m = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
    if (m?.[1]) return decodeEntities(m[1]).trim();
  }
  return '';
}

function attr(block: string, tagName: string, attrName: string): string {
  const m = block.match(new RegExp(`<${tagName}\\b[^>]*\\b${attrName}=["']([^"']+)["'][^>]*>`, 'i'));
  return m?.[1] ? decodeEntities(m[1]).trim() : '';
}

function parseFeed(xml: string): FeedItem[] {
  const rss = Array.from(xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)).map((m) => m[1]);
  const atom = rss.length ? [] : Array.from(xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)).map((m) => m[1]);
  const blocks = rss.length ? rss : atom;
  return blocks.map((block) => {
    let link = tag(block, ['link']);
    if (!/^https?:\/\//i.test(link)) link = attr(block, 'link', 'href');
    const enclosure = block.match(/<enclosure\b[^>]*url=["']([^"']+)["'][^>]*>/i);
    const media = block.match(/<(?:media:content|media:thumbnail)\b[^>]*url=["']([^"']+)["'][^>]*>/i);
    const enclosureType = block.match(/<enclosure\b[^>]*type=["']([^"']+)["'][^>]*>/i)?.[1] || '';
    const imageUrl = media?.[1] || (enclosure && (/image/i.test(enclosureType) || /\.(?:jpe?g|png|webp)(?:\?|$)/i.test(enclosure[1])) ? enclosure[1] : undefined);
    const rawDescription = tag(block, ['description', 'summary']);
    const rawContent = tag(block, ['content:encoded', 'content']);
    return {
      title: stripHtml(tag(block, ['title'])),
      link: link.trim(),
      pubDate: tag(block, ['pubDate', 'published', 'updated', 'dc:date']) || new Date().toISOString(),
      description: stripHtml(rawDescription),
      content: stripHtml(rawContent || rawDescription),
      imageUrl,
    };
  }).filter((item) => item.title && /^https?:\/\//i.test(item.link));
}

async function fetchText(url: string, timeoutMs = 9000, accept = 'text/html,application/xhtml+xml,application/xml,text/xml,*/*'): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; WorldNewsBot/1.0; +https://worldnews-topaz.vercel.app)',
      Accept: accept,
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Upstream ${response.status} ${response.statusText}`);
  return response.text();
}

function meta(html: string, key: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'));
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i'));
  return decodeEntities(a?.[1] || b?.[1] || '').trim();
}

function extractPage(html: string) {
  const description = meta(html, 'og:description') || meta(html, 'description') || meta(html, 'twitter:description');
  const imageUrl = meta(html, 'og:image') || meta(html, 'twitter:image');
  let articleBody = '';
  for (const script of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(decodeEntities(script[1]));
      const stack = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (stack.length) {
        const item = stack.shift();
        if (!item || typeof item !== 'object') continue;
        if (typeof item.articleBody === 'string' && item.articleBody.length > articleBody.length) articleBody = item.articleBody;
        if (Array.isArray(item['@graph'])) stack.push(...item['@graph']);
      }
    } catch { /* ignore invalid publisher JSON-LD */ }
  }
  if (!articleBody) {
    const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
    const paragraphs = Array.from(article.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)).map((m) => stripHtml(m[1])).filter((p) => p.length >= 30);
    articleBody = paragraphs.join('\n\n');
  }
  return { description: stripHtml(description), imageUrl, articleText: stripHtml(articleBody).slice(0, 22000) };
}

function slugify(value: string, fallback: string): string {
  const slug = String(value || '').toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06ff]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return slug || fallback;
}

function normalizeTranslation(lang: string, value: any, fallbackTitle: string, id: string) {
  const title = String(value?.title || (lang === 'en' ? fallbackTitle : '')).trim();
  const summary = String(value?.executiveSummary || value?.summary || '').trim();
  const body = String(value?.structuredBody || value?.body || summary).trim();
  return {
    language: lang,
    title,
    slug: slugify(value?.slug || title, `${id}-${lang}`),
    executiveSummary: summary,
    structuredBody: body,
    seoTitle: String(value?.seoTitle || title).slice(0, 70),
    metaDescription: String(value?.metaDescription || summary || title).slice(0, 180),
    keywords: Array.isArray(value?.keywords) ? value.keywords.filter(Boolean).slice(0, 10) : [],
    tags: Array.isArray(value?.tags) ? value.tags.filter(Boolean).slice(0, 8) : [],
    imageAlt: String(value?.imageAlt || title || fallbackTitle),
    faq: Array.isArray(value?.faq) ? value.faq.slice(0, 5) : [],
    translationStatus: title && body ? 'complete' : 'needs-review',
    entities: Array.isArray(value?.entities) ? value.entities.filter(Boolean).slice(0, 20) : [],
  };
}

async function generateTranslations(title: string, description: string, articleText: string): Promise<Record<string, any>> {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing from the active Vercel environment.');
  const model = String(process.env.GEMINI_MODEL || 'gemini-3.8-flash').trim();
  const prompt = `You are the multilingual editorial engine for World News. Rewrite ONLY the verified facts below. Never invent quotes, people, dates, numbers, locations, causes, reactions, consequences, or background. If a fact is absent, omit it. Do not mention the upstream publisher or AI in reader-facing copy.\n\nVERIFIED HEADLINE:\n${title}\n\nVERIFIED DESCRIPTION:\n${description}\n\nVERIFIED ARTICLE TEXT:\n${articleText.slice(0, 18000)}\n\nReturn valid JSON only with this exact top-level shape:\n{"translations":{"en":{},"ar":{},"de":{},"es":{},"fr":{}}}\nFor every language object include: title, slug, executiveSummary, structuredBody, seoTitle, metaDescription, keywords (array), tags (array), imageAlt, faq (array), entities (array). Arabic must be Modern Standard Arabic. All five editions must preserve exactly the same facts and uncertainty.`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.15, maxOutputTokens: 8192 },
    }),
    signal: AbortSignal.timeout(30000),
  });
  const raw = await response.text();
  let envelope: any;
  try { envelope = JSON.parse(raw); } catch { throw new Error(`Gemini returned non-JSON HTTP response (${response.status}).`); }
  if (!response.ok) throw new Error(`Gemini ${response.status}: ${envelope?.error?.message || raw.slice(0, 300)}`);
  const text = envelope?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
  if (!text) throw new Error('Gemini returned an empty editorial response.');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Gemini editorial response did not contain a JSON object.');
  const parsed = JSON.parse(text.slice(start, end + 1));
  if (!parsed?.translations) throw new Error('Gemini editorial response is missing translations.');
  return parsed.translations;
}

async function writeLog(source: string, status: 'success' | 'failed' | 'warning', importedCount: number, errorMessage: string | null) {
  const now = new Date().toISOString();
  const entry = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    jobType: 'rss_sync',
    source,
    startedAt: now,
    completedAt: now,
    status,
    errorMessage,
    importedCount,
  };
  await upsert(TABLES.logs, entry.id, entry);
}

async function processSource(source: any, existingArticles: any[], maxNew: number) {
  const diagnostics: string[] = [];
  let imported = 0;
  try {
    const xml = await fetchText(source.rssUrl, 9000, 'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*');
    const items = parseFeed(xml).sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
    if (!items.length) throw new Error('Feed returned no parseable RSS/Atom items.');

    for (const item of items.slice(0, 12)) {
      if (imported >= maxNew) break;
      if (existingArticles.some((a) => a.originalUrl === item.link)) continue;
      const itemDate = new Date(item.pubDate);
      if (Number.isFinite(itemDate.getTime()) && Date.now() - itemDate.getTime() > 7 * 86400000) continue;

      try {
        let page = { description: '', imageUrl: '', articleText: '' };
        try { page = extractPage(await fetchText(item.link, 9000)); } catch (e: any) { diagnostics.push(`${item.title}: page extraction warning: ${e?.message || e}`); }
        const description = page.description || item.description || item.content || item.title;
        const sourceText = (page.articleText || item.content || item.description || '').trim();
        if (sourceText.length < 120) {
          diagnostics.push(`${item.title}: skipped because verified source text was too short.`);
          continue;
        }

        const generated = await generateTranslations(item.title, description, sourceText);
        const id = `art-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        const translations: Record<string, any> = {};
        for (const lang of LANGS) translations[lang] = normalizeTranslation(lang, generated[lang], item.title, id);
        const complete = LANGS.every((lang) => translations[lang].translationStatus === 'complete');
        const article = {
          id,
          category: source.category || 'world',
          editorialType: 'ai-assisted',
          originalSource: source.name,
          originalUrl: item.link,
          originalDescription: description,
          officialImageUrl: page.imageUrl || item.imageUrl || undefined,
          image: page.imageUrl || item.imageUrl || '',
          imageCredit: page.imageUrl || item.imageUrl ? 'Editorial image from verified source metadata' : 'World News Visual Desk',
          imageProvenance: page.imageUrl || item.imageUrl ? 'Verified feed/article metadata' : 'No verified source image available',
          imageLicense: page.imageUrl || item.imageUrl ? 'Upstream editorial media; verify publishing rights before monetized use' : 'No external image attached',
          status: complete ? 'published' : 'review',
          isBreaking: false,
          isPinned: false,
          priority: 5,
          views: 0,
          shares: 0,
          publishedAt: Number.isFinite(itemDate.getTime()) ? itemDate.toISOString() : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          byline: 'World News International Bureau',
          translations,
          hasVideo: false,
        };

        // Persistence is the success gate: never count an article until Appwrite confirms the row.
        await upsert(TABLES.articles, article.id, article);
        existingArticles.unshift(article);
        imported += 1;
      } catch (e: any) {
        diagnostics.push(`${item.title}: ${e?.message || e}`);
      }
    }

    const updated = {
      ...source,
      lastImport: new Date().toISOString(),
      lastError: diagnostics.length ? diagnostics.slice(-3).join(' | ') : null,
      articlesCount: Number(source.articlesCount || 0) + imported,
    };
    await upsert(TABLES.sources, source.id, updated);
    return { imported, diagnostics, parsedItems: items.length };
  } catch (e: any) {
    const message = e?.message || String(e);
    await upsert(TABLES.sources, source.id, { ...source, lastError: message });
    return { imported: 0, diagnostics: [message], parsedItems: 0 };
  }
}

export default async function handler(req: any, res: any) {
  const url = new URL(req.url || '/', 'https://local');
  const action = String(url.searchParams.get('action') || 'status');
  const sourceId = url.searchParams.get('id');
  try {
    const isCron = action === 'cron';
    if (isCron) {
      const secret = String(process.env.CRON_SECRET || '');
      if (!secret || req.headers?.authorization !== `Bearer ${secret}`) return json(res, 401, { error: 'Unauthorized cron request.' });
    } else if (action !== 'status' && !isAdmin(req)) {
      return json(res, 401, { error: 'Administrator authentication required.' });
    }

    const sources = await listPayloads(TABLES.sources);
    const articles = await listPayloads(TABLES.articles);

    if (action === 'status') {
      return json(res, 200, {
        running: false,
        persistenceProvider: 'appwrite-direct',
        appwriteConfigured: Boolean(process.env.APPWRITE_API_KEY),
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
        sourcesCount: sources.length,
        activeSourcesCount: sources.filter((s) => s.isActive !== false).length,
        articlesCount: articles.length,
        lastRuns: sources.filter((s) => s.lastImport).map((s) => ({ source: s.name, lastImport: s.lastImport, lastError: s.lastError })).slice(0, 10),
      });
    }

    if (action === 'test') {
      const source = sources.find((s) => s.id === sourceId);
      if (!source) return json(res, 404, { error: 'Source not found.' });
      const started = Date.now();
      const xml = await fetchText(source.rssUrl, 9000, 'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*');
      const items = parseFeed(xml);
      return json(res, items.length ? 200 : 422, {
        success: items.length > 0,
        status: items.length ? 'active' : 'empty',
        responseTimeMs: Date.now() - started,
        parsedItems: items.length,
        sample: items.slice(0, 3).map((i) => ({ title: i.title, link: i.link, pubDate: i.pubDate, hasImage: Boolean(i.imageUrl) })),
        message: items.length ? `Connected to '${source.name}' and parsed ${items.length} feed items.` : `No RSS/Atom items could be parsed from '${source.name}'.`,
      });
    }

    const selected = action === 'import'
      ? sources.filter((s) => s.id === sourceId)
      : sources.filter((s) => s.isActive !== false);
    if (!selected.length) return json(res, 404, { error: action === 'import' ? 'Source not found.' : 'No active sources are configured.' });

    let total = 0;
    const results: any[] = [];
    // Keep serverless work bounded. Manual full run imports at most 3 articles total; single-source import at most 2.
    const totalLimit = action === 'import' ? 2 : 3;
    for (const source of selected) {
      if (total >= totalLimit) break;
      const result = await processSource(source, articles, Math.min(action === 'import' ? 2 : 1, totalLimit - total));
      total += result.imported;
      results.push({ sourceId: source.id, source: source.name, ...result });
    }

    const errors = results.flatMap((r) => r.diagnostics || []);
    await writeLog(action === 'import' ? `Single Source Ingest (${sourceId})` : 'Direct Appwrite AI Crawler', total > 0 ? 'success' : 'warning', total, total > 0 ? null : errors.slice(0, 4).join(' | ') || 'No new articles were imported.');

    return json(res, total > 0 ? 200 : 422, {
      success: total > 0,
      count: total,
      persisted: total,
      results,
      message: total > 0
        ? `Crawler fetched and persisted ${total} article(s) to Appwrite. Published articles are now available to the homepage API.`
        : `Crawler completed but did not persist an article. ${errors.slice(0, 3).join(' | ') || 'No new eligible feed items were found.'}`,
    });
  } catch (error: any) {
    console.error('[direct-crawler]', error);
    return json(res, 503, { success: false, error: error?.message || String(error), code: 'DIRECT_CRAWLER_FAILED' });
  }
}

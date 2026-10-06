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
  settings: 'newsroom_settings',
};
const LANGS = ['en', 'ar', 'de', 'es', 'fr'] as const;
type Lang = (typeof LANGS)[number];

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
  return Object.fromEntries(
    header
      .split(';')
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => {
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
  const response = await fetch(`${ENDPOINT}${path}`, {
    ...init,
    headers: { ...appwriteHeaders(), ...(init.headers || {}) },
  });
  const text = await response.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!response.ok) {
    const detail =
      typeof parsed === 'string' ? parsed : parsed?.message || JSON.stringify(parsed);
    throw new Error(`Appwrite ${response.status}: ${detail || response.statusText}`);
  }
  return parsed;
}

function tablePath(table: string): string {
  return `/tablesdb/${encodeURIComponent(DATABASE_ID)}/tables/${encodeURIComponent(table)}/rows`;
}

function query(method: string, values: unknown[] = []): string {
  return JSON.stringify({ method, values });
}

function safeRowId(id: string): string {
  if (/^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/.test(id)) return id;
  return `r_${crypto.createHash('sha256').update(id).digest('hex').slice(0, 34)}`;
}

function parsePayload(row: any): any | null {
  const raw = row?.data?.payload ?? row?.payload;
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function listPayloads(table: string): Promise<any[]> {
  const output: any[] = [];
  for (let offset = 0; ; offset += 100) {
    const qs = new URLSearchParams();
    qs.append('queries[]', query('limit', [100]));
    qs.append('queries[]', query('offset', [offset]));
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
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
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
    const match = block.match(
      new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i')
    );
    if (match?.[1]) return decodeEntities(match[1]).trim();
  }
  return '';
}

function attr(block: string, tagName: string, attrName: string): string {
  const match = block.match(
    new RegExp(`<${tagName}\\b[^>]*\\b${attrName}=["']([^"']+)["'][^>]*>`, 'i')
  );
  return match?.[1] ? decodeEntities(match[1]).trim() : '';
}

function parseFeed(xml: string): FeedItem[] {
  const rss = Array.from(xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)).map(
    (m) => m[1]
  );
  const atom = rss.length
    ? []
    : Array.from(xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)).map((m) => m[1]);
  const blocks = rss.length ? rss : atom;

  return blocks
    .map((block) => {
      let link = tag(block, ['link']);
      if (!/^https?:\/\//i.test(link)) link = attr(block, 'link', 'href');

      const enclosure = block.match(/<enclosure\b[^>]*url=["']([^"']+)["'][^>]*>/i);
      const media = block.match(
        /<(?:media:content|media:thumbnail)\b[^>]*url=["']([^"']+)["'][^>]*>/i
      );
      const enclosureType =
        block.match(/<enclosure\b[^>]*type=["']([^"']+)["'][^>]*>/i)?.[1] || '';
      const imageUrl =
        media?.[1] ||
        (enclosure &&
        (/image/i.test(enclosureType) ||
          /\.(?:jpe?g|png|webp|avif)(?:\?|$)/i.test(enclosure[1]))
          ? enclosure[1]
          : undefined);

      const rawDescription = tag(block, ['description', 'summary']);
      const rawContent = tag(block, ['content:encoded', 'content']);

      return {
        title: stripHtml(tag(block, ['title'])),
        link: link.trim(),
        pubDate:
          tag(block, ['pubDate', 'published', 'updated', 'dc:date']) ||
          new Date().toISOString(),
        description: stripHtml(rawDescription),
        content: stripHtml(rawContent || rawDescription),
        imageUrl,
      };
    })
    .filter((item) => item.title && /^https?:\/\//i.test(item.link));
}

async function fetchText(
  url: string,
  timeoutMs = 10000,
  accept = 'text/html,application/xhtml+xml,application/xml,text/xml,*/*'
): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; NewsDiscoverBot/1.0; +https://newsdiscover.example)',
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
  const a = html.match(
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      'i'
    )
  );
  const b = html.match(
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
      'i'
    )
  );
  return decodeEntities(a?.[1] || b?.[1] || '').trim();
}

function absoluteUrl(candidate: string | undefined, base: string): string {
  if (!candidate) return '';
  try {
    return new URL(candidate, base).toString();
  } catch {
    return '';
  }
}

function extractPage(html: string, pageUrl: string) {
  const description =
    meta(html, 'og:description') ||
    meta(html, 'description') ||
    meta(html, 'twitter:description');
  const imageUrl = absoluteUrl(
    meta(html, 'og:image') || meta(html, 'twitter:image'),
    pageUrl
  );
  const author =
    meta(html, 'author') ||
    meta(html, 'article:author') ||
    meta(html, 'byl');

  let articleBody = '';
  for (const script of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    try {
      const parsed = JSON.parse(decodeEntities(script[1]));
      const stack = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (stack.length) {
        const item = stack.shift();
        if (!item || typeof item !== 'object') continue;
        if (
          typeof item.articleBody === 'string' &&
          item.articleBody.length > articleBody.length
        ) {
          articleBody = item.articleBody;
        }
        if (Array.isArray(item['@graph'])) stack.push(...item['@graph']);
      }
    } catch {
      // Publisher JSON-LD can be malformed; paragraph extraction is the fallback.
    }
  }

  if (!articleBody) {
    const main =
      html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ||
      html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ||
      html;
    const paragraphs = Array.from(main.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
      .map((m) => stripHtml(m[1]))
      .filter((p) => p.length >= 30);
    articleBody = paragraphs.join('\n\n');
  }

  return {
    description: stripHtml(description),
    imageUrl,
    articleText: stripHtml(articleBody).slice(0, 18000),
    author: stripHtml(author),
  };
}

function normalizeLang(value: unknown): Lang {
  const lang = String(value || 'en').toLowerCase().slice(0, 2) as Lang;
  return LANGS.includes(lang) ? lang : 'en';
}

function slugify(value: string, fallback: string): string {
  const slug = String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || fallback;
}

function shorten(value: string, max: number): string {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const boundary = cut.lastIndexOf(' ');
  return `${(boundary > max * 0.65 ? cut.slice(0, boundary) : cut).trim()}…`;
}

function deriveKeywords(title: string, description: string): string[] {
  const stop = new Set([
    'the','and','for','with','that','this','from','into','over','after','before','about','have','has',
    'was','were','are','its','their','they','them','will','would','could','should','a','an','of','to',
    'in','on','at','by','as','is','be','or','but','not','new','latest','says','said'
  ]);
  const words = `${title} ${description}`
    .toLowerCase()
    .match(/[\p{L}\p{N}][\p{L}\p{N}-]{2,}/gu) || [];
  const counts = new Map<string, number>();
  for (const word of words) {
    if (stop.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

function emptyTranslation(lang: Lang, id: string) {
  return {
    language: lang,
    title: '',
    slug: `${id}-${lang}`,
    executiveSummary: '',
    structuredBody: '',
    seoTitle: '',
    metaDescription: '',
    keywords: [],
    tags: [],
    imageAlt: '',
    faq: [],
    translationStatus: 'draft',
    entities: [],
  };
}

function sourceTranslation(
  lang: Lang,
  id: string,
  title: string,
  description: string,
  body: string,
  imageAlt: string
) {
  const executiveSummary = shorten(description || body || title, 320);
  const metaDescription = shorten(description || body || title, 158);
  const seoTitle = shorten(title, 62);
  const keywords = deriveKeywords(title, description || body);
  return {
    language: lang,
    title,
    slug: slugify(title, id),
    executiveSummary,
    structuredBody: body || executiveSummary,
    seoTitle,
    metaDescription,
    keywords,
    tags: keywords.slice(0, 6),
    imageAlt: imageAlt || title,
    faq: [],
    translationStatus: 'complete',
    entities: [],
  };
}


function splitTranslationText(value: string, max = 3500): string[] {
  const text = String(value || '').trim();
  if (!text) return [''];
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  const pushCurrent = () => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
  };

  for (const paragraph of paragraphs.length ? paragraphs : [text]) {
    if (paragraph.length > max) {
      pushCurrent();
      const words = paragraph.split(/\s+/);
      let piece = '';
      for (const word of words) {
        const next = piece ? `${piece} ${word}` : word;
        if (next.length > max && piece) {
          chunks.push(piece);
          piece = word;
        } else {
          piece = next;
        }
      }
      if (piece) chunks.push(piece);
      continue;
    }

    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length > max) {
      pushCurrent();
      current = paragraph;
    } else {
      current = next;
    }
  }
  pushCurrent();
  return chunks.length ? chunks : [''];
}

async function translateBundle(
  sourceLang: Lang,
  targetLang: Lang,
  title: string,
  description: string,
  body: string
) {
  if (sourceLang === targetLang) return { title, description, body };

  const apiKey = String(process.env.GOOGLE_TRANSLATE_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error(
      'Translation is not configured. Set GOOGLE_TRANSLATE_API_KEY to a dedicated Google Cloud Translation API key.'
    );
  }

  const bodyChunks = splitTranslationText(body);
  const q = [title, description, ...bodyChunks];
  const response = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q,
        source: sourceLang,
        target: targetLang,
        format: 'text',
      }),
      signal: AbortSignal.timeout(30000),
    }
  );

  const raw = await response.text();
  let parsed: any = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = raw;
  }

  if (!response.ok) {
    const detail =
      typeof parsed === 'string'
        ? parsed
        : parsed?.error?.message || parsed?.message || JSON.stringify(parsed);
    throw new Error(`Cloud Translation ${response.status}: ${detail || response.statusText}`);
  }

  const translated = Array.isArray(parsed?.data?.translations)
    ? parsed.data.translations.map((item: any) => decodeEntities(item?.translatedText || ''))
    : [];

  if (translated.length < 2) {
    throw new Error('Cloud Translation returned an incomplete response.');
  }

  return {
    title: translated[0] || title,
    description: translated[1] || description,
    body: translated.slice(2).join('\n\n') || description || body,
  };
}

function configuredLanguages(settingsRows: any[]): Lang[] {
  const raw = settingsRows?.[0]?.enabledLanguages;
  if (!Array.isArray(raw)) return [...LANGS];
  const langs = raw
    .map((value: unknown) => normalizeLang(value))
    .filter((value: Lang, index: number, array: Lang[]) => array.indexOf(value) === index);
  return langs.length ? langs : [...LANGS];
}

async function writeLog(
  source: string,
  status: 'success' | 'failed' | 'warning',
  importedCount: number,
  errorMessage: string | null,
  startedAt = new Date().toISOString()
) {
  const completedAt = new Date().toISOString();
  const entry = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    jobType: 'rss_sync',
    source,
    startedAt,
    completedAt,
    status,
    errorMessage,
    importedCount,
  };
  await upsert(TABLES.logs, entry.id, entry);
  return entry;
}

async function processSource(
  source: any,
  existingArticles: any[],
  maxNew: number,
  enabledLanguages: Lang[]
) {
  const diagnostics: string[] = [];
  let imported = 0;
  const failedUrls = new Set<string>(
    Array.isArray(source.failedUrls) ? source.failedUrls.filter(Boolean) : []
  );

  try {
    const xml = await fetchText(
      source.rssUrl,
      10000,
      'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*'
    );
    const items = parseFeed(xml).sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );
    if (!items.length) throw new Error('Feed returned no parseable RSS/Atom items.');

    const existingUrls = new Set(
      existingArticles.map((article) => String(article.originalUrl || '')).filter(Boolean)
    );
    const candidates = items.filter(
      (item) => !existingUrls.has(item.link) && !failedUrls.has(item.link)
    );
    const batch = candidates.slice(0, Math.max(1, maxNew));

    for (const item of batch) {
      try {
        let page = { description: '', imageUrl: '', articleText: '', author: '' };
        try {
          page = extractPage(await fetchText(item.link, 10000), item.link);
        } catch (error: any) {
          diagnostics.push(
            `${item.title}: article-page extraction warning: ${error?.message || error}`
          );
        }

        const title = stripHtml(item.title);
        const description =
          page.description || item.description || shorten(item.content, 320) || title;
        const sourceBody =
          [page.articleText, item.content, item.description]
            .map((value) => String(value || '').trim())
            .sort((a, b) => b.length - a.length)[0] || description;

        if (!title || sourceBody.length < 40) {
          failedUrls.add(item.link);
          diagnostics.push(`${item.title}: skipped because source text was unavailable.`);
          continue;
        }

        const id = `art-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        const sourceLanguage = normalizeLang(source.defaultLanguage || source.language);
        const translations: Record<Lang, any> = Object.fromEntries(
          LANGS.map((lang) => [lang, emptyTranslation(lang, id)])
        ) as Record<Lang, any>;

        translations[sourceLanguage] = sourceTranslation(
          sourceLanguage,
          id,
          title,
          description,
          sourceBody,
          title
        );

        const targets = enabledLanguages.filter((lang) => lang !== sourceLanguage);
        const translationResults = await Promise.allSettled(
          targets.map(async (targetLang) => ({
            targetLang,
            translated: await translateBundle(
              sourceLanguage,
              targetLang,
              title,
              description,
              sourceBody
            ),
          }))
        );

        translationResults.forEach((result, index) => {
          const targetLang = targets[index];
          if (result.status === 'fulfilled') {
            const translated = result.value.translated;
            translations[targetLang] = sourceTranslation(
              targetLang,
              id,
              translated.title,
              translated.description,
              translated.body,
              translated.title
            );
          } else {
            diagnostics.push(
              `${item.title}: ${targetLang.toUpperCase()} translation pending: ${result.reason?.message || result.reason}`
            );
          }
        });

        const image =
          absoluteUrl(page.imageUrl, item.link) ||
          absoluteUrl(item.imageUrl, item.link) ||
          '';

        const article = {
          id,
          category: source.category || 'world',
          editorialType: 'original',
          originalSource: source.name,
          originalUrl: item.link,
          originalDescription: description,
          sourceLanguage,
          officialImageUrl: image || undefined,
          image,
          imageCredit: image ? source.name : '',
          imageProvenance: image ? 'Original source/feed metadata' : 'No source image available',
          imageLicense: image
            ? 'Source-provided image; publisher licensing terms apply'
            : 'No external image attached',
          status: 'published',
          isBreaking: false,
          isPinned: false,
          priority: 5,
          views: 0,
          shares: 0,
          publishedAt: Number.isFinite(new Date(item.pubDate).getTime())
            ? new Date(item.pubDate).toISOString()
            : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          byline: page.author || source.name,
          translations,
          hasVideo: false,
        };

        await upsert(TABLES.articles, article.id, article);
        existingArticles.unshift(article);
        existingUrls.add(item.link);
        imported += 1;
      } catch (error: any) {
        failedUrls.add(item.link);
        diagnostics.push(`${item.title}: ${error?.message || error}`);
      }
    }

    const remaining = Math.max(0, candidates.length - batch.length);
    const updated = {
      ...source,
      lastImport: new Date().toISOString(),
      lastError: diagnostics.length ? diagnostics.slice(-5).join(' | ') : null,
      articlesCount: Number(source.articlesCount || 0) + imported,
      failedUrls: [...failedUrls].slice(-200),
    };
    await upsert(TABLES.sources, source.id, updated);

    return { imported, diagnostics, parsedItems: items.length, remaining };
  } catch (error: any) {
    const message = error?.message || String(error);
    await upsert(TABLES.sources, source.id, { ...source, lastError: message });
    return { imported: 0, diagnostics: [message], parsedItems: 0, remaining: 0 };
  }
}

async function backfillPendingTranslations(
  articles: any[],
  enabledLanguages: Lang[],
  maxArticles = 2
) {
  const translationConfigured = Boolean(process.env.GOOGLE_TRANSLATE_API_KEY);
  if (!translationConfigured) {
    return {
      updated: 0,
      remaining: articles.filter((article) =>
        enabledLanguages.some(
          (lang) => !article?.translations?.[lang]?.title || article?.translations?.[lang]?.translationStatus !== 'complete'
        )
      ).length,
      diagnostics: ['Translation provider is not configured.'],
      configured: false,
    };
  }

  const pending = articles.filter((article) =>
    enabledLanguages.some(
      (lang) =>
        !article?.translations?.[lang]?.title ||
        article?.translations?.[lang]?.translationStatus !== 'complete'
    )
  );
  const batch = pending.slice(0, Math.max(1, maxArticles));
  const diagnostics: string[] = [];
  let updated = 0;

  for (const article of batch) {
    const sourceLanguage = normalizeLang(article.sourceLanguage || 'en');
    const source =
      article?.translations?.[sourceLanguage] ||
      LANGS.map((lang) => article?.translations?.[lang]).find((item) => item?.title);

    if (!source?.title) {
      diagnostics.push(`${article.id}: missing source-language translation data.`);
      continue;
    }

    let changed = false;
    for (const targetLang of enabledLanguages) {
      if (targetLang === sourceLanguage) continue;
      const current = article?.translations?.[targetLang];
      if (current?.title && current.translationStatus === 'complete') continue;

      try {
        const translated = await translateBundle(
          sourceLanguage,
          targetLang,
          source.title,
          source.executiveSummary || article.originalDescription || source.title,
          source.structuredBody || source.executiveSummary || article.originalDescription || source.title
        );
        article.translations[targetLang] = sourceTranslation(
          targetLang,
          article.id,
          translated.title,
          translated.description,
          translated.body,
          translated.title
        );
        changed = true;
      } catch (error: any) {
        diagnostics.push(
          `${article.id}: ${targetLang.toUpperCase()} backfill failed: ${error?.message || error}`
        );
      }
    }

    if (changed) {
      article.updatedAt = new Date().toISOString();
      await upsert(TABLES.articles, article.id, article);
      updated += 1;
    }
  }

  const failedStillPending = batch.filter((article) =>
    enabledLanguages.some(
      (lang) =>
        !article?.translations?.[lang]?.title ||
        article?.translations?.[lang]?.translationStatus !== 'complete'
    )
  ).length;

  return {
    updated,
    remaining: Math.max(0, pending.length - batch.length) + failedStillPending,
    diagnostics,
    configured: true,
  };
}

export default async function handler(req: any, res: any) {
  const url = new URL(req.url || '/', 'https://local');
  const action = String(url.searchParams.get('action') || 'status');
  const sourceId = url.searchParams.get('id');
  // A batch is only a serverless work unit, not an article limit.
  // Automated schedulers keep calling while hasMore=true until every unseen item is drained.
  const defaultBatch = action === 'cron' ? 30 : action === 'import' ? 30 : 20;
  const requestedBatch = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get('batch') || defaultBatch) || defaultBatch)
  );
  const cycleStartedAt = new Date().toISOString();

  try {
    const isCron = action === 'cron';
    if (isCron) {
      const secret = String(process.env.CRON_SECRET || '');
      if (!secret || req.headers?.authorization !== `Bearer ${secret}`) {
        return json(res, 401, { error: 'Unauthorized cron request.' });
      }
    } else if (action !== 'status' && !isAdmin(req)) {
      return json(res, 401, { error: 'Administrator authentication required.' });
    }

    if (isCron && url.searchParams.get('summary') === '1') {
      const count = Math.max(0, Number(url.searchParams.get('count') || 0) || 0);
      const cycles = Math.max(0, Number(url.searchParams.get('cycles') || 0) || 0);
      const hasMore = url.searchParams.get('hasMore') === 'true';
      const startedAt = url.searchParams.get('startedAt') || cycleStartedAt;
      const log = await writeLog(
        'News Discover Hourly Fetch Summary',
        hasMore ? 'warning' : 'success',
        count,
        hasMore
          ? `Scheduler safety window ended after ${cycles} batch(es); remaining unseen items will resume next hour.`
          : `Hourly feed drain completed in ${cycles} batch(es).`,
        startedAt
      );
      return json(res, 200, {
        success: true,
        summary: true,
        importedCount: count,
        cycles,
        hasMore,
        completedAt: log.completedAt,
      });
    }

    const [sources, articles, logs, settingsRows] = await Promise.all([
      listPayloads(TABLES.sources),
      listPayloads(TABLES.articles),
      listPayloads(TABLES.logs),
      listPayloads(TABLES.settings),
    ]);
    const enabledLanguages = configuredLanguages(settingsRows);
    const sortedLogs = [...logs].sort(
      (a, b) =>
        new Date(b.completedAt || b.startedAt || 0).getTime() -
        new Date(a.completedAt || a.startedAt || 0).getTime()
    );
    const latestLog = sortedLogs[0] || null;

    if (action === 'status') {
      return json(res, 200, {
        running: false,
        persistenceProvider: 'appwrite-direct',
        ingestionMode: 'source-direct',
        appwriteConfigured: Boolean(process.env.APPWRITE_API_KEY),
        geminiRequired: false,
        translationProviderConfigured: Boolean(process.env.GOOGLE_TRANSLATE_API_KEY),
        translationProvider: process.env.GOOGLE_TRANSLATE_API_KEY
          ? 'google-cloud-translation-v2'
          : 'not-configured',
        translationBacklog: articles.filter((article) =>
          enabledLanguages.some(
            (lang) =>
              !article?.translations?.[lang]?.title ||
              article?.translations?.[lang]?.translationStatus !== 'complete'
          )
        ).length,
        enabledLanguages,
        scheduler: 'appwrite-hourly-function',
        sourcesCount: sources.length,
        activeSourcesCount: sources.filter((source) => source.isActive !== false).length,
        articlesCount: articles.length,
        totalArticlesIngested: articles.length,
        lastRunTime: latestLog?.completedAt || latestLog?.startedAt || null,
        lastImportedCount: latestLog?.importedCount || 0,
        lastRunStatus: latestLog?.status || null,
        lastRunDetails: latestLog?.errorMessage || null,
        nextRunTime: latestLog?.completedAt
          ? new Date(new Date(latestLog.completedAt).getTime() + 60 * 60 * 1000).toISOString()
          : null,
        recentLogs: sortedLogs.slice(0, 12).map((log) => ({
          timestamp: log.completedAt || log.startedAt,
          message: log.source || log.jobType || 'Crawler cycle',
          articlesAdded: Number(log.importedCount || 0),
          status: log.status,
          details: log.errorMessage || null,
        })),
        lastRuns: sources
          .filter((source) => source.lastImport)
          .map((source) => ({
            source: source.name,
            lastImport: source.lastImport,
            lastError: source.lastError,
          }))
          .slice(0, 10),
      });
    }

    if (action === 'translate') {
      const batch = Math.min(100, Math.max(1, requestedBatch));
      const translationBackfill = await backfillPendingTranslations(
        articles,
        enabledLanguages,
        batch
      );
      const log = await writeLog(
        'News Discover Translation Backfill',
        translationBackfill.remaining === 0 ? 'success' : translationBackfill.updated > 0 ? 'warning' : 'failed',
        translationBackfill.updated,
        translationBackfill.diagnostics.length
          ? translationBackfill.diagnostics.slice(0, 5).join(' | ')
          : translationBackfill.remaining
          ? `${translationBackfill.remaining} article(s) still require translation.`
          : null,
        cycleStartedAt
      );
      return json(res, translationBackfill.configured ? 200 : 422, {
        success: translationBackfill.configured,
        translatedArticles: translationBackfill.updated,
        remaining: translationBackfill.remaining,
        configured: translationBackfill.configured,
        enabledLanguages,
        completedAt: log.completedAt,
        message: translationBackfill.configured
          ? `Translated ${translationBackfill.updated} article(s); ${translationBackfill.remaining} article(s) remain in the translation backlog.`
          : 'Automatic translation is ready in code but GOOGLE_TRANSLATE_API_KEY is not configured in Vercel.',
        diagnostics: translationBackfill.diagnostics.slice(0, 10),
      });
    }

    if (action === 'test') {
      const source = sources.find((value) => value.id === sourceId);
      if (!source) return json(res, 404, { error: 'Source not found.' });
      const started = Date.now();
      const xml = await fetchText(
        source.rssUrl,
        10000,
        'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*'
      );
      const items = parseFeed(xml);
      return json(res, items.length ? 200 : 422, {
        success: items.length > 0,
        status: items.length ? 'active' : 'empty',
        responseTimeMs: Date.now() - started,
        parsedItems: items.length,
        sample: items.slice(0, 3).map((item) => ({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          hasImage: Boolean(item.imageUrl),
        })),
        message: items.length
          ? `Connected to '${source.name}' and parsed ${items.length} feed items.`
          : `No RSS/Atom items could be parsed from '${source.name}'.`,
      });
    }

    const selected =
      action === 'import'
        ? sources.filter((source) => source.id === sourceId)
        : sources.filter((source) => source.isActive !== false);

    if (!selected.length) {
      return json(res, 404, {
        error: action === 'import' ? 'Source not found.' : 'No active sources are configured.',
      });
    }

    let total = 0;
    const results: any[] = [];
    const perSourceBatch =
      action === 'import'
        ? requestedBatch
        : Math.max(1, Math.ceil(requestedBatch / Math.max(1, selected.length)));

    for (const source of selected) {
      const result = await processSource(
        source,
        articles,
        perSourceBatch,
        enabledLanguages
      );
      total += result.imported;
      results.push({ sourceId: source.id, source: source.name, ...result });
    }

    const translationBackfill = await backfillPendingTranslations(
      articles,
      enabledLanguages,
      Math.max(1, requestedBatch)
    );
    const hasMoreTranslations =
      translationBackfill.configured &&
      translationBackfill.remaining > 0 &&
      (translationBackfill.updated > 0 || translationBackfill.diagnostics.length === 0);
    const hasMore =
      results.some((result) => Number(result.remaining || 0) > 0) ||
      hasMoreTranslations;
    const errors = [
      ...results.flatMap((result) => result.diagnostics || []),
      ...translationBackfill.diagnostics,
    ];
    const log = await writeLog(
      action === 'import'
        ? `Single Source Ingest (${sourceId})`
        : action === 'cron'
        ? 'News Discover Hourly Automatic Fetch'
        : 'News Discover Manual Fetch',
      total > 0 ? 'success' : errors.length ? 'warning' : 'success',
      total,
      errors.length ? errors.slice(0, 5).join(' | ') : null,
      cycleStartedAt
    );

    return json(res, 200, {
      success: true,
      count: total,
      newArticlesCount: total,
      persisted: total,
      translatedArticles: translationBackfill.updated,
      translationBacklog: translationBackfill.remaining,
      hasMore,
      batchSize: requestedBatch,
      ingestionMode: 'source-direct-multilingual',
      enabledLanguages,
      latestFetch: {
        startedAt: log.startedAt,
        completedAt: log.completedAt,
        importedCount: log.importedCount,
        status: log.status,
      },
      results,
      message:
        total > 0
          ? `Crawler persisted ${total} article(s) in this batch. ${hasMore ? 'More unseen feed items remain and the scheduler will continue automatically.' : 'All currently available feed items are drained.'}`
          : hasMore
          ? 'This batch did not persist an article, but more unseen feed items remain for the next batch.'
          : errors.length
          ? `Crawler completed with warnings: ${errors.slice(0, 3).join(' | ')}`
          : 'Crawler is up to date; no unseen feed items remain.',
    });
  } catch (error: any) {
    console.error('[direct-crawler]', error);
    return json(res, 503, {
      success: false,
      error: error?.message || String(error),
      code: 'DIRECT_CRAWLER_FAILED',
    });
  }
}

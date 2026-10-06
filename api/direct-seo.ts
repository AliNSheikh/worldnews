export const maxDuration = 30;

const ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
const PROJECT_ID = '6ac4bf0d00093b81fef7';
const DATABASE_ID = 'worldnews';
const TABLES = {
  articles: 'newsroom_articles',
  categories: 'newsroom_categories',
  settings: 'newsroom_settings',
};
const LANGS = ['en', 'ar', 'de', 'es', 'fr'] as const;

function send(res: any, status: number, type: string, body: string) {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  res.end(body);
}

function headers(): Record<string, string> {
  const key = String(process.env.APPWRITE_API_KEY || '').trim();
  if (!key) throw new Error('APPWRITE_API_KEY is missing from the active Vercel environment.');
  return {
    'X-Appwrite-Project': PROJECT_ID,
    'X-Appwrite-Key': key,
    'X-Appwrite-Response-Format': '2.3.0',
    Accept: 'application/json',
  };
}

async function aw(path: string): Promise<any> {
  const response = await fetch(`${ENDPOINT}${path}`, { headers: headers() });
  const raw = await response.text();
  let parsed: any;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = raw;
  }
  if (!response.ok) {
    const detail = typeof parsed === 'string' ? parsed : parsed?.message || JSON.stringify(parsed);
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

function xml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function originFrom(req: any, settings: any): string {
  const configured = String(settings?.siteUrl || process.env.APP_URL || '').trim().replace(/\/$/, '');
  if (/^https?:\/\//i.test(configured)) return configured;
  const proto = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim();
  return host ? `${proto}://${host}` : 'https://newsdiscover.example';
}

function availableTranslations(article: any) {
  const entries = LANGS
    .map((lang) => [lang, article?.translations?.[lang]] as const)
    .filter(([, translation]) =>
      Boolean(
        translation?.title &&
          translation?.slug &&
          translation?.translationStatus === 'complete'
      )
    );
  if (entries.length) return entries;

  const fallback = LANGS
    .map((lang) => [lang, article?.translations?.[lang]] as const)
    .find(([, translation]) => Boolean(translation?.title && translation?.slug));
  return fallback ? [fallback] : [];
}

function absoluteImage(value: unknown, origin: string): string {
  const candidate = String(value || '').trim();
  if (!candidate) return '';
  try {
    return new URL(candidate, origin).toString();
  } catch {
    return '';
  }
}

function buildSitemap(origin: string, articles: any[], categories: any[]) {
  const urls: string[] = [];
  const now = new Date().toISOString();

  for (const lang of LANGS) {
    urls.push(
      `<url><loc>${xml(`${origin}/${lang}`)}</loc><lastmod>${now}</lastmod><changefreq>hourly</changefreq><priority>1.0</priority></url>`
    );
  }

  for (const category of categories) {
    if (category?.isActive === false || !category?.slug) continue;
    for (const lang of LANGS) {
      urls.push(
        `<url><loc>${xml(`${origin}/${lang}/category/${category.slug}`)}</loc><lastmod>${now}</lastmod><changefreq>hourly</changefreq><priority>0.8</priority></url>`
      );
    }
  }

  for (const article of articles) {
    if (article?.status !== 'published') continue;
    for (const [lang, translation] of availableTranslations(article)) {
      const loc = `${origin}/${lang}/news/${article.category || 'world'}/${translation.slug}`;
      const image = absoluteImage(article.image || article.officialImageUrl, origin);
      const imageXml = image
        ? `<image:image><image:loc>${xml(image)}</image:loc><image:title>${xml(
            translation.title
          )}</image:title></image:image>`
        : '';
      urls.push(
        `<url><loc>${xml(loc)}</loc><lastmod>${xml(
          article.updatedAt || article.publishedAt || now
        )}</lastmod><changefreq>hourly</changefreq><priority>0.9</priority>${imageXml}</url>`
      );
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join(
    '\n'
  )}\n</urlset>`;
}

function buildNewsSitemap(origin: string, articles: any[], settings: any) {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const rows: string[] = [];

  for (const article of articles) {
    if (article?.status !== 'published') continue;
    const publishedAt = new Date(article.publishedAt || 0);
    if (!Number.isFinite(publishedAt.getTime()) || publishedAt.getTime() < cutoff) continue;

    for (const [lang, translation] of availableTranslations(article)) {
      const siteName =
        settings?.names?.[lang] ||
        settings?.names?.en ||
        settings?.logoText ||
        'News Discover';
      const loc = `${origin}/${lang}/news/${article.category || 'world'}/${translation.slug}`;
      rows.push(
        `<url><loc>${xml(loc)}</loc><news:news><news:publication><news:name>${xml(
          siteName
        )}</news:name><news:language>${xml(lang)}</news:language></news:publication><news:publication_date>${xml(
          publishedAt.toISOString()
        )}</news:publication_date><news:title>${xml(
          translation.title
        )}</news:title></news:news></url>`
      );
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${rows.join(
    '\n'
  )}\n</urlset>`;
}

function buildRss(origin: string, articles: any[], settings: any, requestedLang: string) {
  const requested = LANGS.includes(requestedLang as any) ? requestedLang : 'en';
  const items: string[] = [];
  for (const article of articles
    .filter((item) => item?.status === 'published')
    .sort(
      (a, b) =>
        new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()
    )
    .slice(0, 50)) {
    const translations = availableTranslations(article);
    const selected =
      translations.find(([lang]) => lang === requested) || translations[0];
    if (!selected) continue;
    const [lang, translation] = selected;
    const link = `${origin}/${lang}/news/${article.category || 'world'}/${translation.slug}`;
    items.push(
      `<item><title>${xml(translation.title)}</title><link>${xml(
        link
      )}</link><guid isPermaLink="true">${xml(link)}</guid><pubDate>${xml(
        new Date(article.publishedAt || Date.now()).toUTCString()
      )}</pubDate><description>${xml(
        translation.metaDescription || translation.executiveSummary || ''
      )}</description></item>`
    );
  }

  const name =
    settings?.names?.[requested] || settings?.names?.en || settings?.logoText || 'News Discover';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${xml(
    name
  )}</title><link>${xml(origin)}</link><description>${xml(
    settings?.descriptions?.[requested] ||
      settings?.descriptions?.en ||
      'Latest news from News Discover'
  )}</description><language>${xml(requested)}</language>${items.join(
    ''
  )}</channel></rss>`;
}

export default async function handler(req: any, res: any) {
  try {
    const url = new URL(req.url || '/', 'https://local');
    const kind = String(url.searchParams.get('kind') || 'sitemap');
    const [articles, categories, settingsRows] = await Promise.all([
      listPayloads(TABLES.articles),
      listPayloads(TABLES.categories),
      listPayloads(TABLES.settings),
    ]);
    const settings = settingsRows[0] || {};
    const origin = originFrom(req, settings);

    if (kind === 'robots') {
      return send(
        res,
        200,
        'text/plain; charset=utf-8',
        `User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${origin}/sitemap.xml\nSitemap: ${origin}/news-sitemap.xml\n`
      );
    }

    if (kind === 'news-sitemap') {
      return send(
        res,
        200,
        'application/xml; charset=utf-8',
        buildNewsSitemap(origin, articles, settings)
      );
    }

    if (kind === 'rss') {
      return send(
        res,
        200,
        'application/rss+xml; charset=utf-8',
        buildRss(origin, articles, settings, String(url.searchParams.get('lang') || 'en'))
      );
    }

    return send(
      res,
      200,
      'application/xml; charset=utf-8',
      buildSitemap(origin, articles, categories)
    );
  } catch (error: any) {
    console.error('[direct-seo]', error);
    return send(
      res,
      503,
      'application/json; charset=utf-8',
      JSON.stringify({
        error: error?.message || String(error),
        code: 'DIRECT_SEO_FAILED',
      })
    );
  }
}

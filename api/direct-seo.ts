import { createClient } from '@libsql/client';

export const maxDuration = 30;
const DEFAULT_ORIGIN = 'https://www.newsdiscover.org';

function clean(value: string | undefined): string {
  return String(value || '').trim().replace(/^['"]+|['"]+$/g, '');
}

function send(res: any, status: number, type: string, body: string) {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  res.end(body);
}

function xml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parsePayload(value: unknown): any {
  if (value && typeof value === 'object') return value;
  return JSON.parse(String(value || '{}'));
}

function connection() {
  const url = clean(process.env.TURSO_DATABASE_URL);
  const authToken = clean(process.env.TURSO_AUTH_TOKEN || process.env.TURSO_DATABASE_AUTH_TOKEN);
  if (!url || !authToken) throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required.');
  return createClient({ url, authToken });
}

function originFrom(req: any, settings: any): string {
  const configured = String(settings?.siteUrl || process.env.APP_URL || '').trim().replace(/\/$/, '');
  if (/^https?:\/\//i.test(configured)) return configured;
  const proto = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim();
  return host ? proto + '://' + host : DEFAULT_ORIGIN;
}

function iso(value: unknown): string {
  const time = new Date(String(value || '')).getTime();
  return Number.isFinite(time) && time > 0 ? new Date(time).toISOString() : new Date().toISOString();
}

function latestModified(articles: any[]): string {
  const times = articles
    .flatMap((article) => [article.updatedAt, article.publishedAt])
    .map((value) => new Date(value || 0).getTime())
    .filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)).toISOString() : new Date().toISOString();
}

function sitemapIndex(origin: string, articles: any[]): string {
  const articleLastmod = latestModified(articles);
  const now = new Date().toISOString();
  const entries = [
    [origin + '/post-sitemap.xml', articleLastmod],
    [origin + '/page-sitemap.xml', now],
    [origin + '/category-sitemap.xml', now],
    [origin + '/news-sitemap.xml', articleLastmod],
  ];
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.map(([loc, lastmod]) =>
      '  <sitemap><loc>' + xml(loc) + '</loc><lastmod>' + xml(lastmod) + '</lastmod></sitemap>'
    ).join('\n') +
    '\n</sitemapindex>';
}

function postSitemap(origin: string, articles: any[]): string {
  const urls = articles.map((article) => {
    const t = article?.translations?.en;
    if (!t?.slug) return '';
    const loc = origin + '/news/' + article.category + '/' + t.slug;
    const image = String(article.image || article.officialImageUrl || '').trim();
    const imageXml = image
      ? '<image:image><image:loc>' + xml(image) + '</image:loc><image:title>' + xml(t.title || '') + '</image:title></image:image>'
      : '';
    return '  <url><loc>' + xml(loc) + '</loc><lastmod>' + xml(iso(article.updatedAt || article.publishedAt)) +
      '</lastmod><changefreq>hourly</changefreq><priority>0.9</priority>' + imageXml + '</url>';
  }).filter(Boolean);

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
    urls.join('\n') + '\n</urlset>';
}

function pageSitemap(origin: string): string {
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    '  <url><loc>' + xml(origin + '/') + '</loc><lastmod>' + xml(new Date().toISOString()) +
    '</lastmod><changefreq>hourly</changefreq><priority>1.0</priority></url>\n</urlset>';
}

function categorySitemap(origin: string, categories: any[]): string {
  const now = new Date().toISOString();
  const urls = categories
    .filter((category) => category?.isVisible !== false && !category?.seoNoIndex && category?.slug)
    .map((category) =>
      '  <url><loc>' + xml(origin + '/category/' + category.slug) + '</loc><lastmod>' + xml(now) +
      '</lastmod><changefreq>hourly</changefreq><priority>0.8</priority></url>'
    );
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join('\n') + '\n</urlset>';
}

function newsSitemap(origin: string, articles: any[], publicationName: string): string {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const urls = articles
    .filter((article) => new Date(article?.publishedAt || 0).getTime() >= cutoff)
    .slice(0, 1000)
    .map((article) => {
      const t = article?.translations?.en;
      if (!t?.slug || !t?.title) return '';
      const loc = origin + '/news/' + article.category + '/' + t.slug;
      const keywords = Array.isArray(t.keywords) && t.keywords.length
        ? '<news:keywords>' + xml(t.keywords.join(', ')) + '</news:keywords>'
        : '';
      return '  <url><loc>' + xml(loc) + '</loc><news:news><news:publication><news:name>' +
        xml(publicationName) + '</news:name><news:language>en</news:language></news:publication>' +
        '<news:publication_date>' + xml(iso(article.publishedAt)) + '</news:publication_date>' +
        '<news:title>' + xml(t.title) + '</news:title>' + keywords + '</news:news></url>';
    })
    .filter(Boolean);

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n' +
    urls.join('\n') + '\n</urlset>';
}

function rss(origin: string, articles: any[], settings: any): string {
  const title = settings?.names?.en || 'News Discover';
  const description = settings?.descriptions?.en || settings?.homepageSeoDescription || 'Latest international news from News Discover';
  const items = articles.slice(0, 50).map((article) => {
    const t = article?.translations?.en;
    if (!t?.slug) return '';
    const link = origin + '/news/' + article.category + '/' + t.slug;
    return '<item><title>' + xml(t.title || '') + '</title><link>' + xml(link) +
      '</link><guid isPermaLink="true">' + xml(link) + '</guid><pubDate>' +
      new Date(article.publishedAt || Date.now()).toUTCString() + '</pubDate><description>' +
      xml(t.executiveSummary || t.metaDescription || '') + '</description></item>';
  }).filter(Boolean);

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0"><channel><title>' + xml(title) + '</title><link>' + xml(origin) +
    '</link><description>' + xml(description) + '</description><language>en</language>' +
    items.join('') + '</channel></rss>';
}

function robots(origin: string): string {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api/',
    '',
    'User-agent: Googlebot-News',
    'Allow: /',
    'Allow: /news-sitemap.xml',
    'Disallow: /admin',
    'Disallow: /api/',
    '',
    'Sitemap: ' + origin + '/sitemap.xml',
    'Sitemap: ' + origin + '/post-sitemap.xml',
    'Sitemap: ' + origin + '/category-sitemap.xml',
    'Sitemap: ' + origin + '/news-sitemap.xml',
    '',
  ].join('\n');
}

export default async function handler(req: any, res: any) {
  let stage = 'request-init';
  try {
    const requestUrl = new URL(req.url || '/', 'https://local');
    const kind = String(requestUrl.searchParams.get('kind') || 'sitemap-index');

    stage = 'connect-turso';
    const db = connection();

    stage = 'read-settings';
    const settingsResult = await db.execute("SELECT payload FROM newsroom_settings WHERE id = 'default' LIMIT 1");
    const settings = settingsResult.rows.length ? parsePayload(settingsResult.rows[0].payload) : {};

    stage = 'read-categories';
    const categoryResult = await db.execute('SELECT payload FROM newsroom_categories');
    const categories = categoryResult.rows.map((row: any) => parsePayload(row.payload));

    stage = 'read-published-articles';
    const articleResult = await db.execute(
      "SELECT payload FROM newsroom_articles WHERE status = 'published' ORDER BY datetime(coalesce(published_at, updated_at)) DESC LIMIT 5000"
    );
    const articles = articleResult.rows.map((row: any) => parsePayload(row.payload));

    const origin = originFrom(req, settings);
    const publicationName = settings?.names?.en || 'News Discover';

    if (kind === 'robots') return send(res, 200, 'text/plain; charset=utf-8', robots(origin));
    if (kind === 'post-sitemap') return send(res, 200, 'application/xml; charset=utf-8', postSitemap(origin, articles));
    if (kind === 'page-sitemap') return send(res, 200, 'application/xml; charset=utf-8', pageSitemap(origin));
    if (kind === 'category-sitemap') return send(res, 200, 'application/xml; charset=utf-8', categorySitemap(origin, categories));
    if (kind === 'news-sitemap') return send(res, 200, 'application/xml; charset=utf-8', newsSitemap(origin, articles, publicationName));
    if (kind === 'rss') return send(res, 200, 'application/rss+xml; charset=utf-8', rss(origin, articles, settings));
    return send(res, 200, 'application/xml; charset=utf-8', sitemapIndex(origin, articles));
  } catch (error: any) {
    console.error('[direct-seo]', stage, error);
    return send(res, 503, 'application/json; charset=utf-8', JSON.stringify({
      code: 'DIRECT_TURSO_SEO_FAILED',
      stage,
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    }));
  }
}

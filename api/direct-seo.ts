import type { Article, Category, SiteSettings } from '../src/types';

export const maxDuration = 30;
const DEFAULT_ORIGIN = 'https://www.newsdiscover.org';

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

function originFrom(req: any, settings: SiteSettings | null): string {
  const configured = String(settings?.siteUrl || process.env.APP_URL || '')
    .trim()
    .replace(/\/$/, '');
  if (/^https?:\/\//i.test(configured)) return configured;

  const proto = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '')
    .split(',')[0]
    .trim();
  return host ? proto + '://' + host : DEFAULT_ORIGIN;
}

function iso(value: string | undefined): string {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) && timestamp > 0
    ? new Date(timestamp).toISOString()
    : new Date().toISOString();
}

function latestArticleModified(articles: Article[]): string {
  const timestamps = articles
    .flatMap((article) => [article.updatedAt, article.publishedAt])
    .map((value) => new Date(value || 0).getTime())
    .filter(Number.isFinite);

  return timestamps.length
    ? new Date(Math.max(...timestamps)).toISOString()
    : new Date().toISOString();
}

function buildSitemapIndex(origin: string, articles: Article[]): string {
  const articleLastmod = latestArticleModified(articles);
  const now = new Date().toISOString();
  const entries = [
    { loc: origin + '/post-sitemap.xml', lastmod: articleLastmod },
    { loc: origin + '/page-sitemap.xml', lastmod: now },
    { loc: origin + '/category-sitemap.xml', lastmod: now },
    { loc: origin + '/news-sitemap.xml', lastmod: articleLastmod },
  ];

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries
      .map(
        (entry) =>
          '  <sitemap><loc>' + xml(entry.loc) + '</loc><lastmod>' +
          xml(entry.lastmod) + '</lastmod></sitemap>'
      )
      .join('\n') +
    '\n</sitemapindex>';
}

function buildPostSitemap(origin: string, articles: Article[]): string {
  const urls = articles
    .map((article) => {
      const translation = article.translations?.en;
      if (!translation?.slug) return '';
      const image = String(article.image || article.officialImageUrl || '').trim();
      const imageXml = image
        ? '<image:image><image:loc>' + xml(image) + '</image:loc><image:title>' +
          xml(translation.title) + '</image:title></image:image>'
        : '';

      return '  <url><loc>' +
        xml(origin + '/news/' + article.category + '/' + translation.slug) +
        '</loc><lastmod>' + xml(iso(article.updatedAt || article.publishedAt)) +
        '</lastmod><changefreq>hourly</changefreq><priority>0.9</priority>' +
        imageXml + '</url>';
    })
    .filter(Boolean);

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
    'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
    urls.join('\n') +
    '\n</urlset>';
}

function buildPageSitemap(origin: string): string {
  const now = new Date().toISOString();
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    '  <url><loc>' + xml(origin + '/') + '</loc><lastmod>' + xml(now) +
    '</lastmod><changefreq>hourly</changefreq><priority>1.0</priority></url>\n' +
    '</urlset>';
}

function buildCategorySitemap(origin: string, categories: Category[]): string {
  const now = new Date().toISOString();
  const urls = categories
    .filter((category) => category.isVisible !== false && !category.seoNoIndex && category.slug)
    .map(
      (category) =>
        '  <url><loc>' + xml(origin + '/category/' + category.slug) +
        '</loc><lastmod>' + xml(now) +
        '</lastmod><changefreq>hourly</changefreq><priority>0.8</priority></url>'
    );

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join('\n') +
    '\n</urlset>';
}

function buildNewsSitemap(origin: string, articles: Article[], publicationName: string): string {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const urls = articles
    .filter((article) => new Date(article.publishedAt).getTime() >= cutoff)
    .map((article) => {
      const translation = article.translations?.en;
      if (!translation?.slug || !translation.title) return '';
      return '  <url><loc>' +
        xml(origin + '/news/' + article.category + '/' + translation.slug) +
        '</loc><news:news><news:publication><news:name>' +
        xml(publicationName) +
        '</news:name><news:language>en</news:language></news:publication>' +
        '<news:publication_date>' + xml(iso(article.publishedAt)) +
        '</news:publication_date><news:title>' + xml(translation.title) +
        '</news:title></news:news></url>';
    })
    .filter(Boolean);

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
    'xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n' +
    urls.join('\n') +
    '\n</urlset>';
}

function buildRss(origin: string, articles: Article[], settings: SiteSettings | null): string {
  const title = settings?.names?.en || 'News Discover';
  const description =
    settings?.descriptions?.en ||
    settings?.homepageSeoDescription ||
    'Latest international news from News Discover';

  const items = articles.slice(0, 50).map((article) => {
    const translation = article.translations?.en;
    if (!translation?.slug) return '';
    const link = origin + '/news/' + article.category + '/' + translation.slug;
    return '<item><title>' + xml(translation.title) + '</title><link>' + xml(link) +
      '</link><guid isPermaLink="true">' + xml(link) + '</guid><pubDate>' +
      new Date(article.publishedAt).toUTCString() + '</pubDate><description>' +
      xml(translation.executiveSummary || translation.metaDescription || '') +
      '</description></item>';
  }).filter(Boolean);

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0"><channel><title>' + xml(title) + '</title><link>' +
    xml(origin) + '</link><description>' + xml(description) +
    '</description><language>en</language>' + items.join('') + '</channel></rss>';
}

function buildRobots(origin: string): string {
  return [
    'User-agent: *',
    'Allow: /',
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
    const url = new URL(req.url || '/', 'https://local');
    const kind = String(url.searchParams.get('kind') || 'sitemap-index');

    stage = 'load-turso-repository';
    const { tursoRepository } = await import('../server/tursoRepository');

    stage = 'read-seo-data';
    const [settings, categories, articles] = await Promise.all([
      tursoRepository.getSettings(),
      tursoRepository.listCategories(),
      tursoRepository.listArticles({ status: 'published', limit: 5000, sort: 'newest' }),
    ]);

    const origin = originFrom(req, settings);
    const publicationName = settings?.names?.en || 'News Discover';

    if (kind === 'robots') {
      return send(res, 200, 'text/plain; charset=utf-8', buildRobots(origin));
    }
    if (kind === 'post-sitemap') {
      return send(res, 200, 'application/xml; charset=utf-8', buildPostSitemap(origin, articles));
    }
    if (kind === 'page-sitemap') {
      return send(res, 200, 'application/xml; charset=utf-8', buildPageSitemap(origin));
    }
    if (kind === 'category-sitemap') {
      return send(
        res,
        200,
        'application/xml; charset=utf-8',
        buildCategorySitemap(origin, categories)
      );
    }
    if (kind === 'news-sitemap') {
      return send(
        res,
        200,
        'application/xml; charset=utf-8',
        buildNewsSitemap(origin, articles, publicationName)
      );
    }
    if (kind === 'rss') {
      return send(
        res,
        200,
        'application/rss+xml; charset=utf-8',
        buildRss(origin, articles, settings)
      );
    }

    return send(
      res,
      200,
      'application/xml; charset=utf-8',
      buildSitemapIndex(origin, articles)
    );
  } catch (error: any) {
    console.error('[direct-seo]', stage, error);
    return send(
      res,
      503,
      'application/json; charset=utf-8',
      JSON.stringify({
        code: 'DIRECT_TURSO_SEO_FAILED',
        stage,
        error: {
          name: error?.name || 'Error',
          message: error?.message || String(error),
        },
      })
    );
  }
}

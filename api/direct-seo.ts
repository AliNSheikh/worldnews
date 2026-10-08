import { db } from '../server/db.js';
import { generateNewsSitemapXml, generateRobotsTxt, generateRssXml } from '../server/rss.js';

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

function originFrom(req: any): string {
  const settings = db.getSettings();
  const configured = String(settings.siteUrl || process.env.APP_URL || '')
    .trim()
    .replace(/\/$/, '');
  if (/^https?:\/\//i.test(configured)) return configured;

  const proto = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '')
    .split(',')[0]
    .trim();
  return host ? `${proto}://${host}` : DEFAULT_ORIGIN;
}

function latestArticleModified(): string {
  const timestamps = db
    .getArticles({ status: 'published' })
    .flatMap((article) => [article.updatedAt, article.publishedAt])
    .map((value) => new Date(value || 0).getTime())
    .filter(Number.isFinite);

  return timestamps.length
    ? new Date(Math.max(...timestamps)).toISOString()
    : new Date().toISOString();
}

function buildSitemapIndex(origin: string): string {
  const articleLastmod = latestArticleModified();
  const now = new Date().toISOString();
  const entries = [
    { loc: `${origin}/post-sitemap.xml`, lastmod: articleLastmod },
    { loc: `${origin}/page-sitemap.xml`, lastmod: now },
    { loc: `${origin}/category-sitemap.xml`, lastmod: now },
    { loc: `${origin}/news-sitemap.xml`, lastmod: articleLastmod },
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
    .map(
      (entry) =>
        `  <sitemap><loc>${xml(entry.loc)}</loc><lastmod>${xml(entry.lastmod)}</lastmod></sitemap>`
    )
    .join('\n')}\n</sitemapindex>`;
}

function buildPostSitemap(origin: string): string {
  const urls = db
    .getArticles({ status: 'published' })
    .map((article) => {
      const translation = article.translations.en;
      if (!translation?.slug) return '';
      const image = String(article.image || article.officialImageUrl || '').trim();
      const imageXml = image
        ? `<image:image><image:loc>${xml(image)}</image:loc><image:title>${xml(
            translation.title
          )}</image:title></image:image>`
        : '';
      return `  <url><loc>${xml(
        `${origin}/news/${article.category}/${translation.slug}`
      )}</loc><lastmod>${xml(
        new Date(article.updatedAt || article.publishedAt).toISOString()
      )}</lastmod><changefreq>hourly</changefreq><priority>0.9</priority>${imageXml}</url>`;
    })
    .filter(Boolean);

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join(
    '\n'
  )}\n</urlset>`;
}

function buildPageSitemap(origin: string): string {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${xml(
    `${origin}/`
  )}</loc><lastmod>${xml(
    now
  )}</lastmod><changefreq>hourly</changefreq><priority>1.0</priority></url>\n</urlset>`;
}

function buildCategorySitemap(origin: string): string {
  const now = new Date().toISOString();
  const urls = db
    .getCategories()
    .filter((category) => category.isVisible !== false && !category.seoNoIndex && category.slug)
    .map(
      (category) =>
        `  <url><loc>${xml(`${origin}/category/${category.slug}`)}</loc><lastmod>${xml(
          now
        )}</lastmod><changefreq>hourly</changefreq><priority>0.8</priority></url>`
    );

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join(
    '\n'
  )}\n</urlset>`;
}

export default async function handler(req: any, res: any) {
  try {
    const url = new URL(req.url || '/', 'https://local');
    const kind = String(url.searchParams.get('kind') || 'sitemap-index');

    await db.refresh(60000);
    const origin = originFrom(req);

    if (kind === 'robots') {
      return send(res, 200, 'text/plain; charset=utf-8', generateRobotsTxt(origin));
    }
    if (kind === 'post-sitemap') {
      return send(res, 200, 'application/xml; charset=utf-8', buildPostSitemap(origin));
    }
    if (kind === 'page-sitemap') {
      return send(res, 200, 'application/xml; charset=utf-8', buildPageSitemap(origin));
    }
    if (kind === 'category-sitemap') {
      return send(res, 200, 'application/xml; charset=utf-8', buildCategorySitemap(origin));
    }
    if (kind === 'news-sitemap') {
      return send(res, 200, 'application/xml; charset=utf-8', generateNewsSitemapXml(origin));
    }
    if (kind === 'rss') {
      return send(res, 200, 'application/rss+xml; charset=utf-8', generateRssXml(origin, 'en'));
    }

    return send(res, 200, 'application/xml; charset=utf-8', buildSitemapIndex(origin));
  } catch (error: any) {
    console.error('[direct-seo]', error);
    return send(
      res,
      503,
      'application/json; charset=utf-8',
      JSON.stringify({
        error: error?.message || String(error),
        code: 'DIRECT_TURSO_SEO_FAILED',
      })
    );
  }
}

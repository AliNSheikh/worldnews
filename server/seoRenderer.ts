import { db } from './db';
import { LanguageCode } from '../src/types';

const LANGUAGES: LanguageCode[] = ['ar', 'en', 'de', 'es', 'fr'];

function esc(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function absolute(origin: string, path: string): string {
  return origin.replace(/\/$/, '') + (path.startsWith('/') ? path : '/' + path);
}

export function renderSeoDocument(template: string, origin: string, requestPath: string): string {
  const settings = db.getSettings();
  const parts = requestPath.split('?')[0].split('/').filter(Boolean);
  const lang = (LANGUAGES.includes(parts[0] as LanguageCode) ? parts[0] : settings.defaultLanguage || 'en') as LanguageCode;

  let title = settings.names[lang] || 'World News';
  let description = settings.descriptions[lang] || 'International news and analysis.';
  let canonicalPath = '/' + lang;
  let image = '';
  let type = 'website';
  let jsonLd: Record<string, unknown> | null = null;
  let keywords: string[] = [];
  let hreflangs: Array<{ lang: string; href: string }> = LANGUAGES.map((code) => ({
    lang: code,
    href: absolute(origin, '/' + code),
  }));

  if (parts[1] === 'news' && parts[3]) {
    const slug = parts[3];
    const article = db.getArticleBySlug(slug);
    if (article && article.status === 'published') {
      const trans = article.translations[lang] || article.translations.en;
      title = trans.seoTitle || trans.title;
      description = trans.metaDescription || trans.executiveSummary;
      canonicalPath = '/' + lang + '/news/' + article.category + '/' + trans.slug;
      image = article.image || article.officialImageUrl || '';
      type = 'article';
      keywords = trans.keywords || [];
      hreflangs = LANGUAGES.map((code) => {
        const alt = article.translations[code] || article.translations.en;
        return {
          lang: code,
          href: absolute(origin, '/' + code + '/news/' + article.category + '/' + alt.slug),
        };
      });

      jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: trans.title,
        description,
        image: image ? [image] : undefined,
        datePublished: article.publishedAt,
        dateModified: article.updatedAt || article.publishedAt,
        inLanguage: lang,
        mainEntityOfPage: absolute(origin, canonicalPath),
        author: {
          '@type': 'Organization',
          name: settings.names[lang] || 'World News',
        },
        publisher: {
          '@type': 'NewsMediaOrganization',
          name: settings.names[lang] || 'World News',
          url: origin,
        },
        articleSection: article.category,
        keywords: trans.keywords || [],
      };
    }
  } else if (parts[1] === 'category' && parts[2]) {
    const category = db.getCategories().find((item) => item.slug === parts[2]);
    if (category) {
      title = category.names[lang] + ' | ' + (settings.names[lang] || 'World News');
      description = category.descriptions[lang] || description;
      canonicalPath = '/' + lang + '/category/' + category.slug;
      hreflangs = LANGUAGES.map((code) => ({
        lang: code,
        href: absolute(origin, '/' + code + '/category/' + category.slug),
      }));
    }
  }

  const canonical = absolute(origin, canonicalPath);
  const verification = settings.googleSearchConsoleVerification || '';
  const verificationContent = verification.replace(/^google-site-verification=/i, '').trim();

  const tags = [
    '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">',
    '<meta name="googlebot" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">',
    verificationContent ? '<meta name="google-site-verification" content="' + esc(verificationContent) + '">' : '',
    keywords.length ? '<meta name="keywords" content="' + esc(keywords.join(', ')) + '">' : '',
    '<link rel="canonical" href="' + esc(canonical) + '">',
    ...hreflangs.map((item) => '<link rel="alternate" hreflang="' + item.lang + '" href="' + esc(item.href) + '">'),
    '<link rel="alternate" hreflang="x-default" href="' + esc(hreflangs.find((item) => item.lang === 'en')?.href || canonical) + '">',
    '<meta property="og:type" content="' + type + '">',
    '<meta property="og:title" content="' + esc(title) + '">',
    '<meta property="og:description" content="' + esc(description) + '">',
    '<meta property="og:url" content="' + esc(canonical) + '">',
    image ? '<meta property="og:image" content="' + esc(image) + '">' : '',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + esc(title) + '">',
    '<meta name="twitter:description" content="' + esc(description) + '">',
    image ? '<meta name="twitter:image" content="' + esc(image) + '">' : '',
    jsonLd ? '<script type="application/ld+json" data-seo="server">' + safeJson(jsonLd) + '</script>' : '',
  ].filter(Boolean).join('\n');

  let html = template.replace(/<title>[\s\S]*?<\/title>/i, '<title>' + esc(title) + '</title>');

  const metaDescription = '<meta name="description" content="' + esc(description) + '">';
  if (/<meta\s+name=["']description["'][^>]*>/i.test(html)) {
    html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, metaDescription);
  } else {
    html = html.replace('</head>', metaDescription + '\n</head>');
  }

  html = html.replace('</head>', tags + '\n</head>');
  return html;
}

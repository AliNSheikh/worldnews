import { Article, Category, LanguageCode, SiteSettings } from '../types';

export function updatePageSEO(options: {
  title: string;
  description: string;
  lang: LanguageCode;
  canonicalPath: string;
  image?: string;
  type?: 'website' | 'article';
  article?: Article;
  category?: Category;
  siteSettings: SiteSettings;
}) {
  const { title, description, lang, canonicalPath, image, type = 'website', article, category, siteSettings } = options;

  // Title
  document.title = `${title} | ${siteSettings.names[lang] || 'World News'}`;

  // Direction & Language attribute on <html>
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  // Base URL
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://worldnews.org';
  const canonicalUrl = `${origin}${canonicalPath}`;

  // Helper to upsert meta tags
  const setMeta = (name: string, content: string, isProperty = false) => {
    const attr = isProperty ? 'property' : 'name';
    let el = document.querySelector(`meta[${attr}="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  // Standard Meta
  setMeta('description', description);

  // Google Search Console Verification
  if (siteSettings.googleSearchConsoleVerification) {
    // Strip google-site-verification= prefix if user pasted the entire content attribute
    const gscContent = siteSettings.googleSearchConsoleVerification.replace(/^google-site-verification=/, '').trim();
    if (gscContent) {
      setMeta('google-site-verification', gscContent);
    }
  }

  // Google News and Search Indexing Directives
  setMeta('robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  setMeta('googlebot', 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
  setMeta('googlebot-news', 'index, follow');

  // Google News Keywords
  if (article) {
    const trans = article.translations[lang] || article.translations.en;
    if (trans.keywords && trans.keywords.length > 0) {
      setMeta('news_keywords', trans.keywords.join(', '));
      setMeta('keywords', trans.keywords.join(', '));
    }
  }

  // OpenGraph
  setMeta('og:title', title, true);
  setMeta('og:description', description, true);
  setMeta('og:type', type, true);
  setMeta('og:url', canonicalUrl, true);
  setMeta('og:site_name', siteSettings.names[lang] || 'World News', true);
  if (image) {
    setMeta('og:image', image, true);
  }

  // Twitter Cards
  setMeta('twitter:card', 'summary_large_image');
  setMeta('twitter:title', title);
  setMeta('twitter:description', description);
  if (image) {
    setMeta('twitter:image', image);
  }

  // Canonical Link
  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', canonicalUrl);

  // Hreflang Tags for all 5 languages
  const existingHreflangs = document.querySelectorAll('link[rel="alternate"][hreflang]');
  existingHreflangs.forEach((el) => el.remove());

  const languages: LanguageCode[] = ['ar', 'en', 'de', 'es', 'fr'];
  languages.forEach((code) => {
    const link = document.createElement('link');
    link.setAttribute('rel', 'alternate');
    link.setAttribute('hreflang', code);

    // Build localized path
    let localizedPath = canonicalPath;
    if (article) {
      const trans = article.translations[code];
      const catSlug = article.category;
      localizedPath = `/${code}/news/${catSlug}/${trans?.slug || article.translations.en.slug}`;
    } else if (category) {
      localizedPath = `/${code}/category/${category.slug}`;
    } else {
      localizedPath = `/${code}`;
    }

    link.setAttribute('href', `${origin}${localizedPath}`);
    document.head.appendChild(link);
  });

  // x-default hreflang
  const defaultLink = document.createElement('link');
  defaultLink.setAttribute('rel', 'alternate');
  defaultLink.setAttribute('hreflang', 'x-default');
  defaultLink.setAttribute('href', `${origin}/en`);
  document.head.appendChild(defaultLink);

  // Structured Data (JSON-LD)
  const existingJsonLd = document.querySelectorAll('script[type="application/ld+json"][data-seo="dynamic"]');
  existingJsonLd.forEach((el) => el.remove());

  // 1. Publisher Organization Schema
  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    name: siteSettings.names[lang] || 'World News',
    url: origin,
    logo: {
      '@type': 'ImageObject',
      url: `${origin}/icon.svg`,
    },
    publishingPrinciples: `${origin}/${lang}/disclaimer`,
    ethicsPolicy: `${origin}/${lang}/standards`,
    contactPoint: {
      '@type': 'ContactPoint',
      email: siteSettings.contactInfo.email,
      telephone: siteSettings.contactInfo.phone,
      contactType: 'editorial newsroom',
    },
  };

  injectJsonLd(orgSchema);

  // 2. NewsArticle Schema if on article page
  if (article) {
    const trans = article.translations[lang] || article.translations.en;
    const articleSchema: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: trans.title,
      description: trans.metaDescription || trans.executiveSummary,
      image: [article.image],
      datePublished: article.publishedAt,
      dateModified: article.updatedAt,
      inLanguage: lang,
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': canonicalUrl,
      },
      author: [
        {
          '@type': 'Person',
          name: article.byline,
        },
      ],
      publisher: {
        '@type': 'NewsMediaOrganization',
        name: siteSettings.names[lang] || 'World News',
        url: origin,
      },
      articleSection: article.category,
      keywords: trans.keywords?.join(', '),
    };

    injectJsonLd(articleSchema);

    // 3. BreadcrumbList Schema
    const breadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: siteSettings.names[lang] || 'Front Page',
          item: `${origin}/${lang}`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: category?.names[lang] || article.category,
          item: `${origin}/${lang}/category/${article.category}`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: trans.title,
          item: canonicalUrl,
        },
      ],
    };
    injectJsonLd(breadcrumbSchema);

    // 4. FAQ Schema if article has FAQs
    if (trans.faq && trans.faq.length > 0) {
      const faqSchema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: trans.faq.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      };
      injectJsonLd(faqSchema);
    }
  }
}

function injectJsonLd(data: object) {
  const script = document.createElement('script');
  script.setAttribute('type', 'application/ld+json');
  script.setAttribute('data-seo', 'dynamic');
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

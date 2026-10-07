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
  document.title = `${title} | ${siteSettings.names[lang] || 'News Discover'}`;

  // Direction & Language attribute on <html>
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  // Base URL
  const configuredOrigin = String(siteSettings.siteUrl || '').trim().replace(/\/$/, '');
  const origin = /^https?:\/\//i.test(configuredOrigin)
    ? configuredOrigin
    : typeof window !== 'undefined'
    ? window.location.origin
    : 'https://newsdiscover.example';
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
  if (category?.seoKeywords?.length) {
    setMeta('keywords', category.seoKeywords.join(', '));
  }

  // Google Search Console Verification
  if (siteSettings.googleSearchConsoleVerification) {
    // Strip google-site-verification= prefix if user pasted the entire content attribute
    const gscContent = siteSettings.googleSearchConsoleVerification.replace(/^google-site-verification=/, '').trim();
    if (gscContent) {
      setMeta('google-site-verification', gscContent);
    }
  }

  // Google News and Search Indexing Directives
  const robotsDirective = category?.seoNoIndex
    ? 'noindex, follow'
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  setMeta('robots', robotsDirective);
  setMeta('googlebot', robotsDirective);
  setMeta('googlebot-news', 'index, follow');

  // Google News Keywords
  if (article) {
    const trans = article.translations[lang] || article.translations.en;
    if (trans.keywords && trans.keywords.length > 0) {
      setMeta('news_keywords', trans.keywords.join(', '));
      setMeta('keywords', trans.keywords.join(', '));
    }

    document.querySelectorAll('meta[property="article:tag"][data-seo="dynamic-tag"]').forEach((el) => el.remove());
    (trans.tags || trans.keywords || []).slice(0, 8).forEach((tag) => {
      const tagMeta = document.createElement('meta');
      tagMeta.setAttribute('property', 'article:tag');
      tagMeta.setAttribute('content', tag);
      tagMeta.setAttribute('data-seo', 'dynamic-tag');
      document.head.appendChild(tagMeta);
    });
  }

  // OpenGraph
  setMeta('og:title', title, true);
  setMeta('og:description', description, true);
  setMeta('og:type', type, true);
  setMeta('og:url', canonicalUrl, true);
  setMeta('og:site_name', siteSettings.names[lang] || 'News Discover', true);
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

  // English-only edition: remove legacy alternate-language hreflang tags.
  const existingHreflangs = document.querySelectorAll('link[rel="alternate"][hreflang]');
  existingHreflangs.forEach((el) => el.remove());

  const englishAlternate = document.createElement('link');
  englishAlternate.setAttribute('rel', 'alternate');
  englishAlternate.setAttribute('hreflang', 'en');
  englishAlternate.setAttribute('href', canonicalUrl);
  document.head.appendChild(englishAlternate);

  const defaultLink = document.createElement('link');
  defaultLink.setAttribute('rel', 'alternate');
  defaultLink.setAttribute('hreflang', 'x-default');
  defaultLink.setAttribute('href', canonicalUrl);
  document.head.appendChild(defaultLink);

  // Structured Data (JSON-LD)
  const existingJsonLd = document.querySelectorAll('script[type="application/ld+json"][data-seo="dynamic"]');
  existingJsonLd.forEach((el) => el.remove());

  // 1. Publisher Organization Schema
  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    name: siteSettings.names[lang] || 'News Discover',
    url: origin,
    logo: {
      '@type': 'ImageObject',
      url: `${origin}/icon.svg`,
    },
    publishingPrinciples: `${origin}/disclaimer`,
    ethicsPolicy: `${origin}/standards`,
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
        name: siteSettings.names[lang] || 'News Discover',
        url: origin,
      },
      articleSection: article.category,
      keywords: trans.keywords?.join(', '),
    };

    setMeta('article:published_time', article.publishedAt, true);
    setMeta('article:modified_time', article.updatedAt, true);
    setMeta('article:section', article.category, true);

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
          item: `${origin}/`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: category?.names[lang] || article.category,
          item: `${origin}/category/${article.category}`,
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

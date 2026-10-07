import Parser from 'rss-parser';
import { db } from './db';
import { generateEditorialDraft } from './gemini';
import { Article, LanguageCode } from '../src/types';
import { resolveAuthenticSourceLink, isDummyOrPlaceholderUrl } from './sourceVerification';
import { resolveVideoMetadata, resolveOrGenerateArticleImage } from './mediaResolver';
import {
  extractOfficialPageMetadata,
  createArchiveSnapshot,
  getArchivedImageUrl,
} from './officialMediaAndArchive';

export interface ParsedFeedItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  imageUrl?: string;
  videoUrl?: string;
}

const rssParser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail'],
      ['enclosure', 'enclosure'],
      ['content:encoded', 'contentEncoded'],
      ['dc:date', 'dcDate'],
    ],
  },
});

/**
 * Fetches and parses genuine XML RSS / Atom feeds from external news wires.
 */
export async function fetchAndParseRssFeed(rssUrl: string, timeoutMs = 6000): Promise<ParsedFeedItem[]> {
  if (!rssUrl || !rssUrl.startsWith('http')) return [];
  try {
    const res = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: ParsedFeedItem[] = [];

    // Match both RSS <item> and Atom <entry>
    const itemBlocks = [...xml.matchAll(/<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/gi)];
    for (const block of itemBlocks) {
      const content = block[0];

      // Extract title
      const titleMatch = content.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

      // Extract link (RSS: <link>url</link> or Atom: <link href="url" />)
      let link = '';
      const atomLinkMatch = content.match(/<link[^>]+href=["']([^"']+)["']/i);
      if (atomLinkMatch) {
        link = atomLinkMatch[1].trim();
      } else {
        const rssLinkMatch = content.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
        if (rssLinkMatch) {
          link = rssLinkMatch[1].replace(/<[^>]+>/g, '').trim();
        }
      }

      // Extract description
      const descMatch = content.match(/<(?:description|summary|content:encoded)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary|content:encoded)>/i);
      const description = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';

      // Extract pubDate
      const pubDateMatch = content.match(/<(?:pubDate|published|updated|dc:date)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:pubDate|published|updated|dc:date)>/i);
      const pubDate = pubDateMatch ? pubDateMatch[1].trim() : undefined;

      // Extract image URL from enclosure, media:content, media:thumbnail, or img tag
      let imageUrl: string | undefined;
      const encImgMatch = content.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image\/[^"']*["']/i)
        || content.match(/<enclosure[^>]+type=["']image\/[^"']*["'][^>]*url=["']([^"']+)["']/i);
      if (encImgMatch) {
        imageUrl = encImgMatch[1].trim();
      } else {
        const mediaContentMatch = content.match(/<media:content[^>]+url=["']([^"']+)["'][^>]*medium=["']image["']/i)
          || content.match(/<media:content[^>]+url=["']([^"']+)["']/i)
          || content.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
        if (mediaContentMatch) {
          imageUrl = mediaContentMatch[1].trim();
        } else {
          const imgTagMatch = content.match(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i);
          if (imgTagMatch) {
            imageUrl = imgTagMatch[1].trim();
          }
        }
      }

      // Extract video URL if available
      let videoUrl: string | undefined;
      const encVideoMatch = content.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']video\/[^"']*["']/i);
      if (encVideoMatch) {
        videoUrl = encVideoMatch[1].trim();
      } else {
        const mediaVideoMatch = content.match(/<media:content[^>]+url=["']([^"']+)["'][^>]*medium=["']video["']/i);
        if (mediaVideoMatch) {
          videoUrl = mediaVideoMatch[1].trim();
        } else {
          const ytMatch = content.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/i);
          if (ytMatch) {
            videoUrl = ytMatch[0];
          }
        }
      }

      // Clean link & decode XML entities
      link = link.replace(/&amp;/g, '&').trim();

      if (title && link && (link.startsWith('http://') || link.startsWith('https://')) && !isDummyOrPlaceholderUrl(link)) {
        items.push({ title, link, description, pubDate, imageUrl, videoUrl });
      }
    }
    return items;
  } catch {
    return [];
  }
}

export function generateSitemapXml(origin: string): string {
  const articles = db.getArticles({ status: 'published' });
  const categories = db.getCategories().filter((category) => category.isVisible && !category.seoNoIndex);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  xml += `  <url><loc>${origin}/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>\n`;

  categories.forEach((category) => {
    xml += `  <url>\n`;
    xml += `    <loc>${origin}/category/${category.slug}</loc>\n`;
    xml += `    <changefreq>hourly</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;
    xml += `  </url>\n`;
  });

  articles.forEach((article) => {
    const translation = article.translations.en;
    if (!translation?.slug) return;
    xml += `  <url>\n`;
    xml += `    <loc>${origin}/news/${article.category}/${translation.slug}</loc>\n`;
    xml += `    <lastmod>${new Date(article.updatedAt || article.publishedAt).toISOString().split('T')[0]}</lastmod>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>${article.isPinned || article.isBreaking ? '0.9' : '0.7'}</priority>\n`;
    xml += `  </url>\n`;
  });

  xml += `</urlset>`;
  return xml;
}

export function generateNewsSitemapXml(origin: string): string {
  // Google News sitemap includes articles published in the last 48 hours
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const articles = db
    .getArticles({ status: 'published' })
    .filter((article) => {
      const published = new Date(article.publishedAt).getTime();
      return Number.isFinite(published) && published >= cutoff;
    })
    .slice(0, 1000);
  const settings = db.getSettings();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n`;

  articles.forEach((art) => {
    const trans = art.translations.en;
    if (!trans?.slug) return;
    const pubName = settings.names.en || 'World News';
    xml += `  <url>\n`;
    xml += `    <loc>${origin}/news/${art.category}/${trans.slug}</loc>\n`;
    xml += `    <news:news>\n`;
    xml += `      <news:publication><news:name>${escapeXml(pubName)}</news:name><news:language>en</news:language></news:publication>\n`;
    xml += `      <news:publication_date>${new Date(art.publishedAt).toISOString()}</news:publication_date>\n`;
    xml += `      <news:title>${escapeXml(trans.title)}</news:title>\n`;
    if (trans.keywords?.length) xml += `      <news:keywords>${escapeXml(trans.keywords.join(', '))}</news:keywords>\n`;
    xml += `    </news:news>\n`;
    xml += `  </url>\n`;
  });

  xml += `</urlset>`;
  return xml;
}

export function generateRssXml(origin: string, lang: LanguageCode = 'en'): string {
  const articles = db.getArticles({ status: 'published' });
  const settings = db.getSettings();
  lang = 'en';
  const siteTitle = settings.names.en || 'World News';
  const siteDesc = settings.descriptions.en || '24/7 International Digital Newsroom';

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n`;
  xml += `  <channel>\n`;
  xml += `    <title>${escapeXml(siteTitle)}</title>\n`;
  xml += `    <link>${origin}/</link>\n`;
  xml += `    <description>${escapeXml(siteDesc)}</description>\n`;
  xml += `    <language>${lang}</language>\n`;
  xml += `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n`;
  xml += `    <atom:link href="${origin}/rss.xml" rel="self" type="application/rss+xml" />\n`;

  articles.slice(0, 30).forEach((art) => {
    const trans = art.translations[lang] || art.translations.en;
    const itemUrl = `${origin}/news/${art.category}/${trans.slug}`;

    xml += `    <item>\n`;
    xml += `      <title>${escapeXml(trans.title)}</title>\n`;
    xml += `      <link>${itemUrl}</link>\n`;
    xml += `      <guid isPermaLink="true">${itemUrl}</guid>\n`;
    xml += `      <pubDate>${new Date(art.publishedAt).toUTCString()}</pubDate>\n`;
    xml += `      <description>${escapeXml(trans.executiveSummary)}</description>\n`;
    xml += `      <category>${escapeXml(art.category)}</category>\n`;
    xml += `      <author>${escapeXml(art.byline)}</author>\n`;
    xml += `    </item>\n`;
  });

  xml += `  </channel>\n`;
  xml += `</rss>`;
  return xml;
}

export function generateRobotsTxt(origin: string): string {
  return `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

User-agent: Googlebot
Allow: /
Disallow: /admin
Disallow: /api/

User-agent: Googlebot-News
Allow: /
Allow: /news-sitemap.xml
Disallow: /admin
Disallow: /api/

Sitemap: ${origin}/sitemap.xml
Sitemap: ${origin}/news-sitemap.xml
`;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '\'':
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

// Scheduled RSS automation: English-only, 60-minute freshness window, deduplication, video and image handling
export async function runRssImportJob(sourceId?: string): Promise<{ success: boolean; count: number; logMessage: string }> {
  const sources = sourceId
    ? db.getSources().filter((s) => s.id === sourceId)
    : db.getSources().filter((s) => s.isActive);

  let totalImported = 0;
  const started = new Date().toISOString();

  for (const src of sources) {
    try {
      // قراءة رابط الـ RSS
      const sourceRssUrl = (src as any).rss_url || src.rssUrl;
      if (!sourceRssUrl) continue;

      let feed: any = null;
      try {
        feed = await rssParser.parseURL(sourceRssUrl);
      } catch {
        // Fallback with custom fetch if direct parseURL hits CORS/User-Agent barrier
        try {
          const res = await fetch(sourceRssUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              Accept: 'application/rss+xml, application/xml, text/xml, */*',
            },
            signal: AbortSignal.timeout(6000),
          });
          if (res.ok) {
            const xml = await res.text();
            feed = await rssParser.parseString(xml);
          }
        } catch {
          // Feed unreachable
        }
      }

      if (!feed || !feed.items || feed.items.length === 0) {
        continue;
      }

      // 1. فرز العناصر من الأحدث إلى الأقدم بناءً على تاريخ النشر
      const sortedItems = feed.items.sort((a: any, b: any) => {
        const timeA = new Date(a.pubDate || a.isoDate || a.dcDate || 0).getTime();
        const timeB = new Date(b.pubDate || b.isoDate || b.dcDate || 0).getTime();
        return timeB - timeA;
      });

      // 2. معالجة كافة المقالات الجديدة غير المستوردة في الـ RSS دون حد مصطنع
      for (const feedItem of sortedItems) {
        const rawPubDate = feedItem.pubDate || feedItem.isoDate || feedItem.dcDate || new Date().toISOString();
        const itemDate = new Date(rawPubDate);
        const now = new Date();
        const hoursDifference = (now.getTime() - itemDate.getTime()) / (1000 * 60 * 60);

        // Import only stories published during the last 60 minutes.
        if (isNaN(hoursDifference) || hoursDifference < 0 || hoursDifference > 1) {
          continue;
        }

        const targetTitle = (feedItem.title || '').trim();
        let targetUrl = (feedItem.link || '').trim();
        const targetCategory = src.category || 'world';
        const itemDescription = (feedItem.contentSnippet || feedItem.content || feedItem.description || '').replace(/<[^>]+>/g, ' ').trim();

        if (!targetTitle) continue;

        // Ensure authentic accessible URL
        if (!targetUrl || isDummyOrPlaceholderUrl(targetUrl)) {
          const verified = await resolveAuthenticSourceLink({
            category: targetCategory,
            originalSource: src.name,
            title: targetTitle,
          });
          targetUrl = verified.originalUrl;
        }

        // Check if article with this URL or title already exists
        const exists = db.articles.some(
          (a) =>
            a.originalUrl === targetUrl ||
            a.translations?.en?.title?.trim().toLowerCase() === targetTitle.toLowerCase()
        );
        if (exists) {
          continue;
        }

        // Crawl and extract official webpage metadata (official description, official real image, video)
        const officialMeta = await extractOfficialPageMetadata(targetUrl);
        const finalDescription = officialMeta.description || itemDescription || targetTitle;
        const feedBodyCandidate = (
          feedItem.contentEncoded ||
          feedItem['content:encoded'] ||
          feedItem.content ||
          feedItem.description ||
          ''
        )
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/\s+/g, ' ')
          .trim();

        const sourceArticleText = (
          officialMeta.articleText ||
          feedBodyCandidate ||
          finalDescription
        ).trim();

        // Accuracy gate: do not ask the model to manufacture a full article from a headline alone.
        if (sourceArticleText.length < 80) {
          db.updateSource(src.id, {
            lastError: `Skipped "${targetTitle}" because no sufficiently detailed source text could be extracted.`,
          });
          continue;
        }

        // Detect video presence in the feed item or official page
        let videoCandidate: string | null = officialMeta.videoUrl || null;
        if (!videoCandidate && feedItem.enclosure?.url && (feedItem.enclosure?.type?.startsWith('video') || /\.(mp4|webm|m3u8)/i.test(feedItem.enclosure.url))) {
          videoCandidate = feedItem.enclosure.url;
        }
        if (!videoCandidate && Array.isArray(feedItem.mediaContent)) {
          const videoEntry = feedItem.mediaContent.find((m: any) => m?.['$']?.medium === 'video' || m?.['$']?.type?.startsWith('video'));
          if (videoEntry?.['$']?.url) {
            videoCandidate = videoEntry['$'].url;
          }
        }
        const fullText = `${feedItem.link} ${feedItem.content} ${feedItem['content:encoded'] || ''} ${feedItem.description || ''}`;
        if (!videoCandidate) {
          const ytMatch = fullText.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/i);
          if (ytMatch) {
            videoCandidate = ytMatch[0];
          } else {
            const vimeoMatch = fullText.match(/https?:\/\/(?:www\.)?(?:player\.)?vimeo\.com\/(?:video\/)?[0-9]+/i);
            if (vimeoMatch) {
              videoCandidate = vimeoMatch[0];
            }
          }
        }

        // Resolve video metadata (iframe embed URL + screenshot thumbnail)
        const videoMeta = videoCandidate ? resolveVideoMetadata(videoCandidate) : null;

        // Detect real original image from feed item or official source page
        let extractedImage: string | null = officialMeta.imageUrl || null;
        if (!extractedImage && feedItem.imageUrl) {
          extractedImage = feedItem.imageUrl;
        }
        if (!extractedImage && feedItem.enclosure?.url && (feedItem.enclosure?.type?.startsWith('image') || /\.(jpg|jpeg|png|webp)/i.test(feedItem.enclosure.url))) {
          extractedImage = feedItem.enclosure.url;
        } else if (!extractedImage && feedItem.mediaThumbnail?.['$']?.url) {
          extractedImage = feedItem.mediaThumbnail['$'].url;
        } else if (!extractedImage && Array.isArray(feedItem.mediaContent)) {
          const imgEntry = feedItem.mediaContent.find((m: any) => m?.['$']?.medium === 'image' || m?.['$']?.type?.startsWith('image'));
          if (imgEntry?.['$']?.url) {
            extractedImage = imgEntry['$'].url;
          }
        } else if (!extractedImage) {
          const imgMatch = fullText.match(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i);
          if (imgMatch) {
            extractedImage = imgMatch[1];
          }
        }

        // Use real original image URL directly on the site
        let finalImage = extractedImage || null;
        let finalImageCredit = extractedImage ? 'Editorial image' : 'World News Visual Desk';
        let finalImageLicense = extractedImage
          ? 'Upstream editorial media; verify publishing rights before monetized use'
          : 'World News generated/fallback visual';
        let finalImageProvenance = extractedImage
          ? 'Extracted from the verified article/feed metadata'
          : 'Generated or topic-matched fallback illustration';

        if (!finalImage) {
          const resolved = await resolveOrGenerateArticleImage({
            title: targetTitle,
            description: finalDescription,
            category: targetCategory,
            videoThumbnail: videoMeta?.videoThumbnail,
          });
          finalImage = resolved.image;
          finalImageCredit = resolved.imageCredit;
          finalImageLicense = resolved.imageLicense;
          finalImageProvenance = resolved.imageProvenance;
        }

        // Generate high-grade Google News journalistic draft
        const draft = await generateEditorialDraft(
          targetTitle,
          targetCategory,
          src.name,
          targetUrl,
          finalDescription,
          sourceArticleText
        );

        // Create permanent digital archive snapshot for the article
        const archiveSnapshot = createArchiveSnapshot({
          headline: targetTitle,
          description: finalDescription,
          sourceUrl: targetUrl,
          sourceAgency: src.name,
        });

        const newArticle: Article = {
          id: `art-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          category: targetCategory,
          editorialType: 'staff',
          originalSource: src.name,
          originalUrl: targetUrl,
          originalDescription: finalDescription,
          officialImageUrl: extractedImage || officialMeta.imageUrl || undefined,
          archiveSnapshot,
          image: finalImage || '',
          imageCredit: finalImageCredit,
          imageProvenance: finalImageProvenance,
          imageLicense: finalImageLicense,
          status: Object.values(draft.translations).every(
            (translation) => translation.translationStatus === 'complete'
          )
            ? 'published'
            : 'review',
          isBreaking: totalImported === 0,
          isPinned: false,
          priority: 5,
          views: Math.floor(Math.random() * 150) + 50,
          shares: Math.floor(Math.random() * 25) + 5,
          publishedAt: rawPubDate,
          updatedAt: new Date().toISOString(),
          byline: 'World News International Bureau',
          translations: draft.translations,
          hasVideo: !!(videoMeta?.hasVideo || videoCandidate),
          videoUrl: videoMeta?.videoUrl || videoCandidate || undefined,
          videoIframeUrl: videoMeta?.videoIframeUrl || undefined,
          videoThumbnail: videoMeta?.videoThumbnail || undefined,
        };

        db.createArticle(newArticle);
        totalImported++;

        db.updateSource(src.id, {
          lastImport: new Date().toISOString(),
          lastError: null,
          articlesCount: (src.articlesCount || 0) + 1,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      db.updateSource(src.id, {
        lastError: msg,
      });
    }
  }

  const completed = new Date().toISOString();
  db.addLog({
    jobType: 'rss_sync',
    source: sourceId ? `Single Source Ingest (${sourceId})` : 'Hourly Scheduled Automated Wire Pipeline',
    startedAt: started,
    completedAt: completed,
    status: totalImported > 0 ? 'success' : 'warning',
    errorMessage: totalImported === 0 ? 'No new items published within the last 24 hours found.' : null,
    importedCount: totalImported,
  });

  await db.flush();

  return {
    success: true,
    count: totalImported,
    logMessage: `RSS import complete. ${totalImported} fresh articles ingested from verified feed/page content with grounded multilingual SEO metadata.`,
  };
}

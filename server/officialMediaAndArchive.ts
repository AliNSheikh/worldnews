import crypto from 'crypto';

export interface ExtractedPageMetadata {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  publishedTime: string | null;
  author: string | null;
  siteName: string | null;
  articleText: string | null;
}

export interface ArchiveSnapshotData {
  archiveId: string;
  archivedAt: string;
  sourceUrl: string;
  sourceAgency: string;
  originalHeadline: string;
  originalDescription: string;
  verifiedHash: string;
  status: 'permanently-archived' | 'live-synced';
  legalBasis: string;
}

/**
 * Clean and decode common HTML entities in text
 */
function cleanHtmlText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8212;/g, '—')
    .replace(/&#8211;/g, '–')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetches the official webpage and extracts official meta description,
 * official lead image (og:image, twitter:image, JSON-LD, etc.), and media.
 */
export async function extractOfficialPageMetadata(
  url: string,
  timeoutMs = 6500
): Promise<ExtractedPageMetadata> {
  const result: ExtractedPageMetadata = {
    title: null,
    description: null,
    imageUrl: null,
    videoUrl: null,
    publishedTime: null,
    author: null,
    siteName: null,
    articleText: null,
  };

  if (!url || !url.startsWith('http')) {
    return result;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (WorldNews Bot; Digital Preservation)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8,de;q=0.7,fr;q=0.7',
        'Cache-Control': 'no-cache',
      },
    });

    clearTimeout(timer);

    if (!res.ok) {
      return result;
    }

    const html = await res.text();

    // 1. Extract Official Title
    const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i)
      || html.match(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i)
      || html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (ogTitleMatch && ogTitleMatch[1]) {
      result.title = cleanHtmlText(ogTitleMatch[1]);
    }

    // 2. Extract Official News Description (og:description, twitter:description, meta description)
    const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i)
      || html.match(/<meta\s+name=["']twitter:description["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);

    if (ogDescMatch && ogDescMatch[1]) {
      result.description = cleanHtmlText(ogDescMatch[1]);
    } else {
      // Look for first article paragraph
      const pMatch = html.match(/<article[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)
        || html.match(/<p\s+class=["'][^"']*(?:lead|summary|intro|story|body)[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
      if (pMatch && pMatch[1]) {
        const cleanedP = cleanHtmlText(pMatch[1]);
        if (cleanedP.length > 30) {
          result.description = cleanedP;
        }
      }
    }

    // 3. Extract Official Image URL (og:image, twitter:image, JSON-LD Schema)
    const ogImgMatch = html.match(/<meta\s+property=["']og:image(?::secure_url)?["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image(?::secure_url)?["']/i)
      || html.match(/<meta\s+name=["']twitter:image(?::src)?["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']twitter:image(?::src)?["']/i)
      || html.match(/<meta\s+name=["']thumbnail["']\s+content=["']([^"']+)["']/i)
      || html.match(/<link\s+rel=["']image_src["']\s+href=["']([^"']+)["']/i);

    if (ogImgMatch && ogImgMatch[1]) {
      let rawImg = ogImgMatch[1].trim();
      if (rawImg.startsWith('//')) {
        rawImg = `https:${rawImg}`;
      } else if (rawImg.startsWith('/')) {
        try {
          const parsed = new URL(url);
          rawImg = `${parsed.origin}${rawImg}`;
        } catch {}
      }
      if (rawImg.startsWith('http')) {
        result.imageUrl = rawImg;
      }
    }

    // JSON-LD backup for images & descriptions
    if (!result.imageUrl || !result.description || !result.articleText) {
      const jsonLdRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      let match: RegExpExecArray | null;
      while ((match = jsonLdRegex.exec(html)) !== null) {
        try {
          const parsed = JSON.parse(match[1]);
          const candidates = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of candidates) {
            if (!item) continue;
            // Handle @graph in JSON-LD
            const subItems = Array.isArray(item['@graph']) ? item['@graph'] : [item];
            for (const sub of subItems) {
              if (!result.description && typeof sub.description === 'string' && sub.description.length > 20) {
                result.description = cleanHtmlText(sub.description);
              }
              if (!result.articleText && typeof sub.articleBody === 'string' && sub.articleBody.length > 120) {
                result.articleText = cleanHtmlText(sub.articleBody).slice(0, 24000);
              }
              if (!result.imageUrl) {
                if (typeof sub.image === 'string') {
                  result.imageUrl = sub.image;
                } else if (Array.isArray(sub.image) && typeof sub.image[0] === 'string') {
                  result.imageUrl = sub.image[0];
                } else if (sub.image && typeof sub.image.url === 'string') {
                  result.imageUrl = sub.image.url;
                } else if (typeof sub.thumbnailUrl === 'string') {
                  result.imageUrl = sub.thumbnailUrl;
                }
              }
            }
          }
        } catch {}
      }
    }

    // Extract source article body for fact-grounded rewriting.
    // Prefer semantic <article>, then <main>. We only keep substantive paragraph text
    // and intentionally discard navigation, scripts, widgets, captions and forms.
    if (!result.articleText) {
      const semanticMatch =
        html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
        html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);

      if (semanticMatch?.[1]) {
        const cleanedContainer = semanticMatch[1]
          .replace(/<(script|style|nav|aside|form|footer|header|figure)[^>]*>[\s\S]*?<\/\1>/gi, ' ');

        const paragraphs = [...cleanedContainer.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
          .map((match) => cleanHtmlText(match[1] || ''))
          .filter((paragraph) => paragraph.length >= 40);

        const deduped = [...new Set(paragraphs)];
        if (deduped.length > 0) {
          result.articleText = deduped.join('\n\n').slice(0, 24000);
        }
      }
    }

    // Secondary DOM image extraction: <article> img, <figure> img, lead/hero img
    if (!result.imageUrl) {
      const domImgMatch = html.match(/<figure[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i)
        || html.match(/<article[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i)
        || html.match(/<img[^>]+(?:class|id)=["'][^"']*(?:lead|hero|featured|main|cover|primary|story-image)[^"']*["'][^>]+src=["']([^"']+)["']/i)
        || html.match(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/i);

      if (domImgMatch && domImgMatch[1]) {
        let rawImg = domImgMatch[1].trim();
        if (rawImg.startsWith('//')) {
          rawImg = `https:${rawImg}`;
        } else if (rawImg.startsWith('/')) {
          try {
            const parsed = new URL(url);
            rawImg = `${parsed.origin}${rawImg}`;
          } catch {}
        }
        if (rawImg.startsWith('http')) {
          result.imageUrl = rawImg;
        }
      }
    }

    // 4. Extract Official Video (if any)
    const ogVideoMatch = html.match(/<meta\s+property=["']og:video(?::url)?["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+name=["']twitter:player["']\s+content=["']([^"']+)["']/i);
    if (ogVideoMatch && ogVideoMatch[1]) {
      result.videoUrl = ogVideoMatch[1].trim();
    } else {
      // Look for embedded iframe (YouTube, Vimeo, Dailymotion, or player)
      const iframeMatch = html.match(/<iframe[^>]+src=["'](https?:\/\/(?:www\.)?(?:youtube\.com\/embed\/|player\.vimeo\.com\/video\/|dailymotion\.com\/embed\/)[^"']+)["']/i)
        || html.match(/<iframe[^>]+src=["']([^"']*(?:youtube|vimeo|embed|video)[^"']*)["']/i);
      if (iframeMatch && iframeMatch[1]) {
        result.videoUrl = iframeMatch[1].trim();
      }
    }

    // 5. Site Name
    const siteNameMatch = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i);
    if (siteNameMatch && siteNameMatch[1]) {
      result.siteName = cleanHtmlText(siteNameMatch[1]);
    }
  } catch (err) {
    // Non-blocking fallback
  }

  return result;
}

/**
 * Creates a permanent digital preservation snapshot for an article
 */
export function createArchiveSnapshot(params: {
  headline: string;
  description: string;
  sourceUrl: string;
  sourceAgency: string;
}): ArchiveSnapshotData {
  const { headline, description, sourceUrl, sourceAgency } = params;

  // Generate cryptographic integrity hash
  const hashPayload = `${headline.trim()}|${description.trim()}|${sourceUrl.trim()}`;
  const verifiedHash = crypto.createHash('sha256').update(hashPayload).digest('hex').substring(0, 16);

  const archiveId = `WN-ARC-${Date.now().toString(36).toUpperCase()}-${verifiedHash.substring(0, 6).toUpperCase()}`;

  return {
    archiveId,
    archivedAt: new Date().toISOString(),
    sourceUrl,
    sourceAgency,
    originalHeadline: headline,
    originalDescription: description || headline,
    verifiedHash,
    status: 'permanently-archived',
    legalBasis:
      'Archived under Fair Use & Journalistic Press Reporting Exemption (Berne Convention Art. 10(1) & 17 U.S.C. § 107). Preserved for public digital newsroom historical record.',
  };
}

/**
 * Normalizes an official image URL to bypass hotlink / referrer blocking restrictions.
 * Returns an archival proxy URL that handles caching and headers server-side.
 */
export function getArchivedImageUrl(rawImageUrl: string | null | undefined): string | null {
  if (!rawImageUrl) return null;
  const trimmed = rawImageUrl.trim();
  if (!trimmed.startsWith('http')) return trimmed;

  // If already proxied or Unsplash / YouTube / Data URL, leave as is
  if (
    trimmed.startsWith('/api/media/archived-photo') ||
    trimmed.startsWith('data:') ||
    trimmed.includes('images.unsplash.com') ||
    trimmed.includes('img.youtube.com')
  ) {
    return trimmed;
  }

  // Use the server-side archival photo proxy
  return `/api/media/archived-photo?url=${encodeURIComponent(trimmed)}`;
}

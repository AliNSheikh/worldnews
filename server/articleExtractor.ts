export interface ExtractedArticleContent {
  title: string | null;
  description: string | null;
  body: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  author: string | null;
  language: string | null;
  quality: 'full' | 'summary' | 'failed';
}

function decode(text: string): string {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;|&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function metaTags(html: string): Array<{ key: string; content: string }> {
  return [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => {
    const tag = m[0];
    const key = tag.match(/(?:property|name)=["']([^"']+)["']/i)?.[1] || '';
    const content = tag.match(/content=["']([^"']*)["']/i)?.[1] || '';
    return { key: key.toLowerCase(), content: decode(content) };
  });
}

function pickMeta(html: string, keys: string[]): string | null {
  const tags = metaTags(html);
  for (const key of keys) {
    const found = tags.find((tag) => tag.key === key.toLowerCase());
    if (found?.content) return found.content;
  }
  return null;
}

function normalizeJsonLd(value: any): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(normalizeJsonLd);
  if (value['@graph']) return normalizeJsonLd(value['@graph']);
  return [value];
}

function extractJsonLd(html: string) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(match[1].trim());
      for (const node of normalizeJsonLd(parsed)) {
        const types = Array.isArray(node?.['@type']) ? node['@type'] : [node?.['@type']];
        if (types.some((t: string) => ['NewsArticle', 'Article', 'ReportageNewsArticle'].includes(t))) {
          const image = Array.isArray(node.image) ? node.image[0] : node.image;
          const imageUrl = typeof image === 'string' ? image : image?.url;
          const author = Array.isArray(node.author) ? node.author[0] : node.author;
          return {
            title: node.headline || node.name || null,
            description: node.description || null,
            body: node.articleBody || null,
            imageUrl: imageUrl || null,
            publishedAt: node.datePublished || null,
            author: typeof author === 'string' ? author : author?.name || null,
            language: node.inLanguage || null,
          };
        }
      }
    } catch {
      // Ignore invalid JSON-LD blocks and continue to HTML extraction.
    }
  }
  return null;
}

function extractArticleParagraphs(html: string): string | null {
  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const scope = articleMatch?.[1] || html;
  const cleanedScope = scope
    .replace(/<(nav|aside|footer|form)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ');

  const paragraphs = [...cleanedScope.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => decode(m[1]))
    .filter((p) => p.length >= 45 && !/cookie|subscribe|sign up|newsletter|advertisement/i.test(p));

  const unique = [...new Set(paragraphs)];
  if (unique.length < 2) return null;
  return unique.join('\n\n').slice(0, 18000);
}

export async function extractArticleContent(url: string, timeoutMs = 9000): Promise<ExtractedArticleContent> {
  const failed: ExtractedArticleContent = {
    title: null,
    description: null,
    body: null,
    imageUrl: null,
    publishedAt: null,
    author: null,
    language: null,
    quality: 'failed',
  };

  if (!/^https?:\/\//i.test(url)) return failed;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WorldNewsBot/1.0)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': '*',
      },
    });
    if (!res.ok) return failed;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) return failed;

    const html = await res.text();
    const jsonLd = extractJsonLd(html);
    const body = decode(jsonLd?.body || '') || extractArticleParagraphs(html);
    const description =
      decode(jsonLd?.description || '') ||
      pickMeta(html, ['og:description', 'twitter:description', 'description']);
    const title =
      decode(jsonLd?.title || '') ||
      pickMeta(html, ['og:title', 'twitter:title']) ||
      decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
    const imageUrl =
      jsonLd?.imageUrl ||
      pickMeta(html, ['og:image', 'twitter:image']);
    const publishedAt =
      jsonLd?.publishedAt ||
      pickMeta(html, ['article:published_time', 'datepublished']);
    const author = jsonLd?.author || pickMeta(html, ['author']);
    const language =
      jsonLd?.language ||
      html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1] ||
      null;

    return {
      title: title || null,
      description: description || null,
      body: body || null,
      imageUrl: imageUrl || null,
      publishedAt: publishedAt || null,
      author: author || null,
      language,
      quality: body && body.length >= 500 ? 'full' : description ? 'summary' : 'failed',
    };
  } catch {
    return failed;
  }
}

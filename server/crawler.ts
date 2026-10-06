import { db } from './db';
import { generateEditorialDraft } from './gemini';
import { Article, NewsSource } from '../src/types';
import { fetchAndParseRssFeed, ParsedFeedItem } from './rss';
import { resolveOrGenerateArticleImage, resolveVideoMetadata } from './mediaResolver';
import {
  extractOfficialPageMetadata,
  createArchiveSnapshot,
} from './officialMediaAndArchive';
import { getPersistenceProvider, isPersistenceConfigured } from './persistence';

interface CrawlerState {
  isSchedulerActive: boolean;
  intervalMs: number;
  lastRunTime: string | null;
  nextRunTime: string | null;
  totalScrapedCount: number;
  isCurrentlyRunning: boolean;
  scrapedUrls: Set<string>;
}

export interface CrawlerSourceDiagnostic {
  sourceId: string;
  sourceName: string;
  feedUrl: string;
  fetchedItems: number;
  candidates: number;
  imported: number;
  error: string | null;
}

export interface CrawlerRunResult {
  success: boolean;
  newArticlesCount: number;
  publishedArticlesCount: number;
  reviewArticlesCount: number;
  scrapedSources: string[];
  sourceDiagnostics: CrawlerSourceDiagnostic[];
  persistenceProvider: string;
  message: string;
}

const state: CrawlerState = {
  isSchedulerActive: true,
  intervalMs: 60 * 60 * 1000,
  lastRunTime: null,
  nextRunTime: null,
  totalScrapedCount: 0,
  isCurrentlyRunning: false,
  scrapedUrls: new Set<string>(),
};

const FEED_TIMEOUT_MS = Math.max(3000, Number(process.env.CRAWLER_FEED_TIMEOUT_MS || 8000));
const MAX_ARTICLES_PER_RUN = Math.max(1, Math.min(10, Number(process.env.CRAWLER_MAX_ARTICLES_PER_RUN || 3)));
const MAX_CANDIDATES_PER_SOURCE = Math.max(1, Math.min(5, Number(process.env.CRAWLER_MAX_ITEMS_PER_SOURCE || 2)));

function initScrapedUrls() {
  state.scrapedUrls.clear();
  db.articles.forEach((article) => {
    if (article.originalUrl) state.scrapedUrls.add(article.originalUrl);
  });
}

function itemTimestamp(item: ParsedFeedItem): number {
  const value = item.pubDate ? new Date(item.pubDate).getTime() : 0;
  return Number.isFinite(value) ? value : 0;
}

function isAlreadyImported(url: string): boolean {
  return state.scrapedUrls.has(url) || db.articles.some((article) => article.originalUrl === url);
}

function sourceDiagnostic(source: NewsSource): CrawlerSourceDiagnostic {
  return {
    sourceId: source.id,
    sourceName: source.name,
    feedUrl: source.rssUrl,
    fetchedItems: 0,
    candidates: 0,
    imported: 0,
    error: null,
  };
}

export async function runCrawlerCycle(): Promise<CrawlerRunResult> {
  const provider = getPersistenceProvider();

  if (process.env.VERCEL && !isPersistenceConfigured()) {
    return {
      success: false,
      newArticlesCount: 0,
      publishedArticlesCount: 0,
      reviewArticlesCount: 0,
      scrapedSources: [],
      sourceDiagnostics: [],
      persistenceProvider: provider,
      message: 'Crawler stopped: APPWRITE_API_KEY is not configured in the active Vercel Production environment, so fetched articles cannot be persisted.',
    };
  }

  if (!process.env.GEMINI_API_KEY) {
    return {
      success: false,
      newArticlesCount: 0,
      publishedArticlesCount: 0,
      reviewArticlesCount: 0,
      scrapedSources: [],
      sourceDiagnostics: [],
      persistenceProvider: provider,
      message: 'Crawler stopped: GEMINI_API_KEY is missing. AI-generated multilingual editions cannot be created safely without it.',
    };
  }

  if (state.isCurrentlyRunning) {
    return {
      success: false,
      newArticlesCount: 0,
      publishedArticlesCount: 0,
      reviewArticlesCount: 0,
      scrapedSources: [],
      sourceDiagnostics: [],
      persistenceProvider: provider,
      message: 'Crawler cycle is already in progress.',
    };
  }

  state.isCurrentlyRunning = true;
  initScrapedUrls();

  const startedAt = new Date().toISOString();
  let addedCount = 0;
  let publishedCount = 0;
  let reviewCount = 0;
  const scrapedSourceNames: string[] = [];
  const diagnostics: CrawlerSourceDiagnostic[] = [];

  try {
    await db.refresh(0);
    const activeSources = db.getSources().filter((source) => source.isActive && source.rssUrl);

    if (activeSources.length === 0) {
      throw new Error('No active RSS sources are configured in the persistent newsroom database.');
    }

    // Fetch feeds concurrently so dead/slow sources do not consume the whole
    // serverless invocation one-by-one.
    const feedResults = await Promise.all(
      activeSources.map(async (source) => {
        const diagnostic = sourceDiagnostic(source);
        diagnostics.push(diagnostic);
        scrapedSourceNames.push(source.name);

        try {
          const items = await fetchAndParseRssFeed(source.rssUrl, FEED_TIMEOUT_MS);
          diagnostic.fetchedItems = items.length;

          if (items.length === 0) {
            const message = `Feed returned no parseable RSS/Atom items: ${source.rssUrl}`;
            diagnostic.error = message;
            db.updateSource(source.id, { lastError: message });
            return { source, items: [] as ParsedFeedItem[], diagnostic };
          }

          const candidates = items
            .filter((item) => item.link && !isAlreadyImported(item.link))
            .sort((a, b) => itemTimestamp(b) - itemTimestamp(a))
            .slice(0, MAX_CANDIDATES_PER_SOURCE);

          diagnostic.candidates = candidates.length;
          return { source, items: candidates, diagnostic };
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          diagnostic.error = message;
          db.updateSource(source.id, { lastError: message });
          return { source, items: [] as ParsedFeedItem[], diagnostic };
        }
      })
    );

    const candidates = feedResults
      .flatMap(({ source, items, diagnostic }) =>
        items.map((item) => ({ source, item, diagnostic }))
      )
      .sort((a, b) => itemTimestamp(b.item) - itemTimestamp(a.item));

    for (const candidate of candidates) {
      if (addedCount >= MAX_ARTICLES_PER_RUN) break;

      const { source, item, diagnostic } = candidate;
      if (isAlreadyImported(item.link)) continue;

      try {
        const officialMeta = await extractOfficialPageMetadata(item.link);
        const effectiveDescription = (officialMeta.description || item.description || '').trim();
        const sourceArticleText = (officialMeta.articleText || effectiveDescription).trim();

        if (sourceArticleText.length < 80) {
          const message = `Skipped "${item.title}" because the feed/page exposed less than 80 characters of verifiable source text.`;
          diagnostic.error = diagnostic.error || message;
          db.updateSource(source.id, { lastError: message });
          continue;
        }

        const draft = await generateEditorialDraft(
          item.title,
          source.category || 'world',
          source.name,
          item.link,
          effectiveDescription,
          sourceArticleText
        );

        const allTranslationsComplete = Object.values(draft.translations).every(
          (translation) => translation.translationStatus === 'complete'
        );

        const videoCandidate = officialMeta.videoUrl || item.videoUrl || null;
        const videoMeta = videoCandidate ? resolveVideoMetadata(videoCandidate) : null;
        const realImage = officialMeta.imageUrl || item.imageUrl || null;

        let finalImage = realImage || null;
        let finalImageCredit = realImage ? 'Editorial image' : 'World News Visual Desk';
        let finalImageLicense = realImage
          ? 'Upstream editorial media; verify publishing rights before monetized use'
          : 'World News generated/fallback visual';
        let finalImageProvenance = realImage
          ? 'Extracted from verified article/feed metadata'
          : 'Generated or topic-matched fallback illustration';

        if (!finalImage) {
          const resolved = await resolveOrGenerateArticleImage({
            title: item.title,
            description: effectiveDescription,
            category: source.category || 'world',
            videoThumbnail: videoMeta?.videoThumbnail,
          });
          finalImage = resolved.image;
          finalImageCredit = resolved.imageCredit;
          finalImageLicense = resolved.imageLicense;
          finalImageProvenance = resolved.imageProvenance;
        }

        const archiveSnapshot = createArchiveSnapshot({
          headline: item.title,
          description: effectiveDescription,
          sourceUrl: item.link,
          sourceAgency: source.name,
        });

        const now = new Date().toISOString();
        const newArticle: Article = {
          id: `wire-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          category: source.category || 'world',
          editorialType: 'staff',
          originalSource: source.name,
          originalUrl: item.link,
          originalDescription: effectiveDescription,
          officialImageUrl: realImage || undefined,
          archiveSnapshot,
          image: finalImage || '',
          imageCredit: finalImageCredit,
          imageProvenance: finalImageProvenance,
          imageLicense: finalImageLicense,
          status: allTranslationsComplete ? 'published' : 'review',
          isBreaking: false,
          isPinned: false,
          priority: 5,
          views: 0,
          shares: 0,
          publishedAt: item.pubDate && Number.isFinite(new Date(item.pubDate).getTime()) ? item.pubDate : now,
          updatedAt: now,
          byline: 'World News International Bureau',
          translations: draft.translations,
          hasVideo: Boolean(videoCandidate),
          videoUrl: videoCandidate || undefined,
          videoIframeUrl: videoMeta?.videoIframeUrl || undefined,
          videoThumbnail: videoMeta?.videoThumbnail || undefined,
        };

        db.createArticle(newArticle);
        state.scrapedUrls.add(item.link);
        addedCount++;
        diagnostic.imported++;
        state.totalScrapedCount++;

        if (allTranslationsComplete) publishedCount++;
        else reviewCount++;

        db.updateSource(source.id, {
          lastImport: now,
          lastError: null,
          articlesCount: (source.articlesCount || 0) + 1,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        diagnostic.error = message;
        db.updateSource(source.id, { lastError: message });
      }
    }

    state.lastRunTime = new Date().toISOString();
    state.nextRunTime = new Date(Date.now() + state.intervalMs).toISOString();

    db.addLog({
      jobType: 'rss_sync',
      source: 'Hourly Automated AI Wire Retrieval Engine',
      startedAt,
      completedAt: state.lastRunTime,
      status: addedCount > 0 ? 'success' : 'warning',
      errorMessage: addedCount > 0 ? null : diagnostics.map((d) => d.error).filter(Boolean).join(' | ') || 'No new feed items found.',
      importedCount: addedCount,
    });

    // This now throws if Appwrite rejected any queued write, so the CMS will
    // never report a successful crawl when nothing was persisted.
    await db.flush();

    const failedSources = diagnostics.filter((diagnostic) => diagnostic.error).length;
    const message = addedCount > 0
      ? `Crawler persisted ${addedCount} article(s): ${publishedCount} published, ${reviewCount} awaiting review. ${failedSources} source(s) reported warnings.`
      : `Crawler found no publishable new articles. ${failedSources} source(s) reported feed or extraction warnings; inspect sourceDiagnostics.`;

    return {
      success: addedCount > 0,
      newArticlesCount: addedCount,
      publishedArticlesCount: publishedCount,
      reviewArticlesCount: reviewCount,
      scrapedSources: scrapedSourceNames,
      sourceDiagnostics: diagnostics,
      persistenceProvider: provider,
      message,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    try {
      db.addLog({
        jobType: 'rss_sync',
        source: 'Hourly Automated AI Wire Retrieval Engine',
        startedAt,
        completedAt: new Date().toISOString(),
        status: 'failed',
        errorMessage,
        importedCount: addedCount,
      });
      await db.flush();
    } catch (flushError) {
      console.error('[World News Crawler] Failed to persist failure log:', flushError);
    }

    return {
      success: false,
      newArticlesCount: addedCount,
      publishedArticlesCount: publishedCount,
      reviewArticlesCount: reviewCount,
      scrapedSources: scrapedSourceNames,
      sourceDiagnostics: diagnostics,
      persistenceProvider: provider,
      message: `Crawler failed: ${errorMessage}`,
    };
  } finally {
    state.isCurrentlyRunning = false;
  }
}

let schedulerTimer: NodeJS.Timeout | null = null;

export function startHourlyCrawlerScheduler() {
  if (schedulerTimer) clearInterval(schedulerTimer);

  initScrapedUrls();
  state.isSchedulerActive = true;
  state.nextRunTime = new Date(Date.now() + state.intervalMs).toISOString();

  schedulerTimer = setInterval(() => {
    console.log('[World News Crawler] Executing scheduled hourly retrieval cycle...');
    runCrawlerCycle().catch((error) => {
      console.error('[World News Crawler] Hourly cycle execution error:', error);
    });
  }, state.intervalMs);
}

export function getCrawlerStatus() {
  return {
    isSchedulerActive: state.isSchedulerActive,
    intervalMs: state.intervalMs,
    intervalHours: state.intervalMs / (1000 * 60 * 60),
    lastRunTime: state.lastRunTime,
    nextRunTime: state.nextRunTime,
    totalScrapedCount: state.totalScrapedCount,
    isCurrentlyRunning: state.isCurrentlyRunning,
    scrapedUrlsCount: state.scrapedUrls.size,
    maxArticlesPerRun: MAX_ARTICLES_PER_RUN,
    persistence: db.getPersistenceStatus(),
  };
}

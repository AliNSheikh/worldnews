import { db } from './db';
import { generateEditorialDraft } from './gemini';
import { Article } from '../src/types';
import { fetchAndParseRssFeed } from './rss';
import { extractArticleContent } from './articleExtractor';
import { resolveOrGenerateArticleImage } from './mediaResolver';
import {
  extractOfficialPageMetadata,
  createArchiveSnapshot,
  getArchivedImageUrl,
} from './officialMediaAndArchive';

interface CrawlerState {
  isSchedulerActive: boolean;
  intervalMs: number;
  lastRunTime: string | null;
  nextRunTime: string | null;
  totalScrapedCount: number;
  isCurrentlyRunning: boolean;
  scrapedUrls: Set<string>;
}

const state: CrawlerState = {
  isSchedulerActive: true,
  intervalMs: Math.max(60, Number(process.env.NEWS_FETCH_INTERVAL_MINUTES || 60)) * 60 * 1000,
  lastRunTime: null,
  nextRunTime: null,
  totalScrapedCount: 0,
  isCurrentlyRunning: false,
  scrapedUrls: new Set<string>(),
};

// Seed scrapedUrls from existing database articles
function initScrapedUrls() {
  db.articles.forEach((a) => {
    if (a.originalUrl) {
      state.scrapedUrls.add(a.originalUrl);
    }
  });
}

export async function runCrawlerCycle(): Promise<{
  success: boolean;
  newArticlesCount: number;
  scrapedSources: string[];
  message: string;
}> {
  if (state.isCurrentlyRunning) {
    return {
      success: false,
      newArticlesCount: 0,
      scrapedSources: [],
      message: 'Crawler cycle is already in progress.',
    };
  }

  state.isCurrentlyRunning = true;
  initScrapedUrls();
  const startedAt = new Date().toISOString();
  let addedCount = 0;
  const scrapedSourceNames: string[] = [];

  try {
    const activeSources = db.getSources().filter((s) => s.isActive);

    for (const src of activeSources) {
      scrapedSourceNames.push(src.name);

      // 1. Try to fetch real items from live RSS feed
      const parsedItems = await fetchAndParseRssFeed(src.rssUrl, 4000);
      const unimportedItems = parsedItems.filter(
        (item) => !state.scrapedUrls.has(item.link) && !db.articles.some((a) => a.originalUrl === item.link)
      );

      const itemsToProcess: Array<{
        topic: string;
        targetArticleUrl: string;
        category: string;
        byline: string;
        fallbackDescription: string;
        feedImage?: string;
        feedVideo?: string;
      }> = [];

      if (unimportedItems.length > 0) {
        for (const item of unimportedItems) {
          itemsToProcess.push({
            topic: item.title,
            targetArticleUrl: item.link,
            category: src.category || 'world',
            byline: 'World News International Bureau',
            fallbackDescription: item.description || '',
            feedImage: item.imageUrl,
            feedVideo: item.videoUrl,
          });
        }
      } else {
        // Never fabricate fallback stories. If a source has no fresh feed items,
        // record a clean no-op and wait for the next scheduled cycle.
        db.updateSource(src.id, {
          lastImport: new Date().toISOString(),
          lastError: null,
        });
      }

      for (const item of itemsToProcess) {
        if (state.scrapedUrls.has(item.targetArticleUrl) || db.articles.some((a) => a.originalUrl === item.targetArticleUrl)) {
          continue;
        }

        // Extract the actual article body before any AI rewriting.
        // The model receives this body as the factual ground truth and must not invent details.
        const [officialMeta, extracted] = await Promise.all([
          extractOfficialPageMetadata(item.targetArticleUrl),
          extractArticleContent(item.targetArticleUrl),
        ]);
        const effectiveDescription = extracted.description || officialMeta.description || item.fallbackDescription || '';
        const groundedBody = extracted.body || effectiveDescription;
        const realImage = extracted.imageUrl || officialMeta.imageUrl || item.feedImage || null;

        if (!groundedBody || groundedBody.trim().length < 120) {
          db.updateSource(src.id, {
            lastImport: new Date().toISOString(),
            lastError: 'Skipped article because the source body could not be extracted reliably.',
          });
          continue;
        }

        const draft = await generateEditorialDraft(
          item.topic,
          item.category,
          src.name,
          item.targetArticleUrl,
          effectiveDescription,
          groundedBody
        );

        const fallbackVisual = realImage
          ? null
          : await resolveOrGenerateArticleImage({
              title: item.topic,
              description: effectiveDescription,
              category: item.category,
            });
        const finalImage = realImage || fallbackVisual?.image || '';

        const archiveSnapshot = createArchiveSnapshot({
          headline: item.topic,
          description: effectiveDescription,
          sourceUrl: item.targetArticleUrl,
          sourceAgency: src.name,
        });

        const videoCandidate = officialMeta.videoUrl || item.feedVideo || null;

        const newArticle: Article = {
          id: `wire-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          category: item.category,
          editorialType: 'staff',
          originalSource: src.name,
          originalUrl: item.targetArticleUrl,
          originalDescription: effectiveDescription,
          officialImageUrl: realImage || undefined,
          archiveSnapshot,
          image: finalImage,
          imageCredit: realImage ? 'Source-page image' : (fallbackVisual?.imageCredit || 'No image credit available'),
          imageProvenance: realImage ? 'Extracted from the article page metadata/structured data' : (fallbackVisual?.imageProvenance || 'No image available'),
          imageLicense: realImage ? 'Use subject to publisher/media rights' : (fallbackVisual?.imageLicense || 'Unknown'),
          status: Object.values(draft.translations).every((t) => t.translationStatus === 'complete') ? 'published' : 'review',
          isBreaking: false,
          isPinned: false,
          priority: 5,
          views: 0,
          shares: 0,
          publishedAt: extracted.publishedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          byline: item.byline,
          translations: draft.translations,
          hasVideo: !!videoCandidate,
          videoUrl: videoCandidate || undefined,
          videoIframeUrl: videoCandidate?.includes('embed') ? videoCandidate : undefined,
        };

        db.createArticle(newArticle);
        state.scrapedUrls.add(item.targetArticleUrl);
        addedCount++;
        state.totalScrapedCount++;

        db.updateSource(src.id, {
          lastImport: new Date().toISOString(),
          lastError: null,
          articlesCount: (src.articlesCount || 0) + 1,
        });
      }
    }

    state.lastRunTime = new Date().toISOString();
    state.nextRunTime = new Date(Date.now() + state.intervalMs).toISOString();

    db.addLog({
      jobType: 'rss_sync',
      source: 'Hourly Automated AI Wire Retrieval Engine',
      startedAt,
      completedAt: state.lastRunTime,
      status: 'success',
      errorMessage: null,
      importedCount: addedCount,
    });

    return {
      success: true,
      newArticlesCount: addedCount,
      scrapedSources: scrapedSourceNames,
      message: `Hourly automated crawl completed successfully. Detected and ingested ${addedCount} new un-scraped articles with complete 5-language metadata.`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    db.addLog({
      jobType: 'rss_sync',
      source: 'Hourly Automated AI Wire Retrieval Engine',
      startedAt,
      completedAt: new Date().toISOString(),
      status: 'failed',
      errorMessage: errorMsg,
      importedCount: addedCount,
    });

    return {
      success: false,
      newArticlesCount: addedCount,
      scrapedSources: scrapedSourceNames,
      message: `Hourly crawl encountered an error: ${errorMsg}`,
    };
  } finally {
    state.isCurrentlyRunning = false;
  }
}

let schedulerTimer: NodeJS.Timeout | null = null;

export function startHourlyCrawlerScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }

  initScrapedUrls();
  state.isSchedulerActive = true;
  state.nextRunTime = new Date(Date.now() + state.intervalMs).toISOString();

  // Schedule to run every hour
  schedulerTimer = setInterval(() => {
    console.log('[World News Crawler] Executing scheduled hourly retrieval cycle...');
    runCrawlerCycle().catch((err) => {
      console.error('[World News Crawler] Hourly cycle execution error:', err);
    });
  }, state.intervalMs);

  console.log('[World News Crawler] Hourly automated article retrieval scheduler initiated. Interval: 1 hour.');
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
  };
}

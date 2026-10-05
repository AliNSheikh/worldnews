import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './db';
import { generateSitemapXml, generateNewsSitemapXml, generateRssXml, generateRobotsTxt, runRssImportJob, fetchAndParseRssFeed } from './rss';
import {
  generateEditorialDraft,
  regenerateArticleInAlternativeFormat,
  optimizeArticleForSEOAndSearch,
  translateArticleToAllLanguages,
  sanitizeBoldFormatting,
  AlternativeFormatType,
} from './gemini';
import { runCrawlerCycle, getCrawlerStatus, startHourlyCrawlerScheduler } from './crawler';
import { Article } from '../src/types';
import { resolveAuthenticSourceLink, testUrlAccessibility, isDummyOrPlaceholderUrl } from './sourceVerification';
import { resolveVideoMetadata, resolveOrGenerateArticleImage } from './mediaResolver';
import {
  extractOfficialPageMetadata,
  createArchiveSnapshot,
  getArchivedImageUrl,
} from './officialMediaAndArchive';

export async function createApp(options: { serveFrontend?: boolean } = {}) {
  const app = express();
  await db.ready();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  const adminPassword = process.env.ADMIN_PASSWORD || '';
  const adminSessionSecret = process.env.ADMIN_SESSION_SECRET || adminPassword;
  const adminCookieName = 'world_news_admin_session';

  const parseCookies = (header = '') =>
    Object.fromEntries(
      header
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const idx = part.indexOf('=');
          return idx >= 0
            ? [decodeURIComponent(part.slice(0, idx)), decodeURIComponent(part.slice(idx + 1))]
            : [decodeURIComponent(part), ''];
        })
    );

  const signAdminSession = (expiresAt: number) => {
    const payload = String(expiresAt);
    const signature = crypto
      .createHmac('sha256', adminSessionSecret)
      .update(payload)
      .digest('base64url');
    return `${payload}.${signature}`;
  };

  const isValidAdminSession = (token?: string) => {
    if (!token || !adminSessionSecret) return false;
    const [expiresRaw, signature] = token.split('.');
    const expiresAt = Number(expiresRaw);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || !signature) return false;

    const expected = crypto
      .createHmac('sha256', adminSessionSecret)
      .update(expiresRaw)
      .digest('base64url');

    const expectedBuffer = Buffer.from(expected);
    const signatureBuffer = Buffer.from(signature);
    return (
      expectedBuffer.length === signatureBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
    );
  };

  const refreshDb: express.RequestHandler = async (_req, res, next) => {
    try {
      await db.refresh();
      next();
    } catch (error) {
      console.error('[World News DB] Refresh failed:', error);
      res.status(503).json({ error: 'Newsroom data is temporarily unavailable.' });
    }
  };

  const requireAdmin: express.RequestHandler = (req, res, next) => {
    const cookies = parseCookies(req.headers.cookie || '');
    if (!isValidAdminSession(cookies[adminCookieName])) {
      return res.status(401).json({ error: 'Administrator authentication required.' });
    }
    next();
  };

  app.post('/api/admin/login', (req, res) => {
    if (!adminPassword || !adminSessionSecret) {
      return res.status(503).json({
        error: 'Admin authentication is not configured. Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET.',
      });
    }

    const submitted = String(req.body?.password || '');
    const submittedBuffer = Buffer.from(submitted);
    const passwordBuffer = Buffer.from(adminPassword);
    const valid =
      submittedBuffer.length === passwordBuffer.length &&
      crypto.timingSafeEqual(submittedBuffer, passwordBuffer);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid administrator credentials.' });
    }

    const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader(
      'Set-Cookie',
      `${adminCookieName}=${encodeURIComponent(signAdminSession(expiresAt))}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`
    );
    res.json({ success: true, expiresAt: new Date(expiresAt).toISOString() });
  });

  app.get('/api/admin/session', (req, res) => {
    const cookies = parseCookies(req.headers.cookie || '');
    res.json({ authenticated: isValidAdminSession(cookies[adminCookieName]) });
  });

  app.post('/api/admin/logout', (req, res) => {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader(
      'Set-Cookie',
      `${adminCookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`
    );
    res.json({ success: true });
  });

  // Helper for origin determination
  const getOrigin = (req: express.Request) => {
    return process.env.APP_URL || `${req.protocol}://${req.get('host') || 'localhost:3000'}`;
  };

  // ==========================================
  // Public Sitemaps & RSS Feeds
  // ==========================================
  app.get('/sitemap.xml', refreshDb, (req, res) => {
    res.setHeader('Content-Type', 'application/xml');
    res.send(generateSitemapXml(getOrigin(req)));
  });

  app.get('/news-sitemap.xml', refreshDb, (req, res) => {
    res.setHeader('Content-Type', 'application/xml');
    res.send(generateNewsSitemapXml(getOrigin(req)));
  });

  app.get('/rss.xml', refreshDb, (req, res) => {
    const lang = (req.query.lang as string) || 'en';
    res.setHeader('Content-Type', 'application/rss+xml');
    res.send(generateRssXml(getOrigin(req), lang as any));
  });

  app.get('/robots.txt', (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(generateRobotsTxt(getOrigin(req)));
  });

  // ==========================================
  // API Routes
  // ==========================================

  // Health
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      time: new Date().toISOString(),
      articlesCount: db.articles.length,
      categoriesCount: db.categories.length,
    });
  });

  // Articles
  app.get('/api/articles', refreshDb, (req, res) => {
    const { category, status, search } = req.query;
    const articles = db.getArticles({
      category: category as string,
      status: status as string,
      search: search as string,
    });
    res.json(articles);
  });

  app.get('/api/articles/:id', refreshDb, (req, res) => {
    const article = db.getArticleById(req.params.id) || db.getArticleBySlug(req.params.id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    res.json(article);
  });

  app.post('/api/articles', requireAdmin, async (req, res) => {
    try {
      const created = db.createArticle(req.body);
      await db.flush();
      res.status(201).json(created);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: msg });
    }
  });

  app.put('/api/articles/:id', requireAdmin, async (req, res) => {
    try {
      const updated = db.updateArticle(req.params.id, req.body);
      await db.flush();
      res.json(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(404).json({ error: msg });
    }
  });

  app.delete('/api/articles/:id', requireAdmin, async (req, res) => {
    const success = db.deleteArticle(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Article not found' });
    }
    await db.flush();
    res.json({ success: true });
  });

  app.post('/api/articles/:id/view', (req, res) => {
    const views = db.incrementViews(req.params.id);
    res.json({ views });
  });

  // Categories
  app.get('/api/categories', refreshDb, (req, res) => {
    res.json(db.getCategories());
  });

  app.put('/api/categories/:id', requireAdmin, async (req, res) => {
    try {
      const updated = db.updateCategory(req.params.id, req.body);
      await db.flush();
      res.json(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(404).json({ error: msg });
    }
  });

  // Sources
  app.get('/api/sources', refreshDb, (req, res) => {
    res.json(db.getSources());
  });

  app.post('/api/sources', requireAdmin, async (req, res) => {
    const created = db.addSource(req.body);
    await db.flush();
    res.status(201).json(created);
  });

  app.put('/api/sources/:id', requireAdmin, async (req, res) => {
    try {
      const updated = db.updateSource(req.params.id, req.body);
      await db.flush();
      res.json(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(404).json({ error: msg });
    }
  });

  app.delete('/api/sources/:id', requireAdmin, async (req, res) => {
    const success = db.deleteSource(req.params.id);
    if (!success) return res.status(404).json({ error: 'Source not found' });
    await db.flush();
    res.json({ success: true });
  });

  app.post('/api/sources/:id/test', requireAdmin, async (req, res) => {
    const source = db.getSources().find((s) => s.id === req.params.id);
    if (!source) return res.status(404).json({ error: 'Source not found' });

    const startedAt = Date.now();
    const items = await fetchAndParseRssFeed(source.rssUrl, 8000);
    const responseTimeMs = Date.now() - startedAt;

    if (items.length === 0) {
      return res.status(422).json({
        success: false,
        status: 'unreachable-or-empty',
        responseTimeMs,
        message: `No valid RSS/Atom article items could be parsed from '${source.name}'. Check the feed URL and upstream access rules.`,
      });
    }

    res.json({
      success: true,
      status: 'active',
      responseTimeMs,
      parsedItems: items.length,
      sample: items.slice(0, 3).map((item) => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        hasImage: Boolean(item.imageUrl),
      })),
      message: `Connected to '${source.name}' and parsed ${items.length} valid feed items.`,
    });
  });

  app.post('/api/sources/:id/import', requireAdmin, async (req, res) => {
    const result = await runRssImportJob(req.params.id);
    await db.flush();
    res.json(result);
  });

  // Comments
  app.get('/api/comments', refreshDb, (req, res) => {
    const { articleId, status } = req.query;
    res.json(db.getComments(articleId as string, status as string));
  });

  app.post('/api/comments', async (req, res) => {
    try {
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const comment = db.addComment(req.body, clientIp);
      await db.flush();
      res.status(201).json(comment);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(429).json({ error: msg });
    }
  });

  app.put('/api/comments/:id/status', requireAdmin, async (req, res) => {
    try {
      const updated = db.updateCommentStatus(req.params.id, req.body.status);
      await db.flush();
      res.json(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(404).json({ error: msg });
    }
  });

  // Settings
  app.get('/api/settings', refreshDb, (req, res) => {
    res.json(db.getSettings());
  });

  app.put('/api/settings', requireAdmin, async (req, res) => {
    const updated = db.updateSettings(req.body);
    await db.flush();
    res.json(updated);
  });

  // Logs
  app.get('/api/logs', refreshDb, (req, res) => {
    res.json(db.getLogs());
  });

  // Vercel Cron: exactly once per hour according to vercel.json.
  // When CRON_SECRET is configured, Vercel sends it as a Bearer token.
  app.get('/api/cron/hourly', async (req, res) => {
    try {
      await db.refresh(0);
      const cronSecret = process.env.CRON_SECRET;
      if (!cronSecret && process.env.VERCEL) {
        return res.status(503).json({
          error: 'CRON_SECRET is required before scheduled ingestion can run on Vercel.',
        });
      }
      if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized cron request' });
      }

      if (db.getSettings().autoIngestEnabled === false) {
        return res.json({
          success: true,
          count: 0,
          skipped: true,
          message: 'Scheduled ingest is disabled in Newsroom Settings.',
          ranAt: new Date().toISOString(),
        });
      }

      const result = await runRssImportJob();
      await db.flush();
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        ...result,
        ranAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // Automation Pipeline
  app.post('/api/automation/run', requireAdmin, async (req, res) => {
    const result = await runRssImportJob();
    await db.flush();
    res.json(result);
  });

  // Automated Hourly Crawler Status & Manual Trigger
  app.get('/api/crawler/status', refreshDb, (req, res) => {
    res.json(getCrawlerStatus());
  });

  app.post('/api/crawler/run-now', requireAdmin, async (req, res) => {
    try {
      const result = await runCrawlerCycle();
      await db.flush();
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // Regenerate Single Article in Alternative Format (ensures correct source link is retrieved first)
  app.post('/api/articles/:id/regenerate', requireAdmin, async (req, res) => {
    try {
      const article = db.getArticleById(req.params.id);
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      // CRITICAL: Verify and ensure the correct authentic source link is retrieved before regenerating content
      const verifiedSource = await resolveAuthenticSourceLink(article);
      if (verifiedSource.wasUpdated || article.originalUrl !== verifiedSource.originalUrl) {
        article.originalUrl = verifiedSource.originalUrl;
        article.originalSource = verifiedSource.originalSource;
        db.updateArticle(article.id, {
          originalUrl: verifiedSource.originalUrl,
          originalSource: verifiedSource.originalSource,
        });
      }

      const format = (req.body.format as AlternativeFormatType) || 'executive-brief';
      const updatedTranslations = await regenerateArticleInAlternativeFormat(article, format);
      const updated = db.updateArticle(article.id, {
        originalUrl: article.originalUrl,
        originalSource: article.originalSource,
        translations: updatedTranslations,
        updatedAt: new Date().toISOString(),
      });
      res.json({
        success: true,
        article: updated,
        verifiedSourceLink: verifiedSource.originalUrl,
        sourceUpdated: verifiedSource.wasUpdated,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // Regenerate ALL Articles in Alternative Format (ensures correct source link is retrieved for each first)
  app.post('/api/articles/regenerate-all', requireAdmin, async (req, res) => {
    try {
      const format = (req.body.format as AlternativeFormatType) || 'executive-brief';
      const articles = db.getArticles();
      let updatedCount = 0;
      let linksRepairedCount = 0;

      for (const a of articles) {
        try {
          // Verify and retrieve authentic link before regenerating
          const verifiedSource = await resolveAuthenticSourceLink(a);
          if (verifiedSource.wasUpdated || a.originalUrl !== verifiedSource.originalUrl) {
            a.originalUrl = verifiedSource.originalUrl;
            a.originalSource = verifiedSource.originalSource;
            db.updateArticle(a.id, {
              originalUrl: verifiedSource.originalUrl,
              originalSource: verifiedSource.originalSource,
            });
            linksRepairedCount++;
          }

          const newTrans = await regenerateArticleInAlternativeFormat(a, format);
          db.updateArticle(a.id, {
            originalUrl: a.originalUrl,
            originalSource: a.originalSource,
            translations: newTrans,
            updatedAt: new Date().toISOString(),
          });
          updatedCount++;
        } catch (innerErr) {
          console.warn(`Failed regenerating article ${a.id}:`, innerErr);
        }
      }

      res.json({
        success: true,
        updatedCount,
        linksRepairedCount,
        format,
        message: `Successfully verified source links and regenerated ${updatedCount} articles in '${format}' format with authentic, verified original sources.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // AI Editorial Generation
  app.post('/api/ai/generate', requireAdmin, async (req, res) => {
    try {
      const { prompt, description, category, sourceName, sourceUrl } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      // Ensure authentic source link is resolved if missing or dummy
      const verifiedSource = await resolveAuthenticSourceLink({
        category,
        originalSource: sourceName,
        originalUrl: sourceUrl,
        title: prompt,
      });

      // If description was not provided, attempt to extract it from the authentic source webpage
      let finalDesc = description;
      if (!finalDesc && verifiedSource.originalUrl) {
        const pageMeta = await extractOfficialPageMetadata(verifiedSource.originalUrl);
        if (pageMeta.description) {
          finalDesc = pageMeta.description;
        }
      }

      const draft = await generateEditorialDraft(
        prompt,
        category,
        verifiedSource.originalSource,
        verifiedSource.originalUrl,
        finalDesc
      );
      res.json(draft);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // AI SEO Optimization for ALL Articles (Medium length, human tone, verifies authentic links first)
  app.post('/api/articles/optimize-all-seo', requireAdmin, async (req, res) => {
    try {
      const articles = db.getArticles();
      let optimizedCount = 0;
      let linksVerifiedCount = 0;

      for (const a of articles) {
        try {
          // Retrieve and verify authentic source link first
          const verifiedSource = await resolveAuthenticSourceLink(a);
          if (verifiedSource.wasUpdated || a.originalUrl !== verifiedSource.originalUrl) {
            a.originalUrl = verifiedSource.originalUrl;
            a.originalSource = verifiedSource.originalSource;
            db.updateArticle(a.id, {
              originalUrl: verifiedSource.originalUrl,
              originalSource: verifiedSource.originalSource,
            });
            linksVerifiedCount++;
          }

          const optimizedTrans = await optimizeArticleForSEOAndSearch(a);
          db.updateArticle(a.id, {
            originalUrl: a.originalUrl,
            originalSource: a.originalSource,
            translations: optimizedTrans,
            updatedAt: new Date().toISOString(),
          });
          optimizedCount++;
        } catch (innerErr) {
          console.warn(`Failed SEO optimization for article ${a.id}:`, innerErr);
        }
      }

      res.json({
        success: true,
        optimizedCount,
        linksVerifiedCount,
        message: `Successfully verified source links and rewrote ${optimizedCount} articles for Google Search & Google News indexing. All articles have verified live original sources and standard HTML <strong> formatting.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // AI SEO Optimization for Single Article (verifies authentic link first)
  app.post('/api/articles/:id/optimize-seo', requireAdmin, async (req, res) => {
    try {
      const article = db.getArticleById(req.params.id);
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      // Verify and retrieve authentic source link first
      const verifiedSource = await resolveAuthenticSourceLink(article);
      if (verifiedSource.wasUpdated || article.originalUrl !== verifiedSource.originalUrl) {
        article.originalUrl = verifiedSource.originalUrl;
        article.originalSource = verifiedSource.originalSource;
        db.updateArticle(article.id, {
          originalUrl: verifiedSource.originalUrl,
          originalSource: verifiedSource.originalSource,
        });
      }

      const optimizedTrans = await optimizeArticleForSEOAndSearch(article);
      const updated = db.updateArticle(article.id, {
        originalUrl: article.originalUrl,
        originalSource: article.originalSource,
        translations: optimizedTrans,
        updatedAt: new Date().toISOString(),
      });
      res.json({
        success: true,
        article: updated,
        verifiedSourceLink: verifiedSource.originalUrl,
        sourceUpdated: verifiedSource.wasUpdated,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // Verify and Auto-Retrieve Authentic Source Link for a Single Article
  app.post('/api/articles/:id/verify-source-link', requireAdmin, async (req, res) => {
    try {
      const article = db.getArticleById(req.params.id);
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      const verification = await resolveAuthenticSourceLink(article);
      let updatedArticle = article;
      if (verification.wasUpdated || article.originalUrl !== verification.originalUrl) {
        updatedArticle = db.updateArticle(article.id, {
          originalUrl: verification.originalUrl,
          originalSource: verification.originalSource,
          updatedAt: new Date().toISOString(),
        });
      }

      res.json({
        success: true,
        verified: verification,
        article: updatedArticle,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // Verify & Repair ALL Article Source Links in Database
  app.post('/api/articles/verify-all-source-links', requireAdmin, async (req, res) => {
    try {
      const articles = db.getArticles();
      let repairedCount = 0;
      let alreadyValidCount = 0;
      const results: Array<{ id: string; originalUrl: string; status: string }> = [];

      for (const a of articles) {
        const check = await resolveAuthenticSourceLink(a);
        if (check.wasUpdated || a.originalUrl !== check.originalUrl) {
          db.updateArticle(a.id, {
            originalUrl: check.originalUrl,
            originalSource: check.originalSource,
            updatedAt: new Date().toISOString(),
          });
          repairedCount++;
          results.push({ id: a.id, originalUrl: check.originalUrl, status: 'repaired' });
        } else {
          alreadyValidCount++;
          results.push({ id: a.id, originalUrl: check.originalUrl, status: 'valid' });
        }
      }

      res.json({
        success: true,
        totalArticles: articles.length,
        repairedCount,
        alreadyValidCount,
        results,
        message: `Verified all articles: ${alreadyValidCount} already valid, ${repairedCount} repaired with authentic source links.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // AI Auto-Translate Article from ONE authored language to all 5 platform languages
  app.post('/api/ai/translate-article', requireAdmin, async (req, res) => {
    try {
      const { title, executiveSummary, structuredBody, category, sourceLang, keywords } = req.body;
      if (!title || !structuredBody || !sourceLang) {
        return res.status(400).json({ error: 'Title, structuredBody, and sourceLang are required' });
      }
      const translations = await translateArticleToAllLanguages({
        title,
        executiveSummary: executiveSummary || title,
        structuredBody,
        category: category || 'world',
        sourceLang,
        keywords,
      });
      res.json({ success: true, translations });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // Resolve Video Metadata (extracts responsive iframe embed URL and takes/extracts screenshot)
  app.post('/api/media/resolve-video', requireAdmin, (req, res) => {
    try {
      const { videoUrl } = req.body;
      if (!videoUrl) {
        return res.status(400).json({ error: 'videoUrl is required' });
      }
      const meta = resolveVideoMetadata(videoUrl);
      if (!meta) {
        return res.status(400).json({ error: 'Unable to parse video URL or embed code. Supported: YouTube, Vimeo, MP4, WebM.' });
      }
      res.json({ success: true, ...meta });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // Generate or Search AI Image for Article based on Title & Description
  // (Preferred option: AI generation with Gemini, with fallback to curated high-aesthetic relevant search)
  app.post('/api/ai/generate-article-image', requireAdmin, async (req, res) => {
    try {
      const { title, description, category, videoThumbnail, forceAiGeneration } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'Title is required for image generation/search' });
      }
      const result = await resolveOrGenerateArticleImage({
        title,
        description,
        category,
        videoThumbnail,
        forceAiGeneration: forceAiGeneration ?? true,
      });
      res.json({ success: true, ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // Automatically Resolve Media for a Single Article (screenshot for video, AI image if image missing)
  app.post('/api/articles/:id/resolve-media', requireAdmin, async (req, res) => {
    try {
      const article = db.getArticleById(req.params.id);
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      const updates: Partial<Article> = {};
      let videoMeta = null;

      if (article.videoUrl) {
        videoMeta = resolveVideoMetadata(article.videoUrl);
        if (videoMeta) {
          updates.hasVideo = true;
          updates.videoIframeUrl = videoMeta.videoIframeUrl;
          updates.videoThumbnail = videoMeta.videoThumbnail;
        }
      }

      // If article lacks an image, or image is empty
      if (!article.image || article.image.trim() === '') {
        const trans = article.translations?.en || article.translations?.ar || Object.values(article.translations)[0];
        const resolvedImage = await resolveOrGenerateArticleImage({
          title: trans?.title || 'World News Dispatch',
          description: trans?.executiveSummary || '',
          category: article.category,
          videoThumbnail: updates.videoThumbnail || article.videoThumbnail,
        });
        updates.image = resolvedImage.image;
        updates.imageCredit = resolvedImage.imageCredit;
        updates.imageProvenance = resolvedImage.imageProvenance;
        updates.imageLicense = resolvedImage.imageLicense;
      }

      const updated = db.updateArticle(article.id, {
        ...updates,
        updatedAt: new Date().toISOString(),
      });

      res.json({ success: true, article: updated, updatesApplied: updates });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // Archival Image Proxy (Bypasses hotlinking/403 forbidden headers and preserves press pool photography)
  app.get('/api/media/archived-photo', async (req, res) => {
    try {
      const rawUrl = req.query.url as string;
      if (!rawUrl) {
        return res.status(400).send('Missing image url parameter');
      }

      const decodedUrl = decodeURIComponent(rawUrl);
      if (!decodedUrl.startsWith('http://') && !decodedUrl.startsWith('https://')) {
        return res.status(400).send('Invalid image url format');
      }

      // Fetch official image server-side with standard desktop browser headers and no Referer
      const imgRes = await fetch(decodedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Cache-Control': 'no-cache',
        },
      });

      if (!imgRes.ok) {
        // If upstream fails with 403/404, redirect to high-resolution editorial backup photo
        return res.redirect('https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80');
      }

      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
      res.setHeader('X-Archival-Source', 'World News Digital Preservation System');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      const arrayBuffer = await imgRes.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err: unknown) {
      res.redirect('https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80');
    }
  });

  // Get or Create Archival Verification Snapshot for an Article
  app.get('/api/articles/:id/archive-snapshot', refreshDb, async (req, res) => {
    try {
      const article = db.getArticleById(req.params.id);
      if (!article) return res.status(404).json({ error: 'Article not found' });

      if (!article.archiveSnapshot) {
        const trans = article.translations.en || article.translations.ar || Object.values(article.translations)[0];
        const snapshot = createArchiveSnapshot({
          headline: trans?.title || 'World News Dispatch',
          description: article.originalDescription || trans?.executiveSummary || trans?.title || '',
          sourceUrl: article.originalUrl,
          sourceAgency: article.originalSource,
        });
        const updated = db.updateArticle(article.id, {
          archiveSnapshot: snapshot,
          originalDescription: article.originalDescription || trans?.executiveSummary,
        });
        return res.json({ success: true, snapshot, article: updated });
      }

      res.json({ success: true, snapshot: article.archiveSnapshot });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // Automatically Audit & Fix All Media across the Article Library:
  // - Resolves video screenshots and embeds video iframes
  // - Extracts official news description & official images from original URLs
  // - Preserves digital archive snapshots for all articles
  app.post('/api/media/auto-fix-all-media', requireAdmin, async (req, res) => {
    try {
      const articles = db.getArticles();
      let fixedVideos = 0;
      let fixedImages = 0;
      let archivedCount = 0;

      for (const a of articles) {
        const updates: Partial<Article> = {};
        let videoThumbnail = a.videoThumbnail;

        // 1. If video URL exists but iframe or thumbnail missing
        if (a.videoUrl && (!a.videoIframeUrl || !a.videoThumbnail || !a.hasVideo)) {
          const videoMeta = resolveVideoMetadata(a.videoUrl);
          if (videoMeta) {
            updates.hasVideo = true;
            updates.videoIframeUrl = videoMeta.videoIframeUrl;
            updates.videoThumbnail = videoMeta.videoThumbnail;
            videoThumbnail = videoMeta.videoThumbnail;
            fixedVideos++;
          }
        }

        // 2. If article lacks an image or has empty/invalid image
        if (!a.image || a.image.trim() === '') {
          const trans = a.translations?.en || a.translations?.ar || Object.values(a.translations)[0];
          const resolvedImage = await resolveOrGenerateArticleImage({
            title: trans?.title || 'World News Dispatch',
            description: a.originalDescription || trans?.executiveSummary || '',
            category: a.category,
            videoThumbnail,
          });
          updates.image = resolvedImage.image;
          updates.imageCredit = resolvedImage.imageCredit;
          updates.imageProvenance = resolvedImage.imageProvenance;
          updates.imageLicense = resolvedImage.imageLicense;
          fixedImages++;
        }

        // 3. Ensure official metadata and digital archive snapshot exist
        if (!a.archiveSnapshot || !a.originalDescription) {
          const trans = a.translations?.en || a.translations?.ar || Object.values(a.translations)[0];
          const headline = trans?.title || 'World News Dispatch';
          let description = a.originalDescription || trans?.executiveSummary || '';

          // If original description was missing, try pulling it from the originalUrl
          if (!description && a.originalUrl) {
            const pageMeta = await extractOfficialPageMetadata(a.originalUrl);
            if (pageMeta.description) {
              description = pageMeta.description;
              updates.originalDescription = description;
            }
            if (pageMeta.imageUrl && !a.officialImageUrl) {
              updates.officialImageUrl = pageMeta.imageUrl;
            }
          }

          if (!a.originalDescription && description) {
            updates.originalDescription = description;
          }

          const snapshot = createArchiveSnapshot({
            headline,
            description: description || headline,
            sourceUrl: a.originalUrl,
            sourceAgency: a.originalSource,
          });
          updates.archiveSnapshot = snapshot;
          archivedCount++;
        }

        if (Object.keys(updates).length > 0) {
          db.updateArticle(a.id, updates);
        }
      }

      res.json({
        success: true,
        fixedVideos,
        fixedImages,
        archivedCount,
        message: `Media and archival audit complete: ${fixedVideos} video iframes/screenshots linked, ${fixedImages} missing images resolved, ${archivedCount} digital preservation records verified.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // Traditional setInterval is only useful for local/long-lived servers.
  // Vercel production uses the authenticated Cron route above.
  if (!process.env.VERCEL) {
    startHourlyCrawlerScheduler();
  }

  // ==========================================
  // Local frontend integration only.
  // Vercel serves the Vite build from its CDN and routes API traffic to api/index.ts.
  // ==========================================
  if (options.serveFrontend) {
    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  const errorHandler: express.ErrorRequestHandler = (err, _req, res, _next) => {
    console.error('[World News API] Unhandled request error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  app.use(errorHandler);

  return app;
}

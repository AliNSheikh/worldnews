import { Article, Category, Comment, NewsSource, AutomationLog, SiteSettings } from '../src/types';
import {
  INITIAL_ARTICLES,
  INITIAL_CATEGORIES,
  INITIAL_COMMENTS,
  INITIAL_AUTOMATION_LOGS,
  INITIAL_SITE_SETTINGS,
} from '../src/data/initialData';
import { PRODUCTION_NEWS_SOURCES } from './productionSources';
import { createArchiveSnapshot } from './officialMediaAndArchive';
import {
  getPersistenceProvider,
  isPersistenceConfigured,
  persistence,
} from './persistence';


function sanitizeBoldFormatting(text: string): string {
  if (!text) return '';
  return text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
}

function cleanArticlesBoldFormatting(rawArticles: Article[]): Article[] {
  return rawArticles.map((art) => {
    const cleanedTranslations = { ...art.translations };
    for (const key of Object.keys(cleanedTranslations)) {
      const lang = key as keyof typeof cleanedTranslations;
      if (cleanedTranslations[lang]) {
        cleanedTranslations[lang] = {
          ...cleanedTranslations[lang],
          executiveSummary: sanitizeBoldFormatting(cleanedTranslations[lang].executiveSummary || ''),
          structuredBody: sanitizeBoldFormatting(cleanedTranslations[lang].structuredBody || ''),
        };
      }
    }

    const primaryTrans = cleanedTranslations.en || cleanedTranslations.ar || Object.values(cleanedTranslations)[0];
    const headline = primaryTrans?.title || 'World News Dispatch';
    const description = art.originalDescription || primaryTrans?.executiveSummary || headline;

    const archiveSnapshot = art.archiveSnapshot || createArchiveSnapshot({
      headline,
      description,
      sourceUrl: art.originalUrl,
      sourceAgency: art.originalSource,
    });

    return {
      ...art,
      originalDescription: description,
      archiveSnapshot,
      translations: cleanedTranslations,
    };
  });
}

class NewsroomDatabase {
  public articles: Article[] = cleanArticlesBoldFormatting([...INITIAL_ARTICLES]);
  public categories: Category[] = [...INITIAL_CATEGORIES];
  public sources: NewsSource[] = PRODUCTION_NEWS_SOURCES.map((source) => ({ ...source }));
  public comments: Comment[] = [...INITIAL_COMMENTS];
  public logs: AutomationLog[] = [...INITIAL_AUTOMATION_LOGS];
  public settings: SiteSettings = { ...INITIAL_SITE_SETTINGS };
  public persistenceError: string | null = null;

  private commentRateLimits = new Map<string, number[]>();
  private readyPromise: Promise<void> | null = null;
  private refreshPromise: Promise<void> | null = null;
  private lastHydratedAt = 0;
  private pendingWrites = new Set<Promise<unknown>>();
  private pendingWriteErrors: string[] = [];

  public async ready(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = this.hydrateFromPersistence().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.persistenceError = message;
        this.lastHydratedAt = Date.now();

        if (isPersistenceConfigured()) {
          this.articles = [];
          this.comments = [];
          this.logs = [];
        }

        console.error('[World News DB] Initial persistence hydration failed:', error);
      });
    }
    await this.readyPromise;
  }

  public async refresh(maxAgeMs = 5000): Promise<void> {
    await this.ready();

    if (!isPersistenceConfigured() || Date.now() - this.lastHydratedAt < maxAgeMs) {
      return;
    }

    if (!this.refreshPromise) {
      this.refreshPromise = (async () => {
        await this.flush();
        await this.hydrateFromPersistence();
      })().finally(() => {
        this.refreshPromise = null;
      });
    }

    await this.refreshPromise;
  }

  private async hydrateFromPersistence(): Promise<void> {
    if (!isPersistenceConfigured()) {
      this.lastHydratedAt = Date.now();
      this.persistenceError = process.env.VERCEL
        ? 'Persistent storage is not configured in Vercel. TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required.'
        : null;
      console.warn('[World News DB] Persistent storage is not configured; using in-memory data.');
      return;
    }

    const snapshot = await persistence.loadSnapshot();

    this.articles = snapshot.articles.length > 0
      ? cleanArticlesBoldFormatting(snapshot.articles)
      : [];

    if (snapshot.categories.length > 0) {
      this.categories = snapshot.categories;
    } else {
      await Promise.all(this.categories.map((category) => persistence.upsertCategory(category)));
    }

    if (snapshot.sources.length > 0) {
      this.sources = snapshot.sources;
    } else {
      await Promise.all(this.sources.map((source) => persistence.upsertSource(source)));
    }

    this.comments = snapshot.comments;
    this.logs = snapshot.logs;

    if (snapshot.settings) {
      this.settings = snapshot.settings;
    } else {
      await persistence.upsertSettings(this.settings);
    }

    this.lastHydratedAt = Date.now();
    this.persistenceError = null;

    console.info(
      `[World News DB] Hydrated ${getPersistenceProvider()} state: ${this.articles.length} articles, ${this.sources.length} sources.`
    );
  }

  private queueWrite(write: Promise<unknown>): void {
    let tracked: Promise<unknown>;
    tracked = write
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.persistenceError = message;
        this.pendingWriteErrors.push(message);
        console.error('[World News DB] Persistence write failed:', error);
      })
      .finally(() => {
        this.pendingWrites.delete(tracked);
      });

    this.pendingWrites.add(tracked);
  }

  public async flush(): Promise<void> {
    if (this.pendingWrites.size > 0) {
      await Promise.allSettled([...this.pendingWrites]);
    }

    if (this.pendingWriteErrors.length > 0) {
      const uniqueErrors = [...new Set(this.pendingWriteErrors)];
      this.pendingWriteErrors = [];
      throw new Error(`Persistence synchronization failed: ${uniqueErrors.join(' | ')}`);
    }
  }

  public async syncAllToPersistence(): Promise<{
    provider: string;
    articles: number;
    categories: number;
    sources: number;
    comments: number;
    logs: number;
    settings: number;
  }> {
    if (!isPersistenceConfigured()) {
      throw new Error(
        'Persistent storage is not configured. Add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN to the active Vercel Production environment and redeploy.'
      );
    }

    await Promise.all([
      ...this.articles.map((article) => persistence.upsertArticle(article)),
      ...this.categories.map((category) => persistence.upsertCategory(category)),
      ...this.sources.map((source) => persistence.upsertSource(source)),
      ...this.comments.map((comment) => persistence.upsertComment(comment)),
      ...this.logs.map((log) => persistence.upsertLog(log)),
      persistence.upsertSettings(this.settings),
    ]);

    this.persistenceError = null;
    this.lastHydratedAt = Date.now();

    return {
      provider: getPersistenceProvider(),
      articles: this.articles.length,
      categories: this.categories.length,
      sources: this.sources.length,
      comments: this.comments.length,
      logs: this.logs.length,
      settings: 1,
    };
  }

  public getPersistenceStatus() {
    return {
      provider: getPersistenceProvider(),
      configured: isPersistenceConfigured(),
      error: this.persistenceError,
      lastHydratedAt: this.lastHydratedAt ? new Date(this.lastHydratedAt).toISOString() : null,
    };
  }

  public getArticles(filters?: { category?: string; status?: string; search?: string; limit?: number; offset?: number }): Article[] {
    let list = [...this.articles];
    if (filters?.status) {
      list = list.filter((a) => a.status === filters.status);
    }
    if (filters?.category && filters.category !== 'all') {
      list = list.filter((a) => a.category === filters.category);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter((a) => {
        const t = a.translations.en;
        return Boolean(
          (t &&
            (t.title.toLowerCase().includes(q) ||
              t.executiveSummary.toLowerCase().includes(q) ||
              t.keywords.some((k) => k.toLowerCase().includes(q)))) ||
            a.originalSource.toLowerCase().includes(q)
        );
      });
    }
    const sorted = list.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    const offset = Math.max(0, Number(filters?.offset || 0));
    const limit = filters?.limit ? Math.max(1, Math.min(100, Number(filters.limit))) : undefined;
    return limit ? sorted.slice(offset, offset + limit) : sorted.slice(offset);
  }

  public getArticleById(id: string): Article | undefined {
    return this.articles.find((a) => a.id === id);
  }

  public getArticleBySlug(slug: string): Article | undefined {
    return this.articles.find((a) => a.translations.en?.slug === slug);
  }

  public createArticle(articleInput: Partial<Article>): Article {
    const now = new Date().toISOString();
    const id = articleInput.id?.trim() || `art-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const incomingTranslations = (articleInput.translations || {}) as any;
    const languageCodes = ['en'] as const;

    if (articleInput.originalUrl && this.articles.some((a) => a.originalUrl === articleInput.originalUrl)) {
      throw new Error(`Article with original URL '${articleInput.originalUrl}' already exists.`);
    }

    const hasAnyTitle = languageCodes.some((lang) => String(incomingTranslations?.[lang]?.title || '').trim());
    if (!hasAnyTitle) {
      throw new Error('The English edition must contain an article title.');
    }

    const translations = {} as Article['translations'];

    for (const lang of languageCodes) {
      const raw = incomingTranslations?.[lang] || {};
      const title = String(raw.title || '').trim();
      const requestedSlug = String(raw.slug || title || id)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\u0600-\u06ff]+/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      const baseSlug = requestedSlug || id;

      let candidate = baseSlug;
      let suffix = 2;
      while (
        this.articles.some((existing) => {
          const existingTranslation = existing.translations?.[lang];
          return existingTranslation?.slug === candidate;
        })
      ) {
        candidate = `${baseSlug}-${suffix++}`;
      }

      translations[lang] = {
        language: lang,
        title,
        slug: candidate,
        executiveSummary: String(raw.executiveSummary || title || ''),
        structuredBody: String(raw.structuredBody || raw.executiveSummary || ''),
        seoTitle: String(raw.seoTitle || title || '').slice(0, 70),
        metaDescription: String(raw.metaDescription || raw.executiveSummary || title || '').slice(0, 180),
        keywords: Array.isArray(raw.keywords) ? raw.keywords.filter(Boolean) : [],
        tags: Array.isArray(raw.tags) ? raw.tags.filter(Boolean) : [],
        imageAlt: String(raw.imageAlt || title || 'World News article image'),
        faq: Array.isArray(raw.faq) ? raw.faq : [],
        translationStatus: raw.translationStatus || 'draft',
        entities: Array.isArray(raw.entities) ? raw.entities : [],
        ...(raw.corrections ? { corrections: String(raw.corrections) } : {}),
      };
    }

    const primaryTranslation = translations.en.title
      ? translations.en
      : Object.values(translations).find((translation) => translation.title) || translations.en;

    const image = articleInput.image || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80';

    const article: Article = {
      id,
      category: articleInput.category || 'world',
      editorialType: articleInput.editorialType || 'original',
      originalSource: articleInput.originalSource?.trim() || 'World News Desk',
      originalUrl: articleInput.originalUrl?.trim() || `https://worldnews.org/wire/${id}`,
      originalDescription: articleInput.originalDescription || primaryTranslation.executiveSummary || primaryTranslation.title,
      officialImageUrl: articleInput.officialImageUrl,
      archiveSnapshot: articleInput.archiveSnapshot,
      image,
      imageCredit: articleInput.imageCredit?.trim() || 'World News Photo Service',
      imageProvenance:
        articleInput.imageProvenance ||
        (image.startsWith('data:image/')
          ? 'Manual image upload through the World News CMS.'
          : 'Image URL supplied through the World News CMS.'),
      imageLicense: articleInput.imageLicense?.trim() || 'Editorial Press License',
      status: articleInput.status || 'draft',
      isBreaking: Boolean(articleInput.isBreaking),
      isPinned: Boolean(articleInput.isPinned),
      priority: Number.isFinite(articleInput.priority) ? Number(articleInput.priority) : 5,
      views: Number.isFinite(articleInput.views) ? Number(articleInput.views) : 0,
      shares: Number.isFinite(articleInput.shares) ? Number(articleInput.shares) : 0,
      publishedAt: articleInput.publishedAt || now,
      updatedAt: now,
      scheduledAt: articleInput.scheduledAt,
      byline: articleInput.byline?.trim() || 'World News Editorial Staff',
      translations,
      hasVideo: Boolean(articleInput.hasVideo),
      videoUrl: articleInput.videoUrl,
      videoIframeUrl: articleInput.videoIframeUrl,
      videoThumbnail: articleInput.videoThumbnail,
    };

    this.articles.unshift(article);
    this.queueWrite(persistence.upsertArticle(article));
    return article;
  }

  public updateArticle(id: string, updates: Partial<Article>): Article {
    const idx = this.articles.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error(`Article with id '${id}' not found.`);
    this.articles[idx] = {
      ...this.articles[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.queueWrite(persistence.upsertArticle(this.articles[idx]));
    return this.articles[idx];
  }

  public deleteArticle(id: string): boolean {
    const initialLen = this.articles.length;
    this.articles = this.articles.filter((a) => a.id !== id);
    const deleted = this.articles.length < initialLen;
    if (deleted) this.queueWrite(persistence.deleteArticle(id));
    return deleted;
  }

  public incrementViews(id: string): number {
    const article = this.articles.find((a) => a.id === id);
    if (article) {
      article.views = (article.views || 0) + 1;
      this.queueWrite(persistence.upsertArticle(article));
      return article.views;
    }
    return 0;
  }

  public getComments(articleId?: string, status?: string): Comment[] {
    let list = [...this.comments];
    if (articleId) list = list.filter((c) => c.articleId === articleId);
    if (status) list = list.filter((c) => c.moderationStatus === status);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public addComment(comment: Omit<Comment, 'id' | 'createdAt' | 'moderationStatus'>, clientIp = '127.0.0.1'): Comment {
    const now = Date.now();
    const timestamps = this.commentRateLimits.get(clientIp) || [];
    const recent = timestamps.filter((t) => now - t < 60000);
    if (recent.length >= 3) {
      throw new Error('Rate limit exceeded: You may submit at most 3 comments per minute. Please try again shortly.');
    }
    recent.push(now);
    this.commentRateLimits.set(clientIp, recent);

    const isSpam =
      comment.content.includes('http://spam') ||
      comment.content.includes('viagra') ||
      comment.content.includes('crypto-profit-guaranteed') ||
      comment.authorName.toLowerCase().includes('bot');

    const moderationStatus: Comment['moderationStatus'] = isSpam
      ? 'spam'
      : this.settings.commentModeration === 'strict_approval'
        ? 'pending'
        : 'approved';

    const newComment: Comment = {
      id: `comm-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      articleId: comment.articleId,
      authorName: comment.authorName.trim(),
      content: comment.content.trim(),
      moderationStatus,
      createdAt: new Date().toISOString(),
      language: comment.language,
    };

    this.comments.unshift(newComment);
    this.queueWrite(persistence.upsertComment(newComment));
    return newComment;
  }

  public updateCommentStatus(commentId: string, status: Comment['moderationStatus']): Comment {
    const comment = this.comments.find((c) => c.id === commentId);
    if (!comment) throw new Error('Comment not found');
    comment.moderationStatus = status;
    this.queueWrite(persistence.upsertComment(comment));
    return comment;
  }

  public getSources(): NewsSource[] {
    return this.sources;
  }

  public updateSource(id: string, updates: Partial<NewsSource>): NewsSource {
    const idx = this.sources.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error('Source not found');
    this.sources[idx] = { ...this.sources[idx], ...updates };
    this.queueWrite(persistence.upsertSource(this.sources[idx]));
    return this.sources[idx];
  }

  public addSource(source: Omit<NewsSource, 'id'>): NewsSource {
    const newSource: NewsSource = { ...source, id: `src-${Date.now()}` };
    this.sources.push(newSource);
    this.queueWrite(persistence.upsertSource(newSource));
    return newSource;
  }

  public deleteSource(id: string): boolean {
    const initialLen = this.sources.length;
    this.sources = this.sources.filter((s) => s.id !== id);
    const deleted = this.sources.length < initialLen;
    if (deleted) this.queueWrite(persistence.deleteSource(id));
    return deleted;
  }

  public getCategories(): Category[] {
    return [...this.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  public updateCategory(id: string, updates: Partial<Category>): Category {
    const idx = this.categories.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Category not found');
    this.categories[idx] = { ...this.categories[idx], ...updates };
    this.queueWrite(persistence.upsertCategory(this.categories[idx]));
    return this.categories[idx];
  }

  public getSettings(): SiteSettings {
    return this.settings;
  }

  public updateSettings(updates: Partial<SiteSettings>): SiteSettings {
    this.settings = { ...this.settings, ...updates };
    this.queueWrite(persistence.upsertSettings(this.settings));
    return this.settings;
  }

  public addLog(log: Omit<AutomationLog, 'id'>): AutomationLog {
    const entry: AutomationLog = {
      ...log,
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    this.logs.unshift(entry);
    if (this.logs.length > 100) this.logs.pop();
    this.queueWrite(persistence.upsertLog(entry));
    return entry;
  }

  public getLogs(): AutomationLog[] {
    return this.logs;
  }
}

export const db = new NewsroomDatabase();

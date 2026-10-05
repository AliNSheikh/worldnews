import { Article, Category, Comment, NewsSource, AutomationLog, SiteSettings } from '../src/types';
import {
  INITIAL_ARTICLES,
  INITIAL_CATEGORIES,
  INITIAL_NEWS_SOURCES,
  INITIAL_COMMENTS,
  INITIAL_AUTOMATION_LOGS,
  INITIAL_SITE_SETTINGS,
} from '../src/data/initialData';
import { sanitizeBoldFormatting } from './gemini';
import { createArchiveSnapshot } from './officialMediaAndArchive';
import { isPersistenceConfigured, persistence } from './persistence';

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
  public sources: NewsSource[] = [...INITIAL_NEWS_SOURCES];
  public comments: Comment[] = [...INITIAL_COMMENTS];
  public logs: AutomationLog[] = [...INITIAL_AUTOMATION_LOGS];
  public settings: SiteSettings = { ...INITIAL_SITE_SETTINGS };

  // Rate limiting map for comment submission: IP or fingerprint -> timestamp array
  private commentRateLimits = new Map<string, number[]>();
  private readyPromise: Promise<void> | null = null;
  private refreshPromise: Promise<void> | null = null;
  private lastHydratedAt = 0;
  private pendingWrites = new Set<Promise<unknown>>();

  public async ready(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = this.hydrateFromPersistence();
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
      console.info('[World News DB] Supabase is not configured; using development seed data in memory.');
      return;
    }

    const snapshot = await persistence.loadSnapshot();

    // When persistent storage is enabled, never publish bundled demo articles.
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

    console.info(
      `[World News DB] Hydrated persistent newsroom state: ${this.articles.length} articles, ${this.sources.length} sources.`
    );
  }

  private queueWrite(write: Promise<unknown>): void {
    let tracked: Promise<unknown>;
    tracked = write
      .catch((error) => {
        console.error('[World News DB] Persistence write failed:', error);
      })
      .finally(() => {
        this.pendingWrites.delete(tracked);
      });

    this.pendingWrites.add(tracked);
  }

  public async flush(): Promise<void> {
    if (this.pendingWrites.size === 0) return;
    await Promise.allSettled([...this.pendingWrites]);
  }

  // Articles
  public getArticles(filters?: { category?: string; status?: string; search?: string }): Article[] {
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
        return (
          Object.values(a.translations).some(
            (t) =>
              t.title.toLowerCase().includes(q) ||
              t.executiveSummary.toLowerCase().includes(q) ||
              t.keywords.some((k) => k.toLowerCase().includes(q))
          ) || a.originalSource.toLowerCase().includes(q)
        );
      });
    }
    return list.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }

  public getArticleById(id: string): Article | undefined {
    return this.articles.find((a) => a.id === id);
  }

  public getArticleBySlug(slug: string): Article | undefined {
    return this.articles.find((a) => Object.values(a.translations).some((t) => t.slug === slug));
  }

  public createArticle(article: Article): Article {
    // Check for duplicate original URL
    if (article.originalUrl && this.articles.some((a) => a.originalUrl === article.originalUrl)) {
      throw new Error(`Article with original URL '${article.originalUrl}' already exists.`);
    }

    // Every localized article URL must be unique within its language edition.
    for (const [lang, translation] of Object.entries(article.translations)) {
      const baseSlug = (translation.slug || article.id)
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || article.id;

      let candidate = baseSlug;
      let suffix = 2;
      while (
        this.articles.some((existing) => {
          const existingTranslation = existing.translations?.[lang as keyof typeof existing.translations];
          return existingTranslation?.slug === candidate;
        })
      ) {
        candidate = `${baseSlug}-${suffix++}`;
      }
      translation.slug = candidate;
    }

    this.articles.unshift(article);
    this.queueWrite(persistence.upsertArticle(article));
    return article;
  }

  public updateArticle(id: string, updates: Partial<Article>): Article {
    const idx = this.articles.findIndex((a) => a.id === id);
    if (idx === -1) {
      throw new Error(`Article with id '${id}' not found.`);
    }
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

  // Comments
  public getComments(articleId?: string, status?: string): Comment[] {
    let list = [...this.comments];
    if (articleId) {
      list = list.filter((c) => c.articleId === articleId);
    }
    if (status) {
      list = list.filter((c) => c.moderationStatus === status);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public addComment(comment: Omit<Comment, 'id' | 'createdAt' | 'moderationStatus'>, clientIp = '127.0.0.1'): Comment {
    // Rate limit: max 3 comments per minute from the same client
    const now = Date.now();
    const timestamps = this.commentRateLimits.get(clientIp) || [];
    const recent = timestamps.filter((t) => now - t < 60000);
    if (recent.length >= 3) {
      throw new Error('Rate limit exceeded: You may submit at most 3 comments per minute. Please try again shortly.');
    }
    recent.push(now);
    this.commentRateLimits.set(clientIp, recent);

    // Anti-spam check (simple basic checks for spam links or repetitive spam strings)
    const isSpam =
      comment.content.includes('http://spam') ||
      comment.content.includes('viagra') ||
      comment.content.includes('crypto-profit-guaranteed') ||
      comment.authorName.toLowerCase().includes('bot');

    const status = isSpam
      ? 'spam'
      : this.settings.commentModeration === 'strict_approval'
      ? 'pending'
      : 'approved';

    const newComment: Comment = {
      id: `comm-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      articleId: comment.articleId,
      authorName: comment.authorName.trim(),
      content: comment.content.trim(),
      moderationStatus: status,
      createdAt: new Date().toISOString(),
      language: comment.language,
    };

    this.comments.unshift(newComment);
    this.queueWrite(persistence.upsertComment(newComment));
    return newComment;
  }

  public updateCommentStatus(commentId: string, status: Comment['moderationStatus']): Comment {
    const comment = this.comments.find((c) => c.id === commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }
    comment.moderationStatus = status;
    this.queueWrite(persistence.upsertComment(comment));
    return comment;
  }

  // Sources
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
    const newSource: NewsSource = {
      ...source,
      id: `src-${Date.now()}`,
    };
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

  // Categories
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

  // Settings
  public getSettings(): SiteSettings {
    return this.settings;
  }

  public updateSettings(updates: Partial<SiteSettings>): SiteSettings {
    this.settings = { ...this.settings, ...updates };
    this.queueWrite(persistence.upsertSettings(this.settings));
    return this.settings;
  }

  // Logs
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

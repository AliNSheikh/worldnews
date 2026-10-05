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
import {
  deletePayload,
  isRemotePersistenceConfigured,
  loadPayloads,
  upsertPayload,
} from './persistence';

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

  public async initializePersistence(): Promise<void> {
    if (!isRemotePersistenceConfigured) {
      console.log('[World News DB] Supabase not configured; using in-memory seed data.');
      return;
    }

    try {
      const [articles, categories, sources, logs, settings] = await Promise.all([
        loadPayloads<Article>('articles'),
        loadPayloads<Category>('categories'),
        loadPayloads<NewsSource>('sources'),
        loadPayloads<AutomationLog>('automation_logs'),
        loadPayloads<SiteSettings>('site_settings'),
      ]);

      if (articles.length) this.articles = cleanArticlesBoldFormatting(articles);
      if (categories.length) this.categories = categories;
      if (sources.length) this.sources = sources;
      if (logs.length) this.logs = logs;
      if (settings.length) this.settings = settings[settings.length - 1];

      console.log(`[World News DB] Supabase hydrated: ${this.articles.length} articles, ${this.sources.length} sources.`);

      // First-run seed: persist current defaults only when a table is empty.
      if (!articles.length) await Promise.all(this.articles.map((a) => upsertPayload('articles', a.id, a)));
      if (!categories.length) await Promise.all(this.categories.map((x) => upsertPayload('categories', x.id, x)));
      if (!sources.length) await Promise.all(this.sources.map((x) => upsertPayload('sources', x.id, x)));
      if (!settings.length) await upsertPayload('site_settings', 'default', this.settings);
    } catch (error) {
      console.error('[World News DB] Supabase hydration failed; continuing with seed data:', error);
    }
  }

  private persist(table: 'articles' | 'categories' | 'sources' | 'automation_logs' | 'site_settings', id: string, payload: unknown) {
    if (!isRemotePersistenceConfigured) return;
    void upsertPayload(table, id, payload).catch((error) => {
      console.error(`[World News DB] Persistence failed for ${table}/${id}:`, error);
    });
  }

  private remove(table: 'articles' | 'categories' | 'sources' | 'automation_logs' | 'site_settings', id: string) {
    if (!isRemotePersistenceConfigured) return;
    void deletePayload(table, id).catch((error) => {
      console.error(`[World News DB] Delete persistence failed for ${table}/${id}:`, error);
    });
  }

  // Rate limiting map for comment submission: IP or fingerprint -> timestamp array
  private commentRateLimits = new Map<string, number[]>();

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
    this.articles.unshift(article);
    this.persist('articles', article.id, article);
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
    this.persist('articles', this.articles[idx].id, this.articles[idx]);
    return this.articles[idx];
  }

  public deleteArticle(id: string): boolean {
    const initialLen = this.articles.length;
    this.articles = this.articles.filter((a) => a.id !== id);
    const deleted = this.articles.length < initialLen;
    if (deleted) this.remove('articles', id);
    return deleted;
  }

  public incrementViews(id: string): number {
    const article = this.articles.find((a) => a.id === id);
    if (article) {
      article.views = (article.views || 0) + 1;
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
    return newComment;
  }

  public updateCommentStatus(commentId: string, status: Comment['moderationStatus']): Comment {
    const comment = this.comments.find((c) => c.id === commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }
    comment.moderationStatus = status;
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
    this.persist('sources', this.sources[idx].id, this.sources[idx]);
    return this.sources[idx];
  }

  public addSource(source: Omit<NewsSource, 'id'>): NewsSource {
    const newSource: NewsSource = {
      ...source,
      id: `src-${Date.now()}`,
    };
    this.sources.push(newSource);
    this.persist('sources', newSource.id, newSource);
    return newSource;
  }

  public deleteSource(id: string): boolean {
    const initialLen = this.sources.length;
    this.sources = this.sources.filter((s) => s.id !== id);
    const deleted = this.sources.length < initialLen;
    if (deleted) this.remove('sources', id);
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
    this.persist('categories', this.categories[idx].id, this.categories[idx]);
    return this.categories[idx];
  }

  // Settings
  public getSettings(): SiteSettings {
    return this.settings;
  }

  public updateSettings(updates: Partial<SiteSettings>): SiteSettings {
    this.settings = { ...this.settings, ...updates };
    this.persist('site_settings', 'default', this.settings);
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
    this.persist('automation_logs', entry.id, entry);
    return entry;
  }

  public getLogs(): AutomationLog[] {
    return this.logs;
  }
}

export const db = new NewsroomDatabase();

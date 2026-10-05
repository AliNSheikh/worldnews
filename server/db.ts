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
import { persistence } from './persistence';

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

  private persist(table: string, id: string, payload: unknown, extras: Record<string, unknown> = {}) {
    if (!persistence.enabled) return;
    void persistence.upsert(table, {
      id,
      payload,
      updated_at: new Date().toISOString(),
      ...extras,
    }).catch((err) => console.error('[Persistence] write failed:', err));
  }

  public async init(): Promise<void> {
    if (!persistence.enabled) {
      console.log('[Persistence] Supabase not configured; using in-memory development data.');
      return;
    }

    try {
      const [articleRows, sourceRows, categoryRows, commentRows, settingRows, logRows] = await Promise.all([
        persistence.list('newsroom_articles'),
        persistence.list('newsroom_sources'),
        persistence.list('newsroom_categories'),
        persistence.list('newsroom_comments'),
        persistence.list('newsroom_settings'),
        persistence.list('newsroom_logs'),
      ]);

      if (articleRows.length) this.articles = cleanArticlesBoldFormatting(articleRows.map((r: any) => r.payload as Article));
      if (sourceRows.length) this.sources = sourceRows.map((r: any) => r.payload as NewsSource);
      if (categoryRows.length) this.categories = categoryRows.map((r: any) => r.payload as Category);
      if (commentRows.length) this.comments = commentRows.map((r: any) => r.payload as Comment);
      if (settingRows.length) this.settings = settingRows[0].payload as SiteSettings;
      if (logRows.length) this.logs = logRows.map((r: any) => r.payload as AutomationLog);

      if (!articleRows.length) this.articles.forEach((a) => this.persist('newsroom_articles', a.id, a, { published_at: a.publishedAt }));
      if (!sourceRows.length) this.sources.forEach((s) => this.persist('newsroom_sources', s.id, s));
      if (!categoryRows.length) this.categories.forEach((cat) => this.persist('newsroom_categories', cat.id, cat));
      if (!commentRows.length) this.comments.forEach((comment) => this.persist('newsroom_comments', comment.id, comment, { created_at: comment.createdAt }));
      if (!settingRows.length) this.persist('newsroom_settings', 'singleton', this.settings);
      if (!logRows.length) this.logs.forEach((log) => this.persist('newsroom_logs', log.id, log, { created_at: log.startedAt }));

      console.log('[Persistence] Supabase newsroom state hydrated.');
    } catch (err) {
      console.error('[Persistence] Supabase hydration failed; continuing with in-memory data.', err);
    }
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
    this.persist('newsroom_articles', article.id, article, { published_at: article.publishedAt });
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
    this.persist('newsroom_articles', this.articles[idx].id, this.articles[idx], { published_at: this.articles[idx].publishedAt });
    return this.articles[idx];
  }

  public deleteArticle(id: string): boolean {
    const initialLen = this.articles.length;
    this.articles = this.articles.filter((a) => a.id !== id);
    const deleted = this.articles.length < initialLen;
    if (deleted && persistence.enabled) void persistence.remove('newsroom_articles', id).catch((err) => console.error('[Persistence] delete failed:', err));
    return deleted;
  }

  public incrementViews(id: string): number {
    const article = this.articles.find((a) => a.id === id);
    if (article) {
      article.views = (article.views || 0) + 1;
      this.persist('newsroom_articles', article.id, article, { published_at: article.publishedAt });
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
    this.persist('newsroom_comments', newComment.id, newComment, { created_at: newComment.createdAt });
    return newComment;
  }

  public updateCommentStatus(commentId: string, status: Comment['moderationStatus']): Comment {
    const comment = this.comments.find((c) => c.id === commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }
    comment.moderationStatus = status;
    this.persist('newsroom_comments', comment.id, comment, { created_at: comment.createdAt });
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
    this.persist('newsroom_sources', this.sources[idx].id, this.sources[idx]);
    return this.sources[idx];
  }

  public addSource(source: Omit<NewsSource, 'id'>): NewsSource {
    const newSource: NewsSource = {
      ...source,
      id: `src-${Date.now()}`,
    };
    this.sources.push(newSource);
    this.persist('newsroom_sources', newSource.id, newSource);
    return newSource;
  }

  public deleteSource(id: string): boolean {
    const initialLen = this.sources.length;
    this.sources = this.sources.filter((s) => s.id !== id);
    const deleted = this.sources.length < initialLen;
    if (deleted && persistence.enabled) void persistence.remove('newsroom_sources', id).catch((err) => console.error('[Persistence] delete failed:', err));
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
    this.persist('newsroom_categories', this.categories[idx].id, this.categories[idx]);
    return this.categories[idx];
  }

  // Settings
  public getSettings(): SiteSettings {
    return this.settings;
  }

  public updateSettings(updates: Partial<SiteSettings>): SiteSettings {
    this.settings = { ...this.settings, ...updates };
    this.persist('newsroom_settings', 'singleton', this.settings);
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
    this.persist('newsroom_logs', entry.id, entry, { created_at: entry.startedAt });
    return entry;
  }

  public getLogs(): AutomationLog[] {
    return this.logs;
  }
}

export const db = new NewsroomDatabase();

import {
  Article,
  AutomationLog,
  Category,
  Comment,
  NewsSource,
  SiteSettings,
} from '../src/types';
import { ensureTursoSchema, getTursoClient, isTursoConfigured } from './turso';

type ArticleQuery = {
  status?: string;
  category?: string;
  source?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sort?: 'newest' | 'oldest';
};

function requireTurso() {
  if (!isTursoConfigured()) {
    throw new Error('Turso is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.');
  }
}

function parsePayload<T>(value: unknown): T {
  if (value && typeof value === 'object') return value as T;
  try {
    return JSON.parse(String(value || '{}')) as T;
  } catch {
    throw new Error('A Turso row contains invalid JSON payload data.');
  }
}

function safeLimit(value: number | undefined, fallback = 100, max = 5000) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

function safeOffset(value: number | undefined) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

let defaultsPromise: Promise<void> | null = null;

async function ensureDefaults() {
  if (defaultsPromise) return defaultsPromise;

  defaultsPromise = (async () => {
    const db = getTursoClient();

    const [categoryCount, sourceCount, settingsCount] = await Promise.all([
      db.execute('SELECT COUNT(*) AS total FROM newsroom_categories'),
      db.execute('SELECT COUNT(*) AS total FROM newsroom_sources'),
      db.execute("SELECT COUNT(*) AS total FROM newsroom_settings WHERE id = 'default'"),
    ]);

    const needsCategories = Number(categoryCount.rows[0]?.total || 0) === 0;
    const needsSources = Number(sourceCount.rows[0]?.total || 0) === 0;
    const needsSettings = Number(settingsCount.rows[0]?.total || 0) === 0;

    if (!needsCategories && !needsSources && !needsSettings) return;

    const [{ INITIAL_CATEGORIES, INITIAL_SITE_SETTINGS }, { PRODUCTION_NEWS_SOURCES }] =
      await Promise.all([
        import('../src/data/initialData'),
        import('./productionSources'),
      ]);

    const statements: Array<{ sql: string; args: any[] }> = [];

    if (needsCategories) {
      for (const category of INITIAL_CATEGORIES) {
        statements.push({
          sql: 'INSERT INTO newsroom_categories (id, payload) VALUES (?, ?) ON CONFLICT(id) DO NOTHING',
          args: [category.id, JSON.stringify(category)],
        });
      }
    }

    if (needsSources) {
      for (const source of PRODUCTION_NEWS_SOURCES) {
        statements.push({
          sql: 'INSERT INTO newsroom_sources (id, payload) VALUES (?, ?) ON CONFLICT(id) DO NOTHING',
          args: [source.id, JSON.stringify(source)],
        });
      }
    }

    if (needsSettings) {
      statements.push({
        sql: "INSERT INTO newsroom_settings (id, payload) VALUES ('default', ?) ON CONFLICT(id) DO NOTHING",
        args: [JSON.stringify(INITIAL_SITE_SETTINGS)],
      });
    }

    if (statements.length) {
      await db.batch(statements, 'write');
    }
  })().catch((error) => {
    defaultsPromise = null;
    throw error;
  });

  return defaultsPromise;
}

async function ready() {
  requireTurso();
  await ensureTursoSchema();
  await ensureDefaults();
  return getTursoClient();
}

export const tursoRepository = {
  isConfigured: isTursoConfigured,

  async listArticles(query: ArticleQuery = {}): Promise<Article[]> {
    const db = await ready();
    const clauses: string[] = [];
    const args: any[] = [];

    if (query.status) {
      clauses.push('status = ?');
      args.push(query.status);
    }
    if (query.category && query.category !== 'all') {
      clauses.push('category = ?');
      args.push(query.category);
    }
    if (query.source && query.source !== 'all') {
      clauses.push("json_extract(payload, '$.originalSource') = ?");
      args.push(query.source);
    }
    if (query.search?.trim()) {
      clauses.push("(" +
        "lower(coalesce(json_extract(payload, '$.translations.en.title'), '')) LIKE ? OR " +
        "lower(coalesce(json_extract(payload, '$.translations.en.executiveSummary'), '')) LIKE ? OR " +
        "lower(coalesce(json_extract(payload, '$.originalSource'), '')) LIKE ?" +
      ")");
      const pattern = '%' + query.search.trim().toLowerCase() + '%';
      args.push(pattern, pattern, pattern);
    }

    const order = query.sort === 'oldest' ? 'ASC' : 'DESC';
    const limit = safeLimit(query.limit, 100);
    const offset = safeOffset(query.offset);
    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
    const sql =
      'SELECT payload FROM newsroom_articles ' + where +
      ' ORDER BY datetime(coalesce(published_at, updated_at)) ' + order +
      ', id ' + order + ' LIMIT ? OFFSET ?';

    const result = await db.execute({ sql, args: [...args, limit, offset] });
    return result.rows.map((row: any) => parsePayload<Article>(row.payload));
  },

  async getArticle(idOrSlug: string): Promise<Article | null> {
    const db = await ready();
    let result = await db.execute({
      sql: 'SELECT payload FROM newsroom_articles WHERE id = ? LIMIT 1',
      args: [idOrSlug],
    });

    if (!result.rows.length) {
      result = await db.execute({
        sql: "SELECT payload FROM newsroom_articles WHERE json_extract(payload, '$.translations.en.slug') = ? LIMIT 1",
        args: [idOrSlug],
      });
    }

    return result.rows.length ? parsePayload<Article>(result.rows[0].payload) : null;
  },

  async upsertArticle(article: Article): Promise<Article> {
    const db = await ready();
    await db.execute({
      sql: 'INSERT INTO newsroom_articles ' +
        '(id, original_url, category, status, published_at, updated_at, payload) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?) ' +
        'ON CONFLICT(id) DO UPDATE SET ' +
        'original_url = excluded.original_url, category = excluded.category, ' +
        'status = excluded.status, published_at = excluded.published_at, ' +
        'updated_at = excluded.updated_at, payload = excluded.payload',
      args: [
        article.id,
        article.originalUrl || null,
        article.category || null,
        article.status || null,
        article.publishedAt || null,
        article.updatedAt || null,
        JSON.stringify(article),
      ],
    });
    return article;
  },

  async deleteArticle(id: string): Promise<boolean> {
    const db = await ready();
    const result = await db.execute({
      sql: 'DELETE FROM newsroom_articles WHERE id = ?',
      args: [id],
    });
    return Number(result.rowsAffected || 0) > 0;
  },

  async listCategories(): Promise<Category[]> {
    const db = await ready();
    const result = await db.execute('SELECT payload FROM newsroom_categories');
    return result.rows
      .map((row: any) => parsePayload<Category>(row.payload))
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  },

  async getCategory(idOrSlug: string): Promise<Category | null> {
    const categories = await this.listCategories();
    return categories.find((item) => item.id === idOrSlug || item.slug === idOrSlug) || null;
  },

  async upsertCategory(category: Category): Promise<Category> {
    const db = await ready();
    await db.execute({
      sql: 'INSERT INTO newsroom_categories (id, payload) VALUES (?, ?) ' +
        'ON CONFLICT(id) DO UPDATE SET payload = excluded.payload',
      args: [category.id, JSON.stringify(category)],
    });
    return category;
  },

  async listSources(): Promise<NewsSource[]> {
    const db = await ready();
    const result = await db.execute('SELECT payload FROM newsroom_sources ORDER BY id ASC');
    return result.rows.map((row: any) => parsePayload<NewsSource>(row.payload));
  },

  async getSource(id: string): Promise<NewsSource | null> {
    const db = await ready();
    const result = await db.execute({
      sql: 'SELECT payload FROM newsroom_sources WHERE id = ? LIMIT 1',
      args: [id],
    });
    return result.rows.length ? parsePayload<NewsSource>(result.rows[0].payload) : null;
  },

  async upsertSource(source: NewsSource): Promise<NewsSource> {
    const db = await ready();
    await db.execute({
      sql: 'INSERT INTO newsroom_sources (id, payload) VALUES (?, ?) ' +
        'ON CONFLICT(id) DO UPDATE SET payload = excluded.payload',
      args: [source.id, JSON.stringify(source)],
    });
    return source;
  },

  async deleteSource(id: string): Promise<boolean> {
    const db = await ready();
    const result = await db.execute({
      sql: 'DELETE FROM newsroom_sources WHERE id = ?',
      args: [id],
    });
    return Number(result.rowsAffected || 0) > 0;
  },

  async listComments(articleId?: string, status?: string): Promise<Comment[]> {
    const db = await ready();
    const result = await db.execute('SELECT payload FROM newsroom_comments ORDER BY id DESC');
    let items = result.rows.map((row: any) => parsePayload<Comment>(row.payload));
    if (articleId) items = items.filter((item) => item.articleId === articleId);
    if (status) items = items.filter((item) => item.moderationStatus === status);
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async upsertComment(comment: Comment): Promise<Comment> {
    const db = await ready();
    await db.execute({
      sql: 'INSERT INTO newsroom_comments (id, payload) VALUES (?, ?) ' +
        'ON CONFLICT(id) DO UPDATE SET payload = excluded.payload',
      args: [comment.id, JSON.stringify(comment)],
    });
    return comment;
  },

  async listLogs(limit = 100): Promise<AutomationLog[]> {
    const db = await ready();
    const result = await db.execute({
      sql: 'SELECT payload FROM newsroom_logs ORDER BY id DESC LIMIT ?',
      args: [safeLimit(limit, 100, 500)],
    });
    return result.rows
      .map((row: any) => parsePayload<AutomationLog>(row.payload))
      .sort(
        (a, b) =>
          new Date(b.completedAt || b.startedAt).getTime() -
          new Date(a.completedAt || a.startedAt).getTime()
      );
  },

  async upsertLog(log: AutomationLog): Promise<AutomationLog> {
    const db = await ready();
    await db.execute({
      sql: 'INSERT INTO newsroom_logs (id, payload) VALUES (?, ?) ' +
        'ON CONFLICT(id) DO UPDATE SET payload = excluded.payload',
      args: [log.id, JSON.stringify(log)],
    });
    return log;
  },

  async getSettings(): Promise<SiteSettings | null> {
    const db = await ready();
    const result = await db.execute(
      "SELECT payload FROM newsroom_settings WHERE id = 'default' LIMIT 1"
    );
    return result.rows.length ? parsePayload<SiteSettings>(result.rows[0].payload) : null;
  },

  async upsertSettings(settings: SiteSettings): Promise<SiteSettings> {
    const db = await ready();
    await db.execute({
      sql: "INSERT INTO newsroom_settings (id, payload) VALUES ('default', ?) " +
        'ON CONFLICT(id) DO UPDATE SET payload = excluded.payload',
      args: [JSON.stringify(settings)],
    });
    return settings;
  },

  async countArticles(status?: string): Promise<number> {
    const db = await ready();
    const result = status
      ? await db.execute({
          sql: 'SELECT COUNT(*) AS total FROM newsroom_articles WHERE status = ?',
          args: [status],
        })
      : await db.execute('SELECT COUNT(*) AS total FROM newsroom_articles');
    return Number(result.rows[0]?.total || 0);
  },
};

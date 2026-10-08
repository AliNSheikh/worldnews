import {
  Article,
  AutomationLog,
  Category,
  Comment,
  NewsSource,
  SiteSettings,
} from '../src/types';
import { ensureTursoSchema, getTursoClient, isTursoConfigured } from './turso';

export interface PersistenceSnapshot {
  articles: Article[];
  categories: Category[];
  sources: NewsSource[];
  comments: Comment[];
  logs: AutomationLog[];
  settings: SiteSettings | null;
}

type PersistenceProvider = 'turso' | 'memory';

const tableMap = {
  articles: 'newsroom_articles',
  categories: 'newsroom_categories',
  sources: 'newsroom_sources',
  comments: 'newsroom_comments',
  logs: 'newsroom_logs',
  settings: 'newsroom_settings',
} as const;

export function getPersistenceProvider(): PersistenceProvider {
  return isTursoConfigured() ? 'turso' : 'memory';
}

export function isPersistenceConfigured(): boolean {
  return isTursoConfigured();
}

function emptySnapshot(): PersistenceSnapshot {
  return {
    articles: [],
    categories: [],
    sources: [],
    comments: [],
    logs: [],
    settings: null,
  };
}

function parsePayload<T>(payload: unknown): T | null {
  if (payload == null) return null;
  if (typeof payload === 'object') return payload as T;
  try {
    return JSON.parse(String(payload)) as T;
  } catch (error) {
    console.error('[World News DB] Invalid JSON payload in Turso row:', error);
    return null;
  }
}

async function selectPayloads<T>(key: keyof typeof tableMap): Promise<T[]> {
  if (!isTursoConfigured()) return [];
  await ensureTursoSchema();
  const db = getTursoClient();
  const result = await db.execute(`SELECT payload FROM ${tableMap[key]}`);
  return result.rows
    .map((row) => parsePayload<T>(row.payload))
    .filter((row): row is T => Boolean(row));
}

async function upsertPayload(
  key: keyof typeof tableMap,
  record: {
    id: string;
    payload: unknown;
    original_url?: string | null;
    category?: string | null;
    status?: string | null;
    published_at?: string | null;
    updated_at?: string | null;
  }
): Promise<void> {
  if (!isTursoConfigured()) return;
  await ensureTursoSchema();
  const db = getTursoClient();
  const payload = JSON.stringify(record.payload);

  if (key === 'articles') {
    await db.execute({
      sql: `INSERT INTO newsroom_articles
        (id, original_url, category, status, published_at, updated_at, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          original_url = excluded.original_url,
          category = excluded.category,
          status = excluded.status,
          published_at = excluded.published_at,
          updated_at = excluded.updated_at,
          payload = excluded.payload`,
      args: [
        record.id,
        record.original_url || null,
        record.category || null,
        record.status || null,
        record.published_at || null,
        record.updated_at || null,
        payload,
      ],
    });
    return;
  }

  await db.execute({
    sql: `INSERT INTO ${tableMap[key]} (id, payload)
      VALUES (?, ?)
      ON CONFLICT(id) DO UPDATE SET payload = excluded.payload`,
    args: [record.id, payload],
  });
}

async function deleteById(key: keyof typeof tableMap, id: string): Promise<void> {
  if (!isTursoConfigured()) return;
  await ensureTursoSchema();
  const db = getTursoClient();
  await db.execute({
    sql: `DELETE FROM ${tableMap[key]} WHERE id = ?`,
    args: [id],
  });
}

async function loadSettings(): Promise<SiteSettings | null> {
  const settings = await selectPayloads<SiteSettings>('settings');
  return settings[0] || null;
}

export const persistence = {
  async loadSnapshot(): Promise<PersistenceSnapshot> {
    if (!isPersistenceConfigured()) return emptySnapshot();
    await ensureTursoSchema();

    const [articles, categories, sources, comments, logs, settings] = await Promise.all([
      selectPayloads<Article>('articles'),
      selectPayloads<Category>('categories'),
      selectPayloads<NewsSource>('sources'),
      selectPayloads<Comment>('comments'),
      selectPayloads<AutomationLog>('logs'),
      loadSettings(),
    ]);

    return { articles, categories, sources, comments, logs, settings };
  },

  upsertArticle(article: Article) {
    return upsertPayload('articles', {
      id: article.id,
      original_url: article.originalUrl || null,
      category: article.category,
      status: article.status,
      published_at: article.publishedAt || null,
      updated_at: article.updatedAt || null,
      payload: article,
    });
  },

  deleteArticle(id: string) {
    return deleteById('articles', id);
  },

  upsertCategory(category: Category) {
    return upsertPayload('categories', { id: category.id, payload: category });
  },

  upsertSource(source: NewsSource) {
    return upsertPayload('sources', { id: source.id, payload: source });
  },

  deleteSource(id: string) {
    return deleteById('sources', id);
  },

  upsertComment(comment: Comment) {
    return upsertPayload('comments', { id: comment.id, payload: comment });
  },

  upsertLog(log: AutomationLog) {
    return upsertPayload('logs', { id: log.id, payload: log });
  },

  upsertSettings(settings: SiteSettings) {
    return upsertPayload('settings', { id: 'default', payload: settings });
  },
};

import {
  Article,
  AutomationLog,
  Category,
  Comment,
  NewsSource,
  SiteSettings,
} from '../src/types';

type RowWithPayload<T> = {
  id: string;
  payload: T;
};

export interface PersistenceSnapshot {
  articles: Article[];
  categories: Category[];
  sources: NewsSource[];
  comments: Comment[];
  logs: AutomationLog[];
  settings: SiteSettings | null;
}

const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export function isPersistenceConfigured(): boolean {
  return Boolean(supabaseUrl && serviceRoleKey);
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  if (!isPersistenceConfigured()) {
    throw new Error('Supabase persistence is not configured.');
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...headers(),
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Supabase REST request failed (${response.status} ${response.statusText}): ${body.slice(0, 600)}`
    );
  }

  return response;
}

async function selectPayloads<T>(table: string): Promise<T[]> {
  if (!isPersistenceConfigured()) return [];
  const response = await request(`${table}?select=id,payload`);
  const rows = (await response.json()) as RowWithPayload<T>[];
  return rows.map((row) => row.payload).filter(Boolean);
}

async function upsertPayload(
  table: string,
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
  if (!isPersistenceConfigured()) return;

  await request(`${table}?on_conflict=id`, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(record),
  });
}

async function deleteById(table: string, id: string): Promise<void> {
  if (!isPersistenceConfigured()) return;
  await request(`${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=minimal',
    },
  });
}

async function loadSettings(): Promise<SiteSettings | null> {
  if (!isPersistenceConfigured()) return null;
  const response = await request('newsroom_settings?id=eq.default&select=payload&limit=1');
  const rows = (await response.json()) as Array<{ payload: SiteSettings }>;
  return rows[0]?.payload || null;
}

export const persistence = {
  async loadSnapshot(): Promise<PersistenceSnapshot> {
    if (!isPersistenceConfigured()) {
      return {
        articles: [],
        categories: [],
        sources: [],
        comments: [],
        logs: [],
        settings: null,
      };
    }

    const [articles, categories, sources, comments, logs, settings] = await Promise.all([
      selectPayloads<Article>('newsroom_articles'),
      selectPayloads<Category>('newsroom_categories'),
      selectPayloads<NewsSource>('newsroom_sources'),
      selectPayloads<Comment>('newsroom_comments'),
      selectPayloads<AutomationLog>('newsroom_logs'),
      loadSettings(),
    ]);

    return { articles, categories, sources, comments, logs, settings };
  },

  upsertArticle(article: Article) {
    return upsertPayload('newsroom_articles', {
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
    return deleteById('newsroom_articles', id);
  },

  upsertCategory(category: Category) {
    return upsertPayload('newsroom_categories', {
      id: category.id,
      payload: category,
    });
  },

  upsertSource(source: NewsSource) {
    return upsertPayload('newsroom_sources', {
      id: source.id,
      payload: source,
    });
  },

  deleteSource(id: string) {
    return deleteById('newsroom_sources', id);
  },

  upsertComment(comment: Comment) {
    return upsertPayload('newsroom_comments', {
      id: comment.id,
      payload: comment,
    });
  },

  upsertLog(log: AutomationLog) {
    return upsertPayload('newsroom_logs', {
      id: log.id,
      payload: log,
    });
  },

  async upsertSettings(settings: SiteSettings) {
    return upsertPayload('newsroom_settings', {
      id: 'default',
      payload: settings,
    });
  },
};

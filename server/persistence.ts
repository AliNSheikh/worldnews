import { Query } from 'node-appwrite';
import {
  Article,
  AutomationLog,
  Category,
  Comment,
  NewsSource,
  SiteSettings,
} from '../src/types';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLES,
  getAppwriteTablesDb,
  isAppwriteConfigured,
  toAppwriteRowId,
} from './appwrite';

export interface PersistenceSnapshot {
  articles: Article[];
  categories: Category[];
  sources: NewsSource[];
  comments: Comment[];
  logs: AutomationLog[];
  settings: SiteSettings | null;
}

type PersistenceProvider = 'appwrite' | 'supabase' | 'memory';

type SupabaseRowWithPayload<T> = {
  id: string;
  payload: T;
};

type AppwritePayloadRow = {
  payload: string;
};

const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && serviceRoleKey);
}

export function getPersistenceProvider(): PersistenceProvider {
  if (isAppwriteConfigured()) return 'appwrite';
  if (isSupabaseConfigured()) return 'supabase';
  return 'memory';
}

export function isPersistenceConfigured(): boolean {
  return getPersistenceProvider() !== 'memory';
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
  if (!payload) return null;
  if (typeof payload === 'object') return payload as T;

  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload) as T;
    } catch (error) {
      console.error('[World News DB] Invalid JSON payload in Appwrite row:', error);
    }
  }

  return null;
}

async function listAppwritePayloads<T>(tableId: string): Promise<T[]> {
  const tablesDb = getAppwriteTablesDb();
  const pageSize = 1000;
  const output: T[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const page = await tablesDb.listRows<AppwritePayloadRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId,
      queries: [Query.limit(pageSize), Query.offset(offset)],
      total: false,
      ttl: 0,
    });

    for (const row of page.rows) {
      const parsed = parsePayload<T>(row.payload);
      if (parsed) output.push(parsed);
    }

    if (page.rows.length < pageSize) break;
  }

  return output;
}

async function upsertAppwritePayload(tableId: string, id: string, payload: unknown): Promise<void> {
  const tablesDb = getAppwriteTablesDb();
  await tablesDb.upsertRow({
    databaseId: APPWRITE_DATABASE_ID,
    tableId,
    rowId: toAppwriteRowId(id),
    data: {
      payload: JSON.stringify(payload),
    },
  });
}

async function deleteAppwriteRow(tableId: string, id: string): Promise<void> {
  const tablesDb = getAppwriteTablesDb();
  await tablesDb.deleteRow({
    databaseId: APPWRITE_DATABASE_ID,
    tableId,
    rowId: toAppwriteRowId(id),
  });
}

function supabaseHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function supabaseRequest(path: string, init: RequestInit = {}): Promise<Response> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase fallback persistence is not configured.');
  }

  const requestHeaders = new Headers(supabaseHeaders());
  const extraHeaders = new Headers(init.headers || {});
  extraHeaders.forEach((value, key) => requestHeaders.set(key, value));

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: requestHeaders,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Supabase REST request failed (${response.status} ${response.statusText}): ${body.slice(0, 600)}`
    );
  }

  return response;
}

async function selectSupabasePayloads<T>(table: string): Promise<T[]> {
  const response = await supabaseRequest(`${table}?select=id,payload`);
  const rows = (await response.json()) as SupabaseRowWithPayload<T>[];
  return rows.map((row) => row.payload).filter(Boolean);
}

async function upsertSupabasePayload(
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
  await supabaseRequest(`${table}?on_conflict=id`, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(record),
  });
}

async function deleteSupabaseById(table: string, id: string): Promise<void> {
  await supabaseRequest(`${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=minimal',
    },
  });
}

const tableMap = {
  articles: { appwrite: APPWRITE_TABLES.articles, supabase: 'newsroom_articles' },
  categories: { appwrite: APPWRITE_TABLES.categories, supabase: 'newsroom_categories' },
  sources: { appwrite: APPWRITE_TABLES.sources, supabase: 'newsroom_sources' },
  comments: { appwrite: APPWRITE_TABLES.comments, supabase: 'newsroom_comments' },
  logs: { appwrite: APPWRITE_TABLES.logs, supabase: 'newsroom_logs' },
  settings: { appwrite: APPWRITE_TABLES.settings, supabase: 'newsroom_settings' },
} as const;

async function selectPayloads<T>(key: keyof typeof tableMap): Promise<T[]> {
  const provider = getPersistenceProvider();
  if (provider === 'appwrite') {
    return listAppwritePayloads<T>(tableMap[key].appwrite);
  }
  if (provider === 'supabase') {
    return selectSupabasePayloads<T>(tableMap[key].supabase);
  }
  return [];
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
  const provider = getPersistenceProvider();
  if (provider === 'appwrite') {
    await upsertAppwritePayload(tableMap[key].appwrite, record.id, record.payload);
    return;
  }
  if (provider === 'supabase') {
    await upsertSupabasePayload(tableMap[key].supabase, record);
  }
}

async function deleteById(key: keyof typeof tableMap, id: string): Promise<void> {
  const provider = getPersistenceProvider();
  if (provider === 'appwrite') {
    await deleteAppwriteRow(tableMap[key].appwrite, id);
    return;
  }
  if (provider === 'supabase') {
    await deleteSupabaseById(tableMap[key].supabase, id);
  }
}

async function loadSettings(): Promise<SiteSettings | null> {
  const settings = await selectPayloads<SiteSettings>('settings');
  return settings[0] || null;
}

export const persistence = {
  async loadSnapshot(): Promise<PersistenceSnapshot> {
    if (!isPersistenceConfigured()) return emptySnapshot();

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

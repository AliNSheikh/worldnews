import 'dotenv/config';
import { Query } from 'node-appwrite';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLES,
  getAppwriteTablesDb,
  isAppwriteConfigured,
} from '../server/appwrite';
import { ensureTursoSchema, isTursoConfigured } from '../server/turso';
import { persistence } from '../server/persistence';
import type {
  Article,
  AutomationLog,
  Category,
  Comment,
  NewsSource,
  SiteSettings,
} from '../src/types';

type AppwritePayloadRow = {
  payload?: unknown;
  data?: { payload?: unknown } | null;
};

function rowPayload<T>(row: unknown): T | null {
  const candidate = row as AppwritePayloadRow;
  const raw = candidate?.payload ?? candidate?.data?.payload;
  if (!raw) return null;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return null;
  }
}

async function listPayloads<T>(tableId: string): Promise<T[]> {
  const db = getAppwriteTablesDb();
  const rows: T[] = [];
  const pageSize = 500;

  for (let offset = 0; ; offset += pageSize) {
    const page = await db.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId,
      queries: [Query.limit(pageSize), Query.offset(offset)],
      total: false,
      ttl: 0,
    });

    for (const row of page.rows) {
      const payload = rowPayload<T>(row);
      if (payload) rows.push(payload);
    }

    if (page.rows.length < pageSize) break;
  }

  return rows;
}

async function main() {
  if (!isAppwriteConfigured()) {
    throw new Error('Appwrite credentials are required for migration.');
  }
  if (!isTursoConfigured()) {
    throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required for migration.');
  }

  await ensureTursoSchema();

  const [articles, categories, sources, comments, logs, settingsRows] = await Promise.all([
    listPayloads<Article>(APPWRITE_TABLES.articles),
    listPayloads<Category>(APPWRITE_TABLES.categories),
    listPayloads<NewsSource>(APPWRITE_TABLES.sources),
    listPayloads<Comment>(APPWRITE_TABLES.comments),
    listPayloads<AutomationLog>(APPWRITE_TABLES.logs),
    listPayloads<SiteSettings>(APPWRITE_TABLES.settings),
  ]);

  for (const item of articles) await persistence.upsertArticle(item);
  for (const item of categories) await persistence.upsertCategory(item);
  for (const item of sources) await persistence.upsertSource(item);
  for (const item of comments) await persistence.upsertComment(item);
  for (const item of logs) await persistence.upsertLog(item);
  if (settingsRows[0]) await persistence.upsertSettings(settingsRows[0]);

  console.log('Appwrite → Turso migration complete.');
  console.log({
    articles: articles.length,
    categories: categories.length,
    sources: sources.length,
    comments: comments.length,
    logs: logs.length,
    settings: settingsRows.length ? 1 : 0,
  });
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});

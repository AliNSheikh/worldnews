import { createClient, type Client } from '@libsql/client';

function cleanEnv(value: string | undefined): string {
  return String(value || '').trim().replace(/^['"]+|['"]+$/g, '');
}

export const TURSO_DATABASE_URL = cleanEnv(process.env.TURSO_DATABASE_URL);
export const TURSO_AUTH_TOKEN = cleanEnv(
  process.env.TURSO_AUTH_TOKEN || process.env.TURSO_DATABASE_AUTH_TOKEN
);

let client: Client | null = null;
let schemaPromise: Promise<void> | null = null;

export function isTursoConfigured(): boolean {
  return Boolean(TURSO_DATABASE_URL && TURSO_AUTH_TOKEN);
}

export function getTursoClient(): Client {
  if (!isTursoConfigured()) {
    throw new Error(
      'Turso is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the server environment.'
    );
  }

  if (!client) {
    client = createClient({
      url: TURSO_DATABASE_URL,
      authToken: TURSO_AUTH_TOKEN,
    });
  }

  return client;
}

export async function ensureTursoSchema(): Promise<void> {
  if (!isTursoConfigured()) {
    throw new Error('Turso is not configured.');
  }
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    const db = getTursoClient();
    await db.batch(
      [
        `CREATE TABLE IF NOT EXISTS newsroom_articles (
          id TEXT PRIMARY KEY,
          original_url TEXT,
          category TEXT,
          status TEXT,
          published_at TEXT,
          updated_at TEXT,
          payload TEXT NOT NULL
        )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_newsroom_articles_original_url
          ON newsroom_articles(original_url)
          WHERE original_url IS NOT NULL AND original_url <> ''`,
        `CREATE INDEX IF NOT EXISTS idx_newsroom_articles_category
          ON newsroom_articles(category)`,
        `CREATE INDEX IF NOT EXISTS idx_newsroom_articles_status
          ON newsroom_articles(status)`,
        `CREATE INDEX IF NOT EXISTS idx_newsroom_articles_published_at
          ON newsroom_articles(published_at DESC)`,
        `CREATE TABLE IF NOT EXISTS newsroom_categories (
          id TEXT PRIMARY KEY,
          payload TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS newsroom_sources (
          id TEXT PRIMARY KEY,
          payload TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS newsroom_comments (
          id TEXT PRIMARY KEY,
          payload TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS newsroom_logs (
          id TEXT PRIMARY KEY,
          payload TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS newsroom_settings (
          id TEXT PRIMARY KEY,
          payload TEXT NOT NULL
        )`,
      ],
      'write'
    );
  })().catch((error) => {
    schemaPromise = null;
    throw error;
  });

  return schemaPromise;
}

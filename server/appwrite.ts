import crypto from 'crypto';
import { Client, TablesDB } from 'node-appwrite';

// Non-secret defaults for the connected World News Appwrite project.
// APPWRITE_API_KEY intentionally remains environment-only.
export const APPWRITE_ENDPOINT = (
  process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1'
).replace(/\/$/, '');
export const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || '6ac4bf0d00093b81fef7';
export const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || '';
export const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'worldnews';

export const APPWRITE_TABLES = {
  articles: process.env.APPWRITE_ARTICLES_TABLE_ID || 'newsroom_articles',
  categories: process.env.APPWRITE_CATEGORIES_TABLE_ID || 'newsroom_categories',
  sources: process.env.APPWRITE_SOURCES_TABLE_ID || 'newsroom_sources',
  comments: process.env.APPWRITE_COMMENTS_TABLE_ID || 'newsroom_comments',
  logs: process.env.APPWRITE_LOGS_TABLE_ID || 'newsroom_logs',
  settings: process.env.APPWRITE_SETTINGS_TABLE_ID || 'newsroom_settings',
} as const;

let cachedTablesDb: TablesDB | null = null;

export function isAppwriteConfigured(): boolean {
  return Boolean(APPWRITE_ENDPOINT && APPWRITE_PROJECT_ID && APPWRITE_API_KEY && APPWRITE_DATABASE_ID);
}

export function getAppwriteTablesDb(): TablesDB {
  if (!isAppwriteConfigured()) {
    throw new Error(
      'Appwrite is not configured. Set APPWRITE_API_KEY. APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, and APPWRITE_DATABASE_ID have project defaults but can still be overridden.'
    );
  }

  if (!cachedTablesDb) {
    const client = new Client()
      .setEndpoint(APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT_ID)
      .setKey(APPWRITE_API_KEY);

    cachedTablesDb = new TablesDB(client);
  }

  return cachedTablesDb;
}

/**
 * Appwrite row IDs are limited to 36 characters. Preserve already-valid IDs
 * for readability and deterministically hash longer/unsupported IDs.
 */
export function toAppwriteRowId(id: string): string {
  if (/^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/.test(id)) {
    return id;
  }

  return `r_${crypto.createHash('sha256').update(id).digest('hex').slice(0, 34)}`;
}

import crypto from 'crypto';
import { Client, TablesDB } from 'node-appwrite';

const DEFAULT_APPWRITE_ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
const DEFAULT_APPWRITE_PROJECT_ID = '6ac4bf0d00093b81fef7';
const DEFAULT_APPWRITE_DATABASE_ID = 'worldnews';

function cleanEnvValue(value: string | undefined, fallback = ''): string {
  return (value || fallback)
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/\\+$/g, '')
    .trim();
}

function normalizeEndpoint(value: string | undefined): string {
  const raw = cleanEnvValue(value, DEFAULT_APPWRITE_ENDPOINT);

  // Recover from accidentally pasting Markdown such as
  // [https://fra.cloud.appwrite.io/v1](https://fra.cloud.appwrite.io/v1).
  const markdownUrl = raw.match(/\[(https?:\/\/[^\]]+)\]/)?.[1];
  const plainUrl = raw.match(/https?:\/\/[^\s)'"\\]+/)?.[0];
  const candidate = markdownUrl || plainUrl || DEFAULT_APPWRITE_ENDPOINT;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Unsupported protocol');
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    console.warn(
      `[World News DB] Invalid APPWRITE_ENDPOINT value; using ${DEFAULT_APPWRITE_ENDPOINT}.`
    );
    return DEFAULT_APPWRITE_ENDPOINT;
  }
}

// Non-secret defaults for the connected World News Appwrite project.
// APPWRITE_API_KEY intentionally remains environment-only.
export const APPWRITE_ENDPOINT = normalizeEndpoint(process.env.APPWRITE_ENDPOINT);
export const APPWRITE_PROJECT_ID = cleanEnvValue(
  process.env.APPWRITE_PROJECT_ID,
  DEFAULT_APPWRITE_PROJECT_ID
);
export const APPWRITE_API_KEY = cleanEnvValue(process.env.APPWRITE_API_KEY);
export const APPWRITE_DATABASE_ID = cleanEnvValue(
  process.env.APPWRITE_DATABASE_ID,
  DEFAULT_APPWRITE_DATABASE_ID
);

export const APPWRITE_TABLES = {
  articles: cleanEnvValue(process.env.APPWRITE_ARTICLES_TABLE_ID, 'newsroom_articles'),
  categories: cleanEnvValue(process.env.APPWRITE_CATEGORIES_TABLE_ID, 'newsroom_categories'),
  sources: cleanEnvValue(process.env.APPWRITE_SOURCES_TABLE_ID, 'newsroom_sources'),
  comments: cleanEnvValue(process.env.APPWRITE_COMMENTS_TABLE_ID, 'newsroom_comments'),
  logs: cleanEnvValue(process.env.APPWRITE_LOGS_TABLE_ID, 'newsroom_logs'),
  settings: cleanEnvValue(process.env.APPWRITE_SETTINGS_TABLE_ID, 'newsroom_settings'),
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

import { createClient } from '@libsql/client';

export const maxDuration = 15;

function clean(value: string | undefined): string {
  return String(value || '').trim().replace(/^['"]+|['"]+$/g, '');
}

function json(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(_req: any, res: any) {
  const url = clean(process.env.TURSO_DATABASE_URL);
  const authToken = clean(process.env.TURSO_AUTH_TOKEN || process.env.TURSO_DATABASE_AUTH_TOKEN);

  if (!url || !authToken) {
    return json(res, 503, {
      status: 'degraded',
      persistenceProvider: 'turso',
      tursoDatabaseUrlConfigured: Boolean(url),
      tursoAuthTokenConfigured: Boolean(authToken),
      error: 'Turso environment variables are missing.',
    });
  }

  try {
    const db = createClient({ url, authToken });
    const result = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'newsroom_%' ORDER BY name"
    );
    const tables = result.rows.map((row: any) => String(row.name || '')).filter(Boolean);

    return json(res, 200, {
      status: 'healthy',
      persistenceProvider: 'turso',
      tursoDatabaseUrlConfigured: true,
      tursoAuthTokenConfigured: true,
      databaseReachable: true,
      tables,
      expectedTablesPresent: [
        'newsroom_articles',
        'newsroom_categories',
        'newsroom_comments',
        'newsroom_logs',
        'newsroom_settings',
        'newsroom_sources',
      ].every((name) => tables.includes(name)),
    });
  } catch (error: any) {
    console.error('[direct-health]', error);
    return json(res, 503, {
      status: 'degraded',
      persistenceProvider: 'turso',
      tursoDatabaseUrlConfigured: true,
      tursoAuthTokenConfigured: true,
      databaseReachable: false,
      error: error?.message || String(error),
    });
  }
}

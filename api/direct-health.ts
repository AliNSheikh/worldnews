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
    const expectedTables = [
      'newsroom_articles',
      'newsroom_categories',
      'newsroom_comments',
      'newsroom_logs',
      'newsroom_settings',
      'newsroom_sources',
    ];
    const expectedTablesPresent = expectedTables.every((name) => tables.includes(name));

    let databaseWritable = false;
    let writeError: string | null = null;

    if (expectedTablesPresent) {
      const probeId = `health-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      try {
        await db.execute({
          sql: 'INSERT INTO newsroom_logs (id, payload) VALUES (?, ?)',
          args: [probeId, JSON.stringify({ type: 'health_probe', createdAt: new Date().toISOString() })],
        });
        const readBack = await db.execute({
          sql: 'SELECT id FROM newsroom_logs WHERE id = ? LIMIT 1',
          args: [probeId],
        });
        databaseWritable = readBack.rows.length === 1;
        await db.execute({
          sql: 'DELETE FROM newsroom_logs WHERE id = ?',
          args: [probeId],
        });
      } catch (error: any) {
        writeError = error?.message || String(error);
      }
    }

    return json(res, databaseWritable ? 200 : 503, {
      status: databaseWritable ? 'healthy' : 'degraded',
      persistenceProvider: 'turso',
      tursoDatabaseUrlConfigured: true,
      tursoAuthTokenConfigured: true,
      databaseReachable: true,
      databaseWritable,
      writeError,
      tables,
      expectedTablesPresent,
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

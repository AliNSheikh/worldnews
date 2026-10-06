import 'dotenv/config';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLES,
  getAppwriteTablesDb,
  isAppwriteConfigured,
  toAppwriteRowId,
} from '../server/appwrite';

const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const tableMap = [
  ['newsroom_articles', APPWRITE_TABLES.articles],
  ['newsroom_categories', APPWRITE_TABLES.categories],
  ['newsroom_sources', APPWRITE_TABLES.sources],
  ['newsroom_comments', APPWRITE_TABLES.comments],
  ['newsroom_logs', APPWRITE_TABLES.logs],
  ['newsroom_settings', APPWRITE_TABLES.settings],
] as const;

type LegacyRow = {
  id: string;
  payload: unknown;
};

async function fetchSupabaseRows(table: string): Promise<LegacyRow[]> {
  const pageSize = 1000;
  const rows: LegacyRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/${table}?select=id,payload&limit=${pageSize}&offset=${offset}`,
      {
        headers: {
          apikey: supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Failed reading ${table} from Supabase (${response.status}): ${body.slice(0, 500)}`);
    }

    const page = (await response.json()) as LegacyRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

async function main() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to migrate existing data.');
  }
  if (!isAppwriteConfigured()) {
    throw new Error('Set the APPWRITE_* environment variables before migrating.');
  }

  const tablesDb = getAppwriteTablesDb();
  let migrated = 0;

  for (const [supabaseTable, appwriteTable] of tableMap) {
    const rows = await fetchSupabaseRows(supabaseTable);
    console.log(`Migrating ${rows.length} rows from ${supabaseTable} -> ${appwriteTable}...`);

    for (const row of rows) {
      await tablesDb.upsertRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: appwriteTable,
        rowId: toAppwriteRowId(row.id),
        data: {
          payload: JSON.stringify(row.payload),
        },
      });
      migrated++;
    }
  }

  console.log(`Migration complete. ${migrated} rows copied to Appwrite.`);
  console.log('After verifying the Appwrite data, remove the SUPABASE_* variables from Vercel to use Appwrite exclusively.');
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});

import 'dotenv/config';
import { AppwriteException } from 'node-appwrite';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLES,
  getAppwriteTablesDb,
  isAppwriteConfigured,
} from '../server/appwrite';

const tables = [
  [APPWRITE_TABLES.articles, 'Newsroom Articles'],
  [APPWRITE_TABLES.categories, 'Newsroom Categories'],
  [APPWRITE_TABLES.sources, 'Newsroom Sources'],
  [APPWRITE_TABLES.comments, 'Newsroom Comments'],
  [APPWRITE_TABLES.logs, 'Newsroom Automation Logs'],
  [APPWRITE_TABLES.settings, 'Newsroom Settings'],
] as const;

function isConflict(error: unknown): boolean {
  return error instanceof AppwriteException && error.code === 409;
}

async function createIfMissing(label: string, operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
    console.log(`Created ${label}.`);
  } catch (error) {
    if (isConflict(error)) {
      console.log(`${label} already exists.`);
      return;
    }
    throw error;
  }
}

async function main() {
  if (!isAppwriteConfigured()) {
    throw new Error(
      'Missing Appwrite configuration. Set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, and APPWRITE_DATABASE_ID first.'
    );
  }

  const tablesDb = getAppwriteTablesDb();

  await createIfMissing(`database ${APPWRITE_DATABASE_ID}`, () =>
    tablesDb.create({
      databaseId: APPWRITE_DATABASE_ID,
      name: 'World News',
    })
  );

  for (const [tableId, tableName] of tables) {
    await createIfMissing(`table ${tableId}`, () =>
      tablesDb.createTable({
        databaseId: APPWRITE_DATABASE_ID,
        tableId,
        name: tableName,
        rowSecurity: false,
        enabled: true,
      })
    );

    await createIfMissing(`payload column on ${tableId}`, () =>
      tablesDb.createLongtextColumn({
        databaseId: APPWRITE_DATABASE_ID,
        tableId,
        key: 'payload',
        required: true,
        array: false,
        encrypt: false,
      })
    );
  }

  console.log('\nAppwrite TablesDB setup is complete.');
  console.log('You can now use a runtime API key with only rows.read and rows.write scopes.');
}

main().catch((error) => {
  console.error('Appwrite setup failed:', error);
  process.exitCode = 1;
});

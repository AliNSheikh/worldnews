import 'dotenv/config';
import { ensureTursoSchema, isTursoConfigured, TURSO_DATABASE_URL } from '../server/turso';

async function main() {
  if (!isTursoConfigured()) {
    throw new Error(
      'Missing Turso configuration. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before running this command.'
    );
  }

  await ensureTursoSchema();
  console.log('Turso newsroom schema is ready.');
  console.log(`Database: ${TURSO_DATABASE_URL}`);
  console.log('Tables: newsroom_articles, newsroom_categories, newsroom_sources, newsroom_comments, newsroom_logs, newsroom_settings');
}

main().catch((error) => {
  console.error('Turso setup failed:', error);
  process.exitCode = 1;
});

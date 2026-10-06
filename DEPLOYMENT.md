# World News — Vercel + Appwrite Production Setup

World News runs as a Vite/React frontend with an Express API on Vercel. Appwrite TablesDB is the primary persistent database. All Appwrite access is server-side; the API key must never use a `VITE_` prefix or be exposed to the browser.

## Connected Appwrite project

This repository is already bound to the following non-secret Appwrite defaults:

- Endpoint: `https://fra.cloud.appwrite.io/v1`
- Project ID: `6ac4bf0d00093b81fef7`
- Database ID: `worldnews`

The Appwrite database and all six required private tables have already been provisioned:

- `newsroom_articles`
- `newsroom_categories`
- `newsroom_sources`
- `newsroom_comments`
- `newsroom_logs`
- `newsroom_settings`

Each table contains a required `payload` Longtext column. The application serializes the existing newsroom model as JSON into this column, so the CMS/API model does not change.

## 1. Configure the Appwrite API key

The API key is intentionally not stored in GitHub. Add it only to secure server-side environments.

For local development, copy `.env.example` to `.env` and set:

```env
APPWRITE_API_KEY="YOUR_SERVER_ONLY_APPWRITE_API_KEY"
```

The endpoint, project ID, and database ID already have defaults in `server/appwrite.ts`, but they may still be overridden with environment variables if required.

For runtime access, the key only needs row read/write permissions. A broader setup key can be used temporarily for schema administration, but should be rotated or replaced after setup.

## 2. Configure Vercel

In **Vercel → worldnews → Settings → Environment Variables**, add at minimum:

- `APPWRITE_API_KEY`
- `GEMINI_API_KEY`
- `APP_URL=https://your-production-domain.example`
- `CRON_SECRET`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`

The following Appwrite variables are optional because the correct values are built into the code:

```env
APPWRITE_ENDPOINT="https://fra.cloud.appwrite.io/v1"
APPWRITE_PROJECT_ID="6ac4bf0d00093b81fef7"
APPWRITE_DATABASE_ID="worldnews"
```

After saving environment variables, redeploy the latest `main` branch.

## 3. Optional: migrate existing Supabase data

If production still contains data in Supabase, keep these variables temporarily in a local `.env`:

```env
SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
APPWRITE_API_KEY="YOUR_SERVER_ONLY_APPWRITE_API_KEY"
```

Then run:

```bash
npm install
npm run appwrite:migrate:supabase
```

The command copies articles, categories, sources, comments, automation logs, and site settings into Appwrite using deterministic row IDs. Verify the data in the Appwrite Console before removing the Supabase environment variables.

The application prefers Appwrite whenever `APPWRITE_API_KEY` is available. Supabase remains only as a temporary fallback during migration.

## 4. Validate the integration

Check these production endpoints after redeployment:

- `/api/health`
- `/robots.txt`
- `/sitemap.xml`
- `/news-sitemap.xml`
- `/rss.xml?lang=en`

Then sign into the CMS and:

1. Add or edit an RSS source.
2. Test the source.
3. Run a manual import.
4. Confirm rows appear in `newsroom_articles` in Appwrite.
5. Edit site settings and confirm `newsroom_settings` is updated.
6. Restart/redeploy the app and confirm the same data is still present.

## 5. Cron schedule

The bundled Vercel Hobby-compatible cron remains:

```text
0 2 * * *
```

For true hourly ingestion, use Vercel Pro with `0 * * * *` or call `/api/cron/hourly` from an external hourly scheduler using `Authorization: Bearer <CRON_SECRET>`.

## 6. Google Search setup

1. Verify the production domain in Google Search Console.
2. Submit `/sitemap.xml`.
3. Submit `/news-sitemap.xml`.
4. Keep canonical and hreflang URLs on the production domain.

Google controls crawl and indexing timing; the application can publish fresh sitemap data but cannot guarantee hourly indexing.

## 7. Security notes

- Never commit or expose `APPWRITE_API_KEY`.
- Do not prefix server secrets with `VITE_`.
- Keep Appwrite tables private because all persistence flows through the Express API.
- Rotate any API key that has been shared in chat or another non-secret channel.
- Prefer a runtime key with only row read/write permissions once setup is complete.
- Keep source provenance internal for editorial verification and rights review.

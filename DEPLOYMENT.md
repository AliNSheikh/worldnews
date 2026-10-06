# World News — Vercel + Appwrite Production Setup

World News runs as a Vite/React frontend with an Express API on Vercel. Appwrite TablesDB is the primary persistent database. All Appwrite access is server-side; the API key must never use a `VITE_` prefix or be exposed to the browser.

## 1. Create the Appwrite project

1. Create a project at Appwrite Cloud.
2. Copy the project ID.
3. Copy the API endpoint for your region, including `/v1`, for example `https://<REGION>.cloud.appwrite.io/v1`.
4. Under **Integrate with your server**, create a temporary setup API key with these scopes:
   - `databases.write`
   - `tables.write`
   - `columns.write`
   - `rows.read`
   - `rows.write`
5. Keep the API key server-only.

## 2. Configure local environment variables

Copy `.env.example` to `.env` and set at least:

```env
APPWRITE_ENDPOINT="https://<REGION>.cloud.appwrite.io/v1"
APPWRITE_PROJECT_ID="YOUR_PROJECT_ID"
APPWRITE_API_KEY="YOUR_SETUP_API_KEY"
APPWRITE_DATABASE_ID="worldnews"
```

The six table IDs already have defaults and normally do not need to be changed.

## 3. Create the Appwrite database automatically

Install dependencies and run:

```bash
npm install
npm run appwrite:setup
```

The setup command creates:

- database: `worldnews`
- `newsroom_articles`
- `newsroom_categories`
- `newsroom_sources`
- `newsroom_comments`
- `newsroom_logs`
- `newsroom_settings`

Each table contains a required `payload` Longtext column. The application serializes the existing newsroom model as JSON into this column, so the CMS/API model does not change.

The tables intentionally have no public permissions. Server SDK calls authenticated with the Appwrite API key can read and write them.

After setup, you may create a second runtime API key with only:

- `rows.read`
- `rows.write`

Replace `APPWRITE_API_KEY` with that runtime key in Vercel.

## 4. Optional: migrate existing Supabase data

If production already contains data in Supabase, keep these variables temporarily:

```env
SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
```

Then run:

```bash
npm run appwrite:migrate:supabase
```

The command copies articles, categories, sources, comments, automation logs, and site settings into Appwrite using deterministic row IDs. Verify the data in the Appwrite Console before removing the Supabase environment variables.

The application prefers Appwrite whenever all required `APPWRITE_*` variables are present. Supabase remains only as a temporary fallback during migration.

## 5. Configure Vercel

Add these variables to **Production** and, if needed, **Preview**:

- `GEMINI_API_KEY`
- `APP_URL=https://your-production-domain.example`
- `APPWRITE_ENDPOINT`
- `APPWRITE_PROJECT_ID`
- `APPWRITE_API_KEY`
- `APPWRITE_DATABASE_ID=worldnews`
- `CRON_SECRET`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`

The table-ID variables are optional because the code uses the defaults shown in `.env.example`.

Redeploy after saving the variables.

The bundled Vercel Hobby-compatible cron remains:

```text
0 2 * * *
```

For true hourly ingestion, use Vercel Pro with `0 * * * *` or call `/api/cron/hourly` from an external hourly scheduler using `Authorization: Bearer <CRON_SECRET>`.

## 6. Validate the integration

Check:

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

## 7. Google Search setup

1. Verify the production domain in Google Search Console.
2. Submit `/sitemap.xml`.
3. Submit `/news-sitemap.xml`.
4. Keep canonical and hreflang URLs on the production domain.

Google controls crawl and indexing timing; the application can publish fresh sitemap data but cannot guarantee hourly indexing.

## 8. Security notes

- Never expose `APPWRITE_API_KEY` in browser code.
- Do not prefix server secrets with `VITE_`.
- Keep Appwrite tables private because all persistence flows through the Express API.
- Rotate the broad setup key after schema creation if you switch to the narrower runtime key.
- Keep source provenance internal for editorial verification and rights review.

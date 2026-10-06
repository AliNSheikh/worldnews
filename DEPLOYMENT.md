# News Discover — Vercel + Appwrite Production Setup

News Discover runs as a Vite/React frontend with serverless API functions on Vercel. Appwrite TablesDB is the primary persistent database. All Appwrite access is server-side; the API key must never use a `VITE_` prefix or be exposed to the browser.

## Connected Appwrite project

This repository is already bound to the following non-secret Appwrite defaults:

- Endpoint: `https://fra.cloud.appwrite.io/v1`
- Project ID: `6ac4bf0d00093b81fef7`
- Database ID: `worldnews`

The required private tables are:

- `newsroom_articles`
- `newsroom_categories`
- `newsroom_sources`
- `newsroom_comments`
- `newsroom_logs`
- `newsroom_settings`

Each table contains a required `payload` Longtext column. The API serializes the newsroom model as JSON into this column.

## 1. Configure Appwrite

Add this only to secure server-side environments:

```env
APPWRITE_API_KEY="YOUR_SERVER_ONLY_APPWRITE_API_KEY"
```

The endpoint, project ID, and database ID already have defaults in the code and can still be overridden when necessary.

## 2. Configure Vercel

In **Vercel → worldnews → Settings → Environment Variables**, add:

- `APPWRITE_API_KEY`
- `APP_URL=https://your-news-discover-domain.example`
- `CRON_SECRET`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`

Gemini is no longer required for the automated crawler. The current ingestion path stores source-derived headlines, text, SEO metadata, and original source images directly.

After changing environment variables, redeploy `main`.

## 3. Configure the custom News Discover domain

Attach the purchased News Discover domain in Vercel, then set the same canonical URL in the control panel under **Settings → Google Search & Analytics → Production Site URL**.

The saved site URL is used to build canonical links, sitemap URLs, robots.txt sitemap declarations, Open Graph URLs, and structured data.

## 4. Hourly ingestion

The repository includes `.github/workflows/hourly-crawler.yml`, which calls the protected crawler once every hour.

In **GitHub → worldnews → Settings → Secrets and variables → Actions** configure:

- Repository variable: `NEWS_DISCOVER_URL` = the full production origin, for example `https://your-domain.example`
- Repository secret: `CRON_SECRET` = exactly the same value as the Vercel `CRON_SECRET`

The workflow calls:

```text
GET /api/cron/hourly
Authorization: Bearer <CRON_SECRET>
```

It also supports **Run workflow** for a manual test.

The existing Vercel Hobby-compatible daily cron can remain as a backup. If the Vercel project is upgraded to a plan that permits hourly cron, its schedule can also be changed to `0 * * * *`.

## 5. Source-direct article ingestion

Automated imports no longer depend on Gemini. For each eligible RSS/Atom item the crawler:

1. Reads the feed headline, date, description, enclosure/media image, and link.
2. Fetches the article page when available.
3. Extracts source description, article text, author, and `og:image` / `twitter:image`.
4. Derives an SEO title, meta description, keywords, tags, and slug from source data.
5. Stores the article in Appwrite before counting the import as successful.
6. Keeps the source URL and media provenance internally for verification.

Make sure the source publisher permits the way its text and images are being republished. Technical access to a source does not itself grant republication rights.

## 6. Control panel article management

The Articles section supports:

- keyword search across article titles and text
- category and status filtering
- editing an article
- deleting an article
- opening the original source URL
- refreshing persisted Appwrite data

## 7. Google Analytics and Search Console

In **Control Panel → Settings → Google Search & Analytics** configure:

- Production Site URL
- Google Analytics Measurement ID (for example `G-XXXXXXXXXX`)
- Google Search Console verification token

The site injects the Analytics configuration and the Search Console verification meta tag from saved settings.

For Search Console:

1. Add the production domain/property in Google Search Console.
2. Complete ownership verification.
3. Submit `/sitemap.xml`.
4. Submit `/news-sitemap.xml`.
5. Inspect important article URLs when needed.

Google determines crawl and indexing timing. News Discover can expose correct crawlable URLs and fresh sitemaps, but no implementation can guarantee immediate indexing or legitimately bypass Google's indexing decisions.

## 8. SEO endpoints

Validate these URLs after deployment:

- `/robots.txt`
- `/sitemap.xml`
- `/news-sitemap.xml`
- `/rss.xml?lang=en`
- `/api/health`

The sitemap is generated dynamically from Appwrite and includes published article URLs, category URLs, last-modified dates, and source-derived images where available.

## 9. Optional Supabase migration

If old content still exists in Supabase, keep these variables temporarily in a local `.env`:

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

Verify the migrated rows in Appwrite before removing the temporary Supabase variables.

## 10. Security

- Never commit `APPWRITE_API_KEY` or `CRON_SECRET`.
- Do not prefix server secrets with `VITE_`.
- Keep Appwrite tables private and access them through server-side APIs.
- Rotate any secret that has been exposed outside a secret manager.
- Keep original source/provenance data for verification and rights review.

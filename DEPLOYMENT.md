# World News — Vercel + Supabase Production Setup

This project is designed to run as a Vite/React frontend with an Express server on Vercel and Supabase/Postgres for persistent newsroom data.

## 1. Create the Supabase database

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Run the complete file: `database/schema.sql`.
4. In **Project Settings → API**, copy:
   - Project URL → `SUPABASE_URL`
   - Service role key → `SUPABASE_SERVICE_ROLE_KEY`
5. Keep the service-role key server-only. Never expose it through a `VITE_` environment variable.

The schema uses RLS with no anonymous browser write policy. All CMS persistence is performed by the server.

## 2. Configure Vercel

Import the GitHub repository into Vercel, then add these variables for Production (and Preview when needed):

- `GEMINI_API_KEY`
- `APP_URL=https://your-production-domain.example`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET` — long random secret
- `ADMIN_PASSWORD` — strong CMS password
- `ADMIN_SESSION_SECRET` — separate long random signing secret

Deploy after saving the variables.

The repository's `vercel.json` uses a Hobby-compatible daily schedule:

```
0 2 * * *
```

which invokes `GET /api/cron/hourly` once per day. Vercel Hobby rejects cron expressions that run more than once per day. To restore true hourly ingestion, upgrade the Vercel project to Pro and change the schedule back to `0 * * * *`, or call the same authenticated endpoint from an external hourly scheduler. The endpoint requires the Vercel cron bearer secret in production.

## 3. Validate the deployment

Check these endpoints after deployment:

- `/api/health`
- `/robots.txt`
- `/sitemap.xml`
- `/news-sitemap.xml`
- `/rss.xml?lang=en`

Then open the CMS, sign in with `ADMIN_PASSWORD`, and verify:

1. Add or edit an RSS source.
2. Use **Test Source** to confirm it returns real parsed feed items.
3. Run a manual import.
4. Confirm new article rows appear in `public.newsroom_articles`.
5. Confirm each article has five language editions when generation succeeds.
6. Confirm weak/headline-only items are skipped or held for review instead of being fabricated.
7. Confirm image provenance is recorded internally.

## 4. Google Search setup

1. Add and verify the production domain in Google Search Console.
2. Submit `/sitemap.xml`.
3. Submit `/news-sitemap.xml`.
4. Keep canonical and hreflang URLs on the final production domain.
5. Use the URL Inspection tool for spot checks after launch.

The ingestion endpoint supports hourly execution, but the bundled Vercel Hobby schedule runs daily unless the project is upgraded or an external hourly scheduler is configured. The application publishes fresh sitemap data after ingestion, but Google controls crawl and indexing timing. Hourly indexing cannot be guaranteed by the site.

## 5. Editorial and media policy

The ingestion pipeline keeps upstream provenance internally for deduplication, verification, moderation, and rights review. It is not displayed as reader-facing source branding.

Before monetizing, confirm that each upstream feed permits the intended use of its text and images. Source images should preferably be copied into a controlled media-storage workflow only when you have appropriate rights. Generated or fallback images are labeled internally as such and are not represented as original article photography.

## 6. Hero Slider and ads

The CMS can configure promotional Hero Slider entries with:

- localized headline
- image or video URL
- clickable CTA label
- clickable CTA URL
- enabled/disabled state

When no promotional Hero Slider is active, the homepage falls back to the latest published articles.

Reserved ad slots are included in the homepage layout. Connect AdSense or another network only after the production domain, privacy/consent requirements, and ad policies are ready.

## 7. Recommended next architecture phase

For a family of specialized sites, the next phase should add:

- Supabase Storage for controlled Hero/media uploads
- a media-rights/status field and upload pipeline
- server-rendered article/category HTML for faster news SEO
- a tenant/site profile table for brand, domain, sources, categories, ad IDs and theme
- per-site sitemap/news-sitemap generation
- role-based CMS accounts instead of one shared admin password
- a deterministic lockfile in the repository
- monitoring for cron failures, AI failures and source extraction failures

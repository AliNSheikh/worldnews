# World News v1 Setup

This branch fixes article ingestion correctness and prepares the project for persistent, multilingual news publishing.

## 1. Supabase database

1. Create a Supabase project.
2. Open **SQL Editor** and run:
   `supabase/migrations/001_worldnews.sql`
3. Add these server-side environment variables to your hosting provider:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Never expose the Service Role key in Vite/client variables.
5. After deployment, verify:
   - `GET /api/database/status`
   - `GET /api/health`

On first successful connection the current seed articles, categories, sources, and settings are copied into Supabase. Later article/source/settings changes are persisted automatically.

## 2. AI editorial generation

Add:
- `GEMINI_API_KEY`

The ingestion pipeline now:
1. Reads RSS/Atom items.
2. Resolves the real article URL.
3. Fetches the publisher page.
4. Extracts the official title, description, image/video metadata, and factual article body.
5. Sends the fetched body as the grounding context for headline/description/body regeneration.
6. Produces all supported language versions (AR, EN, DE, ES, FR).
7. Stores SEO title, meta description, keywords/tags, FAQ/entities and translated slugs.
8. Saves the article to the database.

The prompt explicitly forbids inventing facts and prevents public source-acquisition details from being inserted into generated copy.

## 3. Reliable hourly automation

The Node process still has an hourly in-process scheduler for long-running servers.

For reliable execution on serverless hosts, configure the included GitHub Action:
`.github/workflows/hourly-ingest.yml`

Create repository secrets:
- `WORLDNEWS_APP_URL` = the deployed site URL, e.g. `https://news.example.com`
- `WORLDNEWS_CRON_SECRET` = a long random value

Set the same random value on the deployed server as:
- `CRON_SECRET`

The workflow calls `POST /api/crawler/run-now` once per hour.

## 4. Search / Google News

Configure:
- `APP_URL` with the canonical production domain.
- Google Search Console verification token from the admin settings.
- Google Analytics Measurement ID if desired.

Submit these URLs in Google Search Console:
- `/sitemap.xml`
- `/news-sitemap.xml`

The site serves:
- unique multilingual article URLs
- unique category URLs
- canonical tags
- hreflang alternates
- robots directives
- Open Graph/Twitter metadata
- NewsArticle structured data
- Google News sitemap entries for articles from the last 48 hours

Google decides crawl/index timing; publishing or updating the sitemap hourly improves discovery but cannot guarantee indexing every hour.

## 5. Hero Slider / advertising

Admin Settings now supports manual Hero Slides with:
- headline
- image or video URL
- media type
- clickable button label
- clickable destination URL
- active/inactive toggle

If there is at least one active manual slide, it replaces the homepage news hero. If there are none, the latest articles are shown automatically.

## 6. Sources

The Sources panel supports:
- add
- edit
- pause/resume
- test
- import now
- delete

Source URLs/names remain available internally for verification and deduplication. Public article/hero presentation does not expose the acquisition source.

## Recommended next phase

1. Replace the generic JSONB persistence payloads with normalized article/translation tables once volume grows.
2. Add object storage for downloaded/optimized images instead of relying on hotlinked originals.
3. Add a publisher-specific extraction adapter registry for difficult sources/paywalls.
4. Add editorial review thresholds when body extraction confidence is low.
5. Add Core Web Vitals monitoring, image resizing/WebP/AVIF, lazy loading and CDN cache tuning.
6. Add ad-slot components (header, in-article, sidebar, sticky/mobile) compatible with the chosen ad network.
7. Add automated internal-link suggestions and related-story entity matching.
8. Add per-language editorial QA before automatic publishing for high-risk categories.

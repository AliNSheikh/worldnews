# World News Foundation v1 — Deployment & Activation

This branch turns the existing project into a safer initial foundation for an automated multilingual newsroom without replacing the current React/Vite/Express architecture.

## What v1 changes

- Hourly ingestion through a protected cron endpoint plus GitHub Actions.
- Full article-page extraction before rewriting: JSON-LD `articleBody` first, cleaned article paragraphs second.
- Articles are skipped if reliable source content cannot be extracted.
- Synthetic fallback news fixtures and fabricated AI fallback reporting are removed.
- Headline, summary, body, SEO metadata, translations, media metadata, and internal provenance are persisted.
- Supabase/PostgreSQL persistence is optional in development and authoritative when configured.
- Public pages do not display ingestion-source names; source provenance remains available internally for administration, deduplication, compliance, and troubleshooting.
- Five language editions are generated: Arabic, English, German, Spanish, and French.
- Per-language article slugs, category URLs, canonical URLs, hreflang, robots directives, Open Graph, Twitter cards, and NewsArticle JSON-LD are rendered into the initial HTML response in production.
- Google News sitemap is limited to the most recent 48 hours and at most 1,000 news entries total.
- Manual Hero campaigns can be created in the control panel using an image/video URL, headline, button label, and button link. When no campaign is active, the latest articles are shown automatically.
- Article/source CRUD remains in the current admin panel; source editing is now supported.
- SEO editorial fields include SEO title, meta description, keywords, tags, focus keyphrase, image alt, canonical URL behavior, structured data, and multilingual alternates.

## Database activation

1. Create a Supabase project.
2. Open the Supabase SQL Editor and run `supabase/schema.sql`.
3. In the production server environment configure:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-side only; never expose it as a Vite/browser variable)
   - `GEMINI_API_KEY`
   - `APP_URL` using the final HTTPS production origin
   - `NEWS_FETCH_INTERVAL_MINUTES=60`
   - `CRON_SECRET` using a long random value
4. Deploy the Express/Vite application to a host that can run the Node server. The existing in-process scheduler works on an always-on host; serverless/sleeping hosts should rely on the protected cron endpoint.
5. In GitHub repository secrets create:
   - `WORLDNEWS_URL` = production origin, such as `https://news.example.com`
   - `CRON_SECRET` = the exact same secret configured on the server
6. Enable GitHub Actions. `.github/workflows/hourly-ingest.yml` invokes `POST /api/cron/hourly` once per hour.
7. Run the workflow manually once and verify:
   - `/api/health`
   - `/api/crawler/status`
   - new rows in `newsroom_articles`
   - source `lastImport` / `lastError`
   - generated language editions and SEO fields
8. In Google Search Console verify the production domain and submit:
   - `/sitemap.xml`
   - `/news-sitemap.xml`
9. Validate several article URLs with URL Inspection and Google's Rich Results Test. Google controls crawl/index timing; the application can publish fresh sitemaps and crawlable metadata immediately but cannot force hourly indexing.
10. Configure production source feeds only when you have the legal/contractual right to retrieve, transform, republish, and use their media. Keeping a source name out of the public UI does not remove attribution or licensing obligations that may apply.

## Production hardening recommended next

### Media storage

The current data model can persist media URLs and can temporarily hold generated image data. For production, upload owned/generated media to Supabase Storage (or another object store), save only the permanent public/object URL in the article record, generate responsive image sizes, and avoid storing large base64 images in PostgreSQL JSON.

### Editorial quality gate

For a durable Google News strategy, add:
- factual-diff checks between extracted source facts and every translation,
- duplicate/similarity detection across sources,
- editorial approval for sensitive/high-impact stories,
- correction/version history,
- author/editor profiles,
- original analysis, context, timelines, data, or reporting that adds meaningful value beyond a rewritten feed item.

### Specialized-site platform

Before cloning this code into many niche sites, convert site identity/configuration into a tenant/publication model:
- publications
- domains
- languages
- categories
- source sets
- design theme
- ad configuration
- analytics/Search Console IDs
- editorial policies

Use one ingestion/core platform and publication-specific configuration instead of duplicating the whole codebase.

### Advertising

Keep editorial and ad data separate. Add explicit ad-slot records (header, in-article, sidebar, sticky/mobile), responsive reserved dimensions to reduce layout shift, consent/privacy handling, and network-specific scripts loaded only after configuration. The manual Hero campaign in v1 is an owned-campaign placement and should not be treated as an ad-network integration.

## Important SEO note

The v1 code is intentionally designed to prevent publishing made-up fallback stories and to mark AI-failure output as `needs-review`. Automated translation/rephrasing alone is not a sustainable search strategy. Add original editorial value before scaling the same model across many specialized websites.

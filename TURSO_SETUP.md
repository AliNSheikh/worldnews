# Turso activation and migration

World News now uses Turso/libSQL as the primary persistent database.

## 1. Create or select the Turso database

In the Turso dashboard, open the database you created and copy:

- Database URL (starts with `libsql://`)
- Database authentication token

Set them locally or in Vercel as:

```bash
TURSO_DATABASE_URL="libsql://YOUR_DATABASE-YOUR_ORG.turso.io"
TURSO_AUTH_TOKEN="YOUR_DATABASE_TOKEN"
```

Never expose either value through a `VITE_` variable.

## 2. Create the newsroom schema

After installing dependencies:

```bash
npm install
npm run turso:setup
```

This creates the following tables if they do not already exist:

- `newsroom_articles`
- `newsroom_categories`
- `newsroom_sources`
- `newsroom_comments`
- `newsroom_logs`
- `newsroom_settings`

The SQL reference is also available at `database/turso-schema.sql`.

## 3. Optional Appwrite data migration

If the old Appwrite project becomes reachable, temporarily configure both the Appwrite and Turso environment variables, then run:

```bash
npm run turso:migrate:appwrite
```

This copies article, category, source, comment, automation-log, and site-settings payloads into Turso. Existing IDs and article metadata are preserved.

If Appwrite remains unavailable, deploy with the Turso variables only. On first startup the application seeds the standard categories, sources, and default settings into the empty Turso database.

## 4. Required production variables

Configure these in Vercel Production:

```bash
TURSO_DATABASE_URL="libsql://..."
TURSO_AUTH_TOKEN="..."
APP_URL="https://www.newsdiscover.org"
GEMINI_API_KEY="..."
ADMIN_PASSWORD="..."
ADMIN_SESSION_SECRET="..."
CRON_SECRET="..."
GOOGLE_SITE_VERIFICATION="..."
```

`GOOGLE_SITE_VERIFICATION` is recommended because it places the verification meta tag in the initial HTML response. The same verification token, GA4 measurement ID, homepage SEO, logo, favicon, AdSense snippets, and crawler limit can also be managed in the control panel.

## 5. Hourly crawler

The project cron is configured as:

```
0 * * * *
```

The endpoint is `/api/cron/hourly`. It requires:

```
Authorization: Bearer YOUR_CRON_SECRET
```

Each run:

- considers only feed items from the previous 60 minutes;
- prevents duplicate imports;
- imports at most the configured **Articles Per Source Per Hour** value for every active source.

If the hosting plan cannot execute hourly cron jobs, use an external scheduler to call the same protected endpoint once per hour.

## 6. Verify after deployment

Check:

- `/api/health` — persistence should report `turso` and configured/healthy.
- `/sitemap.xml`
- `/news-sitemap.xml`
- `/robots.txt`
- `/rss.xml`
- `/admin`

In the control panel, save branding/SEO/integration settings once so they are persisted to Turso.

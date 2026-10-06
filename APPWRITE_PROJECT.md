# Appwrite Project Binding

This repository is bound to the following non-secret Appwrite project defaults:

- Endpoint: `https://fra.cloud.appwrite.io/v1`
- Project ID: `6ac4bf0d00093b81fef7`
- Database ID: `worldnews`

The Appwrite API key is intentionally **not** stored in GitHub. Configure `APPWRITE_API_KEY` as a server-side environment variable in Vercel (and locally in `.env`).

Required tables:

- `newsroom_articles`
- `newsroom_categories`
- `newsroom_sources`
- `newsroom_comments`
- `newsroom_logs`
- `newsroom_settings`

All tables are private and use a required `payload` Longtext column.

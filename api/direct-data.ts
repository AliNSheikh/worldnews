import crypto from 'crypto';
import { createClient } from '@libsql/client';

export const maxDuration = 30;
const COOKIE = 'world_news_admin_session';

function clean(value: string | undefined): string {
  return String(value || '').trim().replace(/^['"]+|['"]+$/g, '');
}

function json(res: any, status: number, value: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(JSON.stringify(value));
}

function cookieMap(header = ''): Record<string, string> {
  return Object.fromEntries(
    header
      .split(';')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => {
        const index = value.indexOf('=');
        return index >= 0
          ? [decodeURIComponent(value.slice(0, index)), decodeURIComponent(value.slice(index + 1))]
          : [value, ''];
      })
  );
}

function isAdmin(req: any): boolean {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
  const token = cookieMap(req.headers?.cookie || '')[COOKIE];
  if (!secret || !token) return false;
  const [expiresRaw, signature] = token.split('.');
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires <= Date.now() || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(expiresRaw).digest('base64url');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function requestBody(req: any): Promise<Record<string, any>> {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return req.body.trim() ? JSON.parse(req.body) : {};
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

function parsePayload(value: unknown): any {
  if (value && typeof value === 'object') return value;
  return JSON.parse(String(value || '{}'));
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      cause:
        error.cause instanceof Error
          ? { name: error.cause.name, message: error.cause.message }
          : error.cause
            ? String(error.cause)
            : undefined,
    };
  }
  return { message: String(error) };
}

function connection() {
  const url = clean(process.env.TURSO_DATABASE_URL);
  const authToken = clean(process.env.TURSO_AUTH_TOKEN || process.env.TURSO_DATABASE_AUTH_TOKEN);
  if (!url || !authToken) {
    throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required.');
  }
  return createClient({ url, authToken });
}

async function ensureSchema(db: ReturnType<typeof createClient>) {
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS newsroom_articles (
        id TEXT PRIMARY KEY,
        original_url TEXT,
        category TEXT,
        status TEXT,
        published_at TEXT,
        updated_at TEXT,
        payload TEXT NOT NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_newsroom_articles_original_url ON newsroom_articles(original_url)',
      'CREATE INDEX IF NOT EXISTS idx_newsroom_articles_category ON newsroom_articles(category)',
      'CREATE INDEX IF NOT EXISTS idx_newsroom_articles_status ON newsroom_articles(status)',
      'CREATE INDEX IF NOT EXISTS idx_newsroom_articles_published_at ON newsroom_articles(published_at DESC)',
      'CREATE TABLE IF NOT EXISTS newsroom_categories (id TEXT PRIMARY KEY, payload TEXT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS newsroom_sources (id TEXT PRIMARY KEY, payload TEXT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS newsroom_comments (id TEXT PRIMARY KEY, payload TEXT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS newsroom_logs (id TEXT PRIMARY KEY, payload TEXT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS newsroom_settings (id TEXT PRIMARY KEY, payload TEXT NOT NULL)',
    ],
    'write'
  );
}

async function ensureMinimumDefaults(db: ReturnType<typeof createClient>) {
  const categoriesResult = await db.execute('SELECT COUNT(*) AS total FROM newsroom_categories');
  if (Number(categoriesResult.rows[0]?.total || 0) === 0) {
    const names = [
      ['world', 'World'],
      ['politics', 'Politics'],
      ['economy', 'Economy'],
      ['technology', 'Technology'],
      ['health', 'Health'],
      ['sports', 'Sports'],
      ['culture', 'Culture'],
    ];
    await db.batch(
      names.map(([slug, label], index) => ({
        sql: 'INSERT OR IGNORE INTO newsroom_categories (id, payload) VALUES (?, ?)',
        args: [
          'cat-' + slug,
          JSON.stringify({
            id: 'cat-' + slug,
            slug,
            names: { en: label, ar: label, de: label, es: label, fr: label },
            descriptions: { en: '', ar: '', de: '', es: '', fr: '' },
            sortOrder: index + 1,
            isVisible: true,
            inNavigation: true,
            seoTitle: label + ' News',
            seoDescription: 'Latest ' + label.toLowerCase() + ' news and analysis.',
            seoKeywords: [label.toLowerCase(), 'news'],
            seoNoIndex: false,
          }),
        ],
      })),
      'write'
    );
  }

  const settingsResult = await db.execute(
    "SELECT COUNT(*) AS total FROM newsroom_settings WHERE id = 'default'"
  );
  if (Number(settingsResult.rows[0]?.total || 0) === 0) {
    const settings = {
      names: { en: 'News Discover', ar: 'News Discover', de: 'News Discover', es: 'News Discover', fr: 'News Discover' },
      descriptions: { en: 'Source-driven international news discovery.', ar: '', de: '', es: '', fr: '' },
      logoText: 'NEWS DISCOVER',
      logoImage: '',
      faviconImage: '',
      homepageSeoTitle: 'News Discover | International News',
      homepageSeoDescription: 'Source-driven international news discovery and analysis.',
      homepageSeoKeywords: ['international news', 'world news', 'breaking news'],
      adsenseHeadCode: '',
      adsenseBodyCode: '',
      articlesPerSourcePerHour: 3,
      defaultLanguage: 'en',
      enabledLanguages: ['en'],
      primaryColor: '#0f172a',
      secondaryColor: '#334155',
      accentColor: '#0284c7',
      breakingColor: '#dc2626',
      contactInfo: { email: '', phone: '', address: '' },
      socialLinks: { twitter: '', facebook: '', linkedin: '', telegram: '', whatsapp: '' },
      footerText: { en: '', ar: '', de: '', es: '', fr: '' },
      commentModeration: 'strict_approval',
      autoIngestEnabled: true,
      aiAssistanceEnabled: false,
      editorialStatement: { en: '', ar: '', de: '', es: '', fr: '' },
      siteUrl: process.env.APP_URL || 'https://www.newsdiscover.org',
      googleSearchConsoleVerification: '',
      googleAnalyticsMeasurementId: '',
      heroSlides: [],
    };
    await db.execute({
      sql: "INSERT OR IGNORE INTO newsroom_settings (id, payload) VALUES ('default', ?)",
      args: [JSON.stringify(settings)],
    });
  }
}

async function listPayloads(db: ReturnType<typeof createClient>, table: string) {
  const result = await db.execute('SELECT payload FROM ' + table);
  return result.rows.map((row: any) => parsePayload(row.payload));
}

function buildSource(input: Record<string, any>, existing?: any) {
  const name = String(input.name ?? existing?.name ?? '').trim();
  const rssUrl = String(input.rssUrl ?? existing?.rssUrl ?? '').trim();
  if (!name) throw new Error('Source name is required.');
  if (!/^https?:\/\//i.test(rssUrl)) throw new Error('A valid HTTP(S) RSS URL is required.');
  return {
    ...(existing || {}),
    ...input,
    id: existing?.id || String(input.id || 'src-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex')),
    name,
    rssUrl,
    category: String(input.category ?? existing?.category ?? 'world'),
    defaultLanguage: 'en',
    language: 'en',
    trustLevel: input.trustLevel ?? existing?.trustLevel ?? 'verified',
    isActive: input.isActive === undefined ? existing?.isActive !== false : Boolean(input.isActive),
    lastImport: input.lastImport === undefined ? existing?.lastImport || null : input.lastImport || null,
    lastError: input.lastError === undefined ? existing?.lastError || null : input.lastError || null,
    importFrequency: 'Every 60 minutes',
    fetchIntervalMinutes: Number(input.fetchIntervalMinutes ?? existing?.fetchIntervalMinutes ?? 60),
    articlesCount: Number(input.articlesCount ?? existing?.articlesCount ?? 0),
  };
}

function buildArticle(input: Record<string, any>, existing?: any) {
  const now = new Date().toISOString();
  const id = existing?.id || String(input.id || 'art-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex'));
  const translations = { ...(existing?.translations || {}), ...(input.translations || {}) };
  if (!translations.en?.title?.trim()) throw new Error('The English article title is required.');
  return {
    ...(existing || {}),
    ...input,
    id,
    category: String(input.category ?? existing?.category ?? 'world'),
    editorialType: input.editorialType ?? existing?.editorialType ?? 'original',
    originalSource: String(input.originalSource ?? existing?.originalSource ?? 'News Discover Desk'),
    originalUrl: String(input.originalUrl ?? existing?.originalUrl ?? 'https://www.newsdiscover.org/editorial/' + encodeURIComponent(id)),
    image: String(input.image ?? existing?.image ?? ''),
    imageCredit: String(input.imageCredit ?? existing?.imageCredit ?? 'News Discover'),
    imageProvenance: String(input.imageProvenance ?? existing?.imageProvenance ?? 'CMS-provided editorial media'),
    imageLicense: String(input.imageLicense ?? existing?.imageLicense ?? 'Editorial use'),
    status: input.status ?? existing?.status ?? 'draft',
    isBreaking: Boolean(input.isBreaking ?? existing?.isBreaking ?? false),
    isPinned: Boolean(input.isPinned ?? existing?.isPinned ?? false),
    priority: Number(input.priority ?? existing?.priority ?? 5),
    views: Number(input.views ?? existing?.views ?? 0),
    shares: Number(input.shares ?? existing?.shares ?? 0),
    publishedAt: String(input.publishedAt ?? existing?.publishedAt ?? now),
    updatedAt: now,
    byline: String(input.byline ?? existing?.byline ?? 'News Discover Editorial Staff'),
    translations,
    hasVideo: Boolean(input.hasVideo ?? existing?.hasVideo ?? false),
  };
}

export default async function handler(req: any, res: any) {
  let stage = 'request-init';
  try {
    const url = new URL(req.url || '/', 'https://local');
    const resource = String(url.searchParams.get('resource') || '');
    const id = url.searchParams.get('id');
    const method = String(req.method || 'GET').toUpperCase();

    stage = 'connect-turso';
    const db = connection();

    stage = 'ensure-schema';
    await ensureSchema(db);

    stage = 'ensure-defaults';
    await ensureMinimumDefaults(db);

    const publicCommentSubmission = resource === 'comments' && method === 'POST';
    if (method !== 'GET' && !publicCommentSubmission && !isAdmin(req)) {
      return json(res, 401, { error: 'Administrator authentication required.' });
    }

    if (resource === 'sources') {
      if (method === 'GET') {
        stage = 'read-sources';
        if (id) {
          const result = await db.execute({
            sql: 'SELECT payload FROM newsroom_sources WHERE id = ? LIMIT 1',
            args: [id],
          });
          const found = result.rows.length ? parsePayload(result.rows[0].payload) : null;
          return json(res, found ? 200 : 404, found || { error: 'Source not found.' });
        }
        return json(res, 200, await listPayloads(db, 'newsroom_sources'));
      }

      if (method === 'POST') {
        stage = 'create-source';
        const source = buildSource(await requestBody(req));
        await db.execute({
          sql: 'INSERT INTO newsroom_sources (id, payload) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload',
          args: [source.id, JSON.stringify(source)],
        });
        return json(res, 201, source);
      }

      if ((method === 'PUT' || method === 'PATCH') && id) {
        stage = 'update-source';
        const existingResult = await db.execute({
          sql: 'SELECT payload FROM newsroom_sources WHERE id = ? LIMIT 1',
          args: [id],
        });
        if (!existingResult.rows.length) return json(res, 404, { error: 'Source not found.' });
        const source = buildSource(await requestBody(req), parsePayload(existingResult.rows[0].payload));
        await db.execute({
          sql: 'INSERT INTO newsroom_sources (id, payload) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload',
          args: [source.id, JSON.stringify(source)],
        });
        return json(res, 200, source);
      }

      if (method === 'DELETE' && id) {
        stage = 'delete-source';
        const result = await db.execute({ sql: 'DELETE FROM newsroom_sources WHERE id = ?', args: [id] });
        return json(res, Number(result.rowsAffected || 0) ? 200 : 404, Number(result.rowsAffected || 0) ? { success: true } : { error: 'Source not found.' });
      }
    }

    if (resource === 'articles') {
      if (method === 'GET') {
        stage = 'read-articles';
        if (id) {
          let result = await db.execute({ sql: 'SELECT payload FROM newsroom_articles WHERE id = ? LIMIT 1', args: [id] });
          if (result.rows.length) return json(res, 200, parsePayload(result.rows[0].payload));
          const all = await listPayloads(db, 'newsroom_articles');
          const bySlug = all.find((article: any) => article?.translations?.en?.slug === id);
          return json(res, bySlug ? 200 : 404, bySlug || { error: 'Article not found.' });
        }

        const status = url.searchParams.get('status');
        const category = url.searchParams.get('category');
        const source = url.searchParams.get('source');
        const search = String(url.searchParams.get('search') || '').trim().toLowerCase();
        const sort = url.searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest';
        const limit = Math.max(1, Math.min(5000, Number(url.searchParams.get('limit') || 100)));
        const offset = Math.max(0, Number(url.searchParams.get('offset') || 0));

        const clauses: string[] = [];
        const args: any[] = [];
        if (status) { clauses.push('status = ?'); args.push(status); }
        if (category && category !== 'all') { clauses.push('category = ?'); args.push(category); }
        const where = clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
        const order = sort === 'oldest' ? 'ASC' : 'DESC';
        const result = await db.execute({
          sql: 'SELECT payload FROM newsroom_articles' + where + ' ORDER BY datetime(coalesce(published_at, updated_at)) ' + order + ' LIMIT 5000',
          args,
        });
        let items = result.rows.map((row: any) => parsePayload(row.payload));
        if (source && source !== 'all') items = items.filter((article: any) => article.originalSource === source);
        if (search) {
          items = items.filter((article: any) => {
            const t = article?.translations?.en || {};
            return String(t.title || '').toLowerCase().includes(search) ||
              String(t.executiveSummary || '').toLowerCase().includes(search) ||
              String(article.originalSource || '').toLowerCase().includes(search);
          });
        }
        return json(res, 200, items.slice(offset, offset + limit));
      }

      if (method === 'POST') {
        stage = 'create-article';
        const article = buildArticle(await requestBody(req));
        await db.execute({
          sql: 'INSERT INTO newsroom_articles (id, original_url, category, status, published_at, updated_at, payload) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET original_url=excluded.original_url, category=excluded.category, status=excluded.status, published_at=excluded.published_at, updated_at=excluded.updated_at, payload=excluded.payload',
          args: [article.id, article.originalUrl || null, article.category || null, article.status || null, article.publishedAt || null, article.updatedAt || null, JSON.stringify(article)],
        });
        return json(res, 201, article);
      }

      if ((method === 'PUT' || method === 'PATCH') && id) {
        stage = 'update-article';
        const existingResult = await db.execute({ sql: 'SELECT payload FROM newsroom_articles WHERE id = ? LIMIT 1', args: [id] });
        if (!existingResult.rows.length) return json(res, 404, { error: 'Article not found.' });
        const article = buildArticle(await requestBody(req), parsePayload(existingResult.rows[0].payload));
        await db.execute({
          sql: 'INSERT INTO newsroom_articles (id, original_url, category, status, published_at, updated_at, payload) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET original_url=excluded.original_url, category=excluded.category, status=excluded.status, published_at=excluded.published_at, updated_at=excluded.updated_at, payload=excluded.payload',
          args: [article.id, article.originalUrl || null, article.category || null, article.status || null, article.publishedAt || null, article.updatedAt || null, JSON.stringify(article)],
        });
        return json(res, 200, article);
      }

      if (method === 'DELETE' && id) {
        stage = 'delete-article';
        const result = await db.execute({ sql: 'DELETE FROM newsroom_articles WHERE id = ?', args: [id] });
        return json(res, Number(result.rowsAffected || 0) ? 200 : 404, Number(result.rowsAffected || 0) ? { success: true } : { error: 'Article not found.' });
      }
    }

    if (resource === 'categories') {
      if (method === 'GET') {
        stage = 'read-categories';
        const items = await listPayloads(db, 'newsroom_categories');
        items.sort((a: any, b: any) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
        if (id) {
          const found = items.find((item: any) => item.id === id || item.slug === id);
          return json(res, found ? 200 : 404, found || { error: 'Category not found.' });
        }
        return json(res, 200, items);
      }

      if ((method === 'PUT' || method === 'PATCH') && id) {
        stage = 'update-category';
        const items = await listPayloads(db, 'newsroom_categories');
        const existing = items.find((item: any) => item.id === id || item.slug === id);
        if (!existing) return json(res, 404, { error: 'Category not found.' });
        const updated = { ...existing, ...(await requestBody(req)), id: existing.id };
        await db.execute({
          sql: 'INSERT INTO newsroom_categories (id, payload) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload',
          args: [updated.id, JSON.stringify(updated)],
        });
        return json(res, 200, updated);
      }
    }

    if (resource === 'settings') {
      if (method === 'GET') {
        stage = 'read-settings';
        const result = await db.execute("SELECT payload FROM newsroom_settings WHERE id = 'default' LIMIT 1");
        return json(res, result.rows.length ? 200 : 404, result.rows.length ? parsePayload(result.rows[0].payload) : { error: 'Settings not found.' });
      }

      if (method === 'PUT' || method === 'PATCH' || method === 'POST') {
        stage = 'update-settings';
        const current = await db.execute("SELECT payload FROM newsroom_settings WHERE id = 'default' LIMIT 1");
        const existing = current.rows.length ? parsePayload(current.rows[0].payload) : {};
        const updated = { ...existing, ...(await requestBody(req)) };
        await db.execute({
          sql: "INSERT INTO newsroom_settings (id, payload) VALUES ('default', ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload",
          args: [JSON.stringify(updated)],
        });
        return json(res, 200, updated);
      }
    }

    if (resource === 'logs' && method === 'GET') {
      stage = 'read-logs';
      const items = await listPayloads(db, 'newsroom_logs');
      items.sort((a: any, b: any) => new Date(b.completedAt || b.startedAt || 0).getTime() - new Date(a.completedAt || a.startedAt || 0).getTime());
      return json(res, 200, items.slice(0, 100));
    }

    if (resource === 'comments') {
      if (method === 'GET') {
        stage = 'read-comments';
        let items = await listPayloads(db, 'newsroom_comments');
        const articleId = url.searchParams.get('articleId');
        const status = url.searchParams.get('status');
        if (articleId) items = items.filter((item: any) => item.articleId === articleId);
        if (status) items = items.filter((item: any) => item.moderationStatus === status);
        items.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        return json(res, 200, items);
      }

      if (method === 'POST') {
        stage = 'create-comment';
        const input = await requestBody(req);
        const comment = {
          id: 'comm-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex'),
          articleId: String(input.articleId || ''),
          authorName: String(input.authorName || '').trim(),
          content: String(input.content || '').trim(),
          moderationStatus: 'pending',
          createdAt: new Date().toISOString(),
          language: 'en',
        };
        if (!comment.articleId || !comment.authorName || !comment.content) {
          return json(res, 400, { error: 'Article, author name, and comment content are required.' });
        }
        await db.execute({
          sql: 'INSERT INTO newsroom_comments (id, payload) VALUES (?, ?)',
          args: [comment.id, JSON.stringify(comment)],
        });
        return json(res, 201, comment);
      }
    }

    return json(res, 405, { error: 'Unsupported resource or method.' });
  } catch (error: unknown) {
    console.error('[direct-data]', stage, error);
    return json(res, 503, {
      code: 'DIRECT_TURSO_DATA_FAILED',
      stage,
      error: normalizeError(error),
    });
  }
}

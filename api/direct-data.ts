import crypto from 'crypto';

export const maxDuration = 30;

const ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
const PROJECT_ID = '6ac4bf0d00093b81fef7';
const DATABASE_ID = 'worldnews';
const COOKIE = 'world_news_admin_session';

const TABLES: Record<string, string> = {
  articles: 'newsroom_articles',
  categories: 'newsroom_categories',
  sources: 'newsroom_sources',
  comments: 'newsroom_comments',
  logs: 'newsroom_logs',
  settings: 'newsroom_settings',
};

function json(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function cookies(header = ''): Record<string, string> {
  return Object.fromEntries(header.split(';').map((v) => v.trim()).filter(Boolean).map((v) => {
    const i = v.indexOf('=');
    return i >= 0 ? [decodeURIComponent(v.slice(0, i)), decodeURIComponent(v.slice(i + 1))] : [v, ''];
  }));
}

function isAdmin(req: any): boolean {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
  const token = cookies(req.headers?.cookie || '')[COOKIE];
  if (!secret || !token) return false;
  const [expiresRaw, signature] = token.split('.');
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires <= Date.now() || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(expiresRaw).digest('base64url');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function body(req: any): Promise<Record<string, any>> {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return req.body.trim() ? JSON.parse(req.body) : {};
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

function appwriteHeaders(): Record<string, string> {
  const key = String(process.env.APPWRITE_API_KEY || '').trim();
  if (!key) throw new Error('APPWRITE_API_KEY is missing from the active Vercel environment.');
  return {
    'X-Appwrite-Project': PROJECT_ID,
    'X-Appwrite-Key': key,
    'X-Appwrite-Response-Format': '2.3.0',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function aw(path: string, init: RequestInit = {}): Promise<any> {
  const r = await fetch(`${ENDPOINT}${path}`, { ...init, headers: { ...appwriteHeaders(), ...(init.headers || {}) } });
  const text = await r.text();
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  if (!r.ok) {
    const detail = typeof parsed === 'string' ? parsed : parsed?.message || JSON.stringify(parsed);
    throw new Error(`Appwrite ${r.status}: ${detail || r.statusText}`);
  }
  return parsed;
}

function tablePath(table: string): string {
  return `/tablesdb/${encodeURIComponent(DATABASE_ID)}/tables/${encodeURIComponent(table)}/rows`;
}

function rowId(id: string): string {
  const clean = String(id || 'row').trim();
  if (/^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/.test(clean)) return clean;
  return `r_${crypto.createHash('sha256').update(clean).digest('hex').slice(0, 34)}`;
}

function parseRow<T = any>(row: any): T | null {
  const raw = row?.data?.payload ?? row?.payload;
  if (!raw) return null;
  if (typeof raw === 'object') return raw as T;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

async function listPayloads(table: string): Promise<any[]> {
  const out: any[] = [];
  for (let offset = 0; offset < 10000; offset += 100) {
    const qs = new URLSearchParams();
    qs.append('queries[]', 'limit(100)');
    qs.append('queries[]', `offset(${offset})`);
    qs.set('total', 'false');
    qs.set('ttl', '0');
    const page = await aw(`${tablePath(table)}?${qs.toString()}`);
    const rows = Array.isArray(page?.rows) ? page.rows : [];
    for (const row of rows) {
      const value = parseRow(row);
      if (value) out.push(value);
    }
    if (rows.length < 100) break;
  }
  return out;
}

async function upsert(table: string, id: string, value: any) {
  return aw(`${tablePath(table)}/${encodeURIComponent(rowId(id))}`, {
    method: 'PUT',
    body: JSON.stringify({ data: { payload: JSON.stringify(value) } }),
  });
}

async function remove(table: string, id: string) {
  return aw(`${tablePath(table)}/${encodeURIComponent(rowId(id))}`, { method: 'DELETE' });
}

function slugify(value: string, fallback: string): string {
  const s = String(value || '').toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06ff]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return s || fallback;
}

function normalizeArticle(input: Record<string, any>): any {
  const now = new Date().toISOString();
  const id = String(input.id || `art-${Date.now()}-${Math.floor(Math.random() * 100000)}`);
  const langs = ['en', 'ar', 'de', 'es', 'fr'];
  const incoming = input.translations || {};
  const translations: Record<string, any> = {};
  for (const lang of langs) {
    const t = incoming[lang] || {};
    const title = String(t.title || '').trim();
    translations[lang] = {
      language: lang,
      title,
      slug: slugify(String(t.slug || title), id),
      executiveSummary: String(t.executiveSummary || title),
      structuredBody: String(t.structuredBody || t.executiveSummary || ''),
      seoTitle: String(t.seoTitle || title).slice(0, 70),
      metaDescription: String(t.metaDescription || t.executiveSummary || title).slice(0, 180),
      keywords: Array.isArray(t.keywords) ? t.keywords.filter(Boolean) : [],
      tags: Array.isArray(t.tags) ? t.tags.filter(Boolean) : [],
      imageAlt: String(t.imageAlt || title || 'World News article image'),
      faq: Array.isArray(t.faq) ? t.faq : [],
      translationStatus: t.translationStatus || 'draft',
      entities: Array.isArray(t.entities) ? t.entities : [],
      ...(t.corrections ? { corrections: String(t.corrections) } : {}),
    };
  }
  if (!langs.some((l) => translations[l].title)) throw new Error('At least one article title is required.');
  const primary = translations.en.title ? translations.en : langs.map((l) => translations[l]).find((t) => t.title) || translations.en;
  return {
    id,
    category: input.category || 'world',
    editorialType: input.editorialType || 'original',
    originalSource: input.originalSource || 'World News Desk',
    originalUrl: input.originalUrl || `https://worldnews.org/wire/${id}`,
    originalDescription: input.originalDescription || primary.executiveSummary || primary.title,
    officialImageUrl: input.officialImageUrl,
    archiveSnapshot: input.archiveSnapshot,
    image: input.image || '',
    imageCredit: input.imageCredit || 'World News Photo Service',
    imageProvenance: input.imageProvenance || 'World News CMS',
    imageLicense: input.imageLicense || 'Editorial Press License',
    status: input.status || 'draft',
    isBreaking: Boolean(input.isBreaking),
    isPinned: Boolean(input.isPinned),
    priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : 5,
    views: Number.isFinite(Number(input.views)) ? Number(input.views) : 0,
    shares: Number.isFinite(Number(input.shares)) ? Number(input.shares) : 0,
    publishedAt: input.publishedAt || now,
    updatedAt: now,
    scheduledAt: input.scheduledAt,
    byline: input.byline || 'World News Editorial Staff',
    translations,
    hasVideo: Boolean(input.hasVideo),
    videoUrl: input.videoUrl,
    videoIframeUrl: input.videoIframeUrl,
    videoThumbnail: input.videoThumbnail,
  };
}

export default async function handler(req: any, res: any) {
  try {
    const url = new URL(req.url || '/', 'https://local');
    const resource = String(url.searchParams.get('resource') || '');
    const id = url.searchParams.get('id');
    const method = String(req.method || 'GET').toUpperCase();
    const table = TABLES[resource];
    if (!table) return json(res, 404, { error: 'Unknown data resource.' });

    if (method !== 'GET' && !isAdmin(req)) return json(res, 401, { error: 'Administrator authentication required.' });

    if (method === 'GET') {
      let values = await listPayloads(table);
      if (resource === 'articles') {
        const category = url.searchParams.get('category');
        const status = url.searchParams.get('status');
        const search = String(url.searchParams.get('search') || '').toLowerCase();
        if (category && category !== 'all') values = values.filter((a) => a.category === category);
        if (status) values = values.filter((a) => a.status === status);
        if (search) values = values.filter((a) => JSON.stringify(a).toLowerCase().includes(search));
        values.sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());
      }
      if (resource === 'categories') values.sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
      if (resource === 'settings') return json(res, 200, values[0] || {});
      if (id) {
        const found = values.find((v) => v.id === id || (resource === 'articles' && Object.values(v.translations || {}).some((t: any) => t?.slug === id)));
        return json(res, found ? 200 : 404, found || { error: 'Record not found.' });
      }
      return json(res, 200, values);
    }

    if (method === 'POST') {
      const input = await body(req);
      let value: any;
      if (resource === 'articles') value = normalizeArticle(input);
      else if (resource === 'sources') {
        if (!String(input.name || '').trim() || !/^https?:\/\//i.test(String(input.rssUrl || ''))) throw new Error('Source name and a valid HTTP(S) RSS URL are required.');
        value = {
          ...input,
          id: input.id || `src-${Date.now()}`,
          name: String(input.name).trim(),
          rssUrl: String(input.rssUrl).trim(),
          category: input.category || 'world',
          defaultLanguage: input.defaultLanguage || input.language || 'en',
          language: input.language || input.defaultLanguage || 'en',
          trustLevel: input.trustLevel || 'verified',
          isActive: input.isActive !== false,
          lastImport: input.lastImport || null,
          lastError: input.lastError || null,
          importFrequency: input.importFrequency || `Every ${Number(input.fetchIntervalMinutes || 60)} minutes`,
          fetchIntervalMinutes: Math.max(5, Number(input.fetchIntervalMinutes || 60)),
          articlesCount: Number(input.articlesCount || 0),
        };
      } else {
        value = { ...input, id: input.id || `${resource}-${Date.now()}` };
      }
      await upsert(table, resource === 'settings' ? 'default' : value.id, value);
      return json(res, 201, value);
    }

    if (method === 'PUT' || method === 'PATCH') {
      if (!id && resource !== 'settings') return json(res, 400, { error: 'Record id is required.' });
      const input = await body(req);
      let current: any = {};
      if (resource !== 'settings') current = (await listPayloads(table)).find((v) => v.id === id) || {};
      else current = (await listPayloads(table))[0] || {};
      const value = resource === 'articles' ? { ...current, ...input, id: current.id || id, updatedAt: new Date().toISOString() } : { ...current, ...input, ...(id ? { id } : {}) };
      await upsert(table, resource === 'settings' ? 'default' : String(id), value);
      return json(res, 200, value);
    }

    if (method === 'DELETE') {
      if (!id) return json(res, 400, { error: 'Record id is required.' });
      await remove(table, id);
      return json(res, 200, { success: true });
    }

    return json(res, 405, { error: 'Method not allowed.' });
  } catch (error: any) {
    console.error('[direct-data]', error);
    return json(res, 503, { error: error?.message || String(error), code: 'DIRECT_APPWRITE_DATA_FAILED' });
  }
}

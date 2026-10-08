import crypto from 'crypto';
import type {
  Article,
  Category,
  Comment,
  NewsSource,
  SiteSettings,
} from '../src/types';
import { tursoRepository } from '../server/tursoRepository';

export const maxDuration = 30;
const COOKIE = 'world_news_admin_session';

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
  const parts = token.split('.');
  const expiresRaw = parts[0];
  const signature = parts[1];
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

function errorPayload(error: unknown, stage: string) {
  const normalized =
    error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          cause:
            error.cause instanceof Error
              ? { name: error.cause.name, message: error.cause.message }
              : error.cause
                ? String(error.cause)
                : undefined,
        }
      : { message: String(error) };

  return {
    code: 'DIRECT_TURSO_DATA_FAILED',
    stage,
    error: normalized,
  };
}

function sourceFromInput(input: Record<string, any>, existing?: NewsSource | null): NewsSource {
  const nowId = 'src-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
  const name = String(input.name ?? existing?.name ?? '').trim();
  const rssUrl = String(input.rssUrl ?? existing?.rssUrl ?? '').trim();

  if (!name) throw new Error('Source name is required.');
  if (!/^https?:\/\//i.test(rssUrl)) throw new Error('A valid HTTP(S) RSS URL is required.');

  return {
    id: existing?.id || String(input.id || nowId),
    name,
    rssUrl,
    category: String(input.category ?? existing?.category ?? 'world'),
    defaultLanguage: 'en',
    language: 'en',
    trustLevel: (input.trustLevel ?? existing?.trustLevel ?? 'verified') as NewsSource['trustLevel'],
    isActive: input.isActive === undefined ? existing?.isActive !== false : Boolean(input.isActive),
    lastImport: input.lastImport === undefined ? existing?.lastImport || null : input.lastImport || null,
    lastError: input.lastError === undefined ? existing?.lastError || null : input.lastError || null,
    importFrequency: 'Every 60 minutes',
    fetchIntervalMinutes: Number(input.fetchIntervalMinutes ?? existing?.fetchIntervalMinutes ?? 60),
    articlesCount: Number(input.articlesCount ?? existing?.articlesCount ?? 0),
  };
}

function articleFromInput(input: Record<string, any>, existing?: Article | null): Article {
  const now = new Date().toISOString();
  const id =
    existing?.id ||
    String(input.id || 'art-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex'));

  const translations = {
    ...(existing?.translations || {}),
    ...(input.translations || {}),
  } as Article['translations'];

  const english = translations.en;
  if (!english?.title?.trim()) {
    throw new Error('The English article title is required.');
  }

  return {
    ...(existing || ({} as Article)),
    ...input,
    id,
    category: String(input.category ?? existing?.category ?? 'world'),
    editorialType: input.editorialType ?? existing?.editorialType ?? 'original',
    originalSource: String(input.originalSource ?? existing?.originalSource ?? 'News Discover Desk'),
    originalUrl: String(
      input.originalUrl ??
        existing?.originalUrl ??
        'https://www.newsdiscover.org/editorial/' + encodeURIComponent(id)
    ),
    image: String(input.image ?? existing?.image ?? ''),
    imageCredit: String(input.imageCredit ?? existing?.imageCredit ?? 'News Discover'),
    imageProvenance: String(
      input.imageProvenance ?? existing?.imageProvenance ?? 'CMS-provided editorial media'
    ),
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
  } as Article;
}

export default async function handler(req: any, res: any) {
  let stage = 'request-init';

  try {
    const url = new URL(req.url || '/', 'https://local');
    const resource = String(url.searchParams.get('resource') || '');
    const id = url.searchParams.get('id');
    const method = String(req.method || 'GET').toUpperCase();

    stage = 'validate-turso-configuration';

    if (!tursoRepository.isConfigured()) {
      throw new Error('Turso environment variables are not configured in this deployment.');
    }

    const publicCommentSubmission = resource === 'comments' && method === 'POST';
    if (method !== 'GET' && !publicCommentSubmission && !isAdmin(req)) {
      return json(res, 401, { error: 'Administrator authentication required.' });
    }

    if (resource === 'articles') {
      if (method === 'GET') {
        stage = 'read-articles';
        if (id) {
          const found = await tursoRepository.getArticle(id);
          return json(res, found ? 200 : 404, found || { error: 'Article not found.' });
        }

        const limit = Number(url.searchParams.get('limit') || 100);
        const offset = Number(url.searchParams.get('offset') || 0);
        const items = await tursoRepository.listArticles({
          category: url.searchParams.get('category') || undefined,
          status: url.searchParams.get('status') || undefined,
          source: url.searchParams.get('source') || undefined,
          search: url.searchParams.get('search') || undefined,
          sort: url.searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest',
          limit,
          offset,
        });
        return json(res, 200, items);
      }

      if (method === 'POST') {
        stage = 'create-article';
        const created = articleFromInput(await requestBody(req));
        await tursoRepository.upsertArticle(created);
        return json(res, 201, created);
      }

      if ((method === 'PUT' || method === 'PATCH') && id) {
        stage = 'update-article';
        const existing = await tursoRepository.getArticle(id);
        if (!existing) return json(res, 404, { error: 'Article not found.' });
        const updated = articleFromInput(await requestBody(req), existing);
        await tursoRepository.upsertArticle(updated);
        return json(res, 200, updated);
      }

      if (method === 'DELETE' && id) {
        stage = 'delete-article';
        const deleted = await tursoRepository.deleteArticle(id);
        return json(res, deleted ? 200 : 404, deleted ? { success: true } : { error: 'Article not found.' });
      }
    }

    if (resource === 'categories') {
      if (method === 'GET') {
        stage = 'read-categories';
        if (id) {
          const found = await tursoRepository.getCategory(id);
          return json(res, found ? 200 : 404, found || { error: 'Category not found.' });
        }
        return json(res, 200, await tursoRepository.listCategories());
      }

      if ((method === 'PUT' || method === 'PATCH') && id) {
        stage = 'update-category';
        const existing = await tursoRepository.getCategory(id);
        if (!existing) return json(res, 404, { error: 'Category not found.' });
        const updated = { ...existing, ...(await requestBody(req)), id: existing.id } as Category;
        await tursoRepository.upsertCategory(updated);
        return json(res, 200, updated);
      }
    }

    if (resource === 'sources') {
      if (method === 'GET') {
        stage = 'read-sources';
        if (id) {
          const found = await tursoRepository.getSource(id);
          return json(res, found ? 200 : 404, found || { error: 'Source not found.' });
        }
        return json(res, 200, await tursoRepository.listSources());
      }

      if (method === 'POST') {
        stage = 'create-source';
        const created = sourceFromInput(await requestBody(req));
        await tursoRepository.upsertSource(created);
        return json(res, 201, created);
      }

      if ((method === 'PUT' || method === 'PATCH') && id) {
        stage = 'update-source';
        const existing = await tursoRepository.getSource(id);
        if (!existing) return json(res, 404, { error: 'Source not found.' });
        const updated = sourceFromInput(await requestBody(req), existing);
        await tursoRepository.upsertSource(updated);
        return json(res, 200, updated);
      }

      if (method === 'DELETE' && id) {
        stage = 'delete-source';
        const deleted = await tursoRepository.deleteSource(id);
        return json(res, deleted ? 200 : 404, deleted ? { success: true } : { error: 'Source not found.' });
      }
    }

    if (resource === 'settings') {
      if (method === 'GET') {
        stage = 'read-settings';
        const settings = await tursoRepository.getSettings();
        return json(res, settings ? 200 : 404, settings || { error: 'Settings not found.' });
      }

      if (method === 'PUT' || method === 'PATCH' || method === 'POST') {
        stage = 'update-settings';
        const existing = await tursoRepository.getSettings();
        if (!existing) throw new Error('Default site settings are missing from Turso.');
        const updated = { ...existing, ...(await requestBody(req)) } as SiteSettings;
        await tursoRepository.upsertSettings(updated);
        return json(res, 200, updated);
      }
    }

    if (resource === 'logs' && method === 'GET') {
      stage = 'read-logs';
      return json(res, 200, await tursoRepository.listLogs(100));
    }

    if (resource === 'comments') {
      if (method === 'GET') {
        stage = 'read-comments';
        return json(
          res,
          200,
          await tursoRepository.listComments(
            url.searchParams.get('articleId') || undefined,
            url.searchParams.get('status') || undefined
          )
        );
      }

      if (method === 'POST') {
        stage = 'create-comment';
        const input = await requestBody(req);
        const comment: Comment = {
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
        await tursoRepository.upsertComment(comment);
        return json(res, 201, comment);
      }
    }

    return json(res, 405, { error: 'Unsupported resource or method.' });
  } catch (error: unknown) {
    console.error('[direct-data]', stage, error);
    return json(res, 503, errorPayload(error, stage));
  }
}

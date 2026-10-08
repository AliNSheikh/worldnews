import crypto from 'crypto';

export const maxDuration = 30;
const COOKIE = 'world_news_admin_session';

function json(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function cookieMap(header = ''): Record<string, string> {
  return Object.fromEntries(
    header
      .split(';')
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => {
        const i = v.indexOf('=');
        return i >= 0
          ? [decodeURIComponent(v.slice(0, i)), decodeURIComponent(v.slice(i + 1))]
          : [v, ''];
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

async function body(req: any): Promise<Record<string, any>> {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return req.body.trim() ? JSON.parse(req.body) : {};
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
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

export default async function handler(req: any, res: any) {
  let stage = 'request-init';

  try {
    const url = new URL(req.url || '/', 'https://local');
    const resource = String(url.searchParams.get('resource') || '');
    const id = url.searchParams.get('id');
    const method = String(req.method || 'GET').toUpperCase();

    stage = 'load-db-module';
    const { db } = await import('../server/db');

    stage = 'hydrate-database';
    await db.refresh(5000);

    const publicCommentSubmission = resource === 'comments' && method === 'POST';
    if (method !== 'GET' && !publicCommentSubmission && !isAdmin(req)) {
      return json(res, 401, { error: 'Administrator authentication required.' });
    }

    if (resource === 'articles') {
      if (method === 'GET') {
        stage = 'read-articles';
        if (id) {
          const found = db.getArticleById(id) || db.getArticleBySlug(id);
          return json(res, found ? 200 : 404, found || { error: 'Article not found.' });
        }
        const limitParam = Number(url.searchParams.get('limit') || 0);
        const offsetParam = Number(url.searchParams.get('offset') || 0);
        return json(
          res,
          200,
          db.getArticles({
            category: url.searchParams.get('category') || undefined,
            status: url.searchParams.get('status') || undefined,
            search: url.searchParams.get('search') || undefined,
            limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined,
            offset: Number.isFinite(offsetParam) && offsetParam > 0 ? offsetParam : undefined,
          })
        );
      }

      if (method === 'POST') {
        stage = 'create-article';
        const created = db.createArticle(await body(req));
        stage = 'flush-article-write';
        await db.flush();
        return json(res, 201, created);
      }

      if ((method === 'PUT' || method === 'PATCH') && id) {
        stage = 'update-article';
        const updated = db.updateArticle(id, await body(req));
        stage = 'flush-article-write';
        await db.flush();
        return json(res, 200, updated);
      }

      if (method === 'DELETE' && id) {
        stage = 'delete-article';
        const deleted = db.deleteArticle(id);
        if (!deleted) return json(res, 404, { error: 'Article not found.' });
        stage = 'flush-article-write';
        await db.flush();
        return json(res, 200, { success: true });
      }
    }

    if (resource === 'categories') {
      if (method === 'GET') {
        stage = 'read-categories';
        if (id) {
          const found = db.getCategories().find((item) => item.id === id || item.slug === id);
          return json(res, found ? 200 : 404, found || { error: 'Category not found.' });
        }
        return json(res, 200, db.getCategories());
      }

      if ((method === 'PUT' || method === 'PATCH') && id) {
        stage = 'update-category';
        const updated = db.updateCategory(id, await body(req));
        stage = 'flush-category-write';
        await db.flush();
        return json(res, 200, updated);
      }
    }

    if (resource === 'sources') {
      if (method === 'GET') {
        stage = 'read-sources';
        const values = db.getSources();
        if (id) {
          const found = values.find((item) => item.id === id);
          return json(res, found ? 200 : 404, found || { error: 'Source not found.' });
        }
        return json(res, 200, values);
      }

      if (method === 'POST') {
        stage = 'parse-source-input';
        const input = await body(req);
        const name = String(input.name || '').trim();
        const rssUrl = String(input.rssUrl || '').trim();

        if (!name || !/^https?:\/\//i.test(rssUrl)) {
          return json(res, 400, {
            error: 'Source name and a valid HTTP(S) RSS URL are required.',
          });
        }

        stage = 'create-source';
        const created = db.addSource({
          ...input,
          name,
          rssUrl,
          category: String(input.category || 'world'),
          defaultLanguage: 'en',
          language: 'en',
          trustLevel: input.trustLevel || 'verified',
          isActive: input.isActive !== false,
          lastImport: input.lastImport || null,
          lastError: input.lastError || null,
          importFrequency: 'Every 60 minutes',
          fetchIntervalMinutes: 60,
          articlesCount: Number(input.articlesCount || 0),
        } as any);

        stage = 'flush-source-write';
        await db.flush();
        return json(res, 201, created);
      }

      if ((method === 'PUT' || method === 'PATCH') && id) {
        stage = 'update-source';
        const updated = db.updateSource(id, await body(req));
        stage = 'flush-source-write';
        await db.flush();
        return json(res, 200, updated);
      }

      if (method === 'DELETE' && id) {
        stage = 'delete-source';
        const deleted = db.deleteSource(id);
        if (!deleted) return json(res, 404, { error: 'Source not found.' });
        stage = 'flush-source-write';
        await db.flush();
        return json(res, 200, { success: true });
      }
    }

    if (resource === 'settings') {
      if (method === 'GET') {
        stage = 'read-settings';
        return json(res, 200, db.getSettings());
      }

      if (method === 'PUT' || method === 'PATCH' || method === 'POST') {
        stage = 'update-settings';
        const updated = db.updateSettings(await body(req));
        stage = 'flush-settings-write';
        await db.flush();
        return json(res, 200, updated);
      }
    }

    if (resource === 'logs' && method === 'GET') {
      stage = 'read-logs';
      return json(res, 200, db.getLogs());
    }

    if (resource === 'comments') {
      if (method === 'GET') {
        stage = 'read-comments';
        return json(
          res,
          200,
          db.getComments(
            url.searchParams.get('articleId') || undefined,
            url.searchParams.get('status') || undefined
          )
        );
      }

      if (method === 'POST') {
        stage = 'create-comment';
        const clientIp = String(
          req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1'
        );
        const created = db.addComment((await body(req)) as any, clientIp);
        stage = 'flush-comment-write';
        await db.flush();
        return json(res, 201, created);
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

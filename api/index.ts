import { createApp } from '../server/app.js';

export const maxDuration = 60;

// Keep the Vercel entry point intentionally small and fully statically linked.
// Vercel's Node runtime executes compiled ESM. Dynamic extensionless imports such
// as import('../server/db') survive into /var/task/api/index.js and Node 24 then
// fails to resolve /var/task/server/db. A static import lets Vercel trace and
// bundle the complete newsroom server dependency graph at build time.
const appPromise = createApp({ serveFrontend: false });

export default async function handler(req: any, res: any) {
  try {
    const app = await appPromise;
    return app(req, res);
  } catch (error: unknown) {
    console.error('[World News API] Failed to initialize or execute:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({
        error: 'The newsroom API failed to initialize or execute.',
        code: 'API_RUNTIME_FAILED',
        detail: message,
      }));
    }
  }
}

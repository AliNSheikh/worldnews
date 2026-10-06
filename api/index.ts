import { createApp } from '../server/app';

let appPromise = createApp({ serveFrontend: false });

export default async function handler(req: any, res: any) {
  try {
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    console.error('[World News API] Initialization failed:', error);

    // Allow a later cold/warm request to retry initialization after an
    // environment variable or upstream service issue has been corrected.
    appPromise = createApp({ serveFrontend: false });

    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(
        JSON.stringify({
          error: 'The server API could not initialize. Check the Vercel environment variables and Appwrite connection, then redeploy.',
        })
      );
    }
  }
}

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const fallbackVerification = '2jPjrp7JwTnr9NB0oVbnk4FHP_VhGKp01NEo8qXQ2R8';
  const googleVerification = String(
    process.env.GOOGLE_SITE_VERIFICATION || fallbackVerification
  )
    .replace(/^google-site-verification=/, '')
    .trim();

  const staticVerificationPlugin = {
    name: 'news-discover-static-google-verification',
    transformIndexHtml(html: string) {
      return html.replace('__GOOGLE_SITE_VERIFICATION__', googleVerification);
    },
  };

  return {
    plugins: [staticVerificationPlugin, react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

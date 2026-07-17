// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  site: 'https://tashif.codes/', // <-- Top-level, not inside sitemap()
  vite: {
    plugins: [tailwindcss()],
    // Mirror production /proxy/* rewrites so live-refresh works in `astro dev`
    server: {
      proxy: {
        '/proxy/gh-stats': {
          target: 'https://github-stats.tashif.codes',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/proxy\/gh-stats/, ''),
        },
        '/proxy/lc-stats': {
          target: 'https://leetcode-stats.tashif.codes',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/proxy\/lc-stats/, ''),
        },
        '/proxy/blog': {
          target: 'https://blog.tashif.codes',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/proxy\/blog/, '/api'),
        },
        '/proxy/ghpvc': {
          target: 'https://komarev.com',
          changeOrigin: true,
          rewrite: () => '/ghpvc/',
        },
      },
    },
  },
  integrations: [
    react(),
    sitemap()
  ],
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
  }),
});
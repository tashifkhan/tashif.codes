// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

const EXCLUDED_FROM_SITEMAP = [
  /^\/download\//,
  /^\/fdroid\/[^/]+\/?$/,
  /^\/projects\/[^/]+\/releases\//,
  /^\/404\/?$/,
  /^\/shortlink\//,
];

// https://astro.build/config
export default defineConfig({
  site: 'https://tashif.codes/', // <-- Top-level, not inside sitemap()
  // One address per page: /blog/post, never /blog/post/. Vercel 308s the
  // slashed form, and canonicals, internal links and the sitemap all use the
  // slash-less one, so search engines never see two URLs for one page.
  trailingSlash: 'never',
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
    sitemap({
      // Only list pages that are meant to rank. These are left out:
      // - /download/* and /fdroid/<app> only redirect elsewhere (noindex)
      // - per-release pages are noindexed copies of GitHub release notes
      // - /404 and the shortlink fallback are not real pages
      filter: (page) => !EXCLUDED_FROM_SITEMAP.some((re) => re.test(new URL(page).pathname)),
    })
  ],
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
  }),
});
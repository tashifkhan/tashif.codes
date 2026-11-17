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
];

// https://astro.build/config
export default defineConfig({
  site: 'https://tashif.codes/', // <-- Top-level, not inside sitemap()
  // One address per page: /blog/post, never /blog/post/. Canonicals, internal
  // links and the sitemap use the slash-less form, and vercel.json 308s the
  // slashed one. That redirect lives in vercel.json rather than
  // `trailingSlash: 'never'` because the adapter's version would also 308 the
  // PostHog (/ph/e/), shortener (/u/) and API proxies, which need their slash.
  trailingSlash: 'ignore',
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
      // - /404 is not a real page
      filter: (page) => !EXCLUDED_FROM_SITEMAP.some((re) => re.test(new URL(page).pathname)),
      serialize: (item) => ({ ...item, url: item.url.replace(/(?<=[^/])\/+$/, '').replace(/^(https:\/\/[^/]+)$/, '$1/') }),
    })
  ],
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
  }),
});
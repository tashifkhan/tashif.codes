# tashif-codes-fdroid Worker

Serves F-Droid APKs from the private `tashif-codes-fdroid` R2 bucket at the
canonical site URLs:

- `https://tashif.codes/fdroid/repo/<apkName>.apk`
- `https://tashif.codes/fdroid/<alias>.apk` (`Billi`, `Patchwork`, `DelhiNCRMetro`, `NammaMetro`)

Official F-Droid clients need HTTP 200 of the exact bytes (no 302s) and may
use Range requests. This Worker returns 200 / 206, an ETag, and immutable
cache headers.

Cloudflare route patterns only allow a trailing path wildcard, so the
production routes are `tashif.codes/fdroid/*` and `www.tashif.codes/fdroid/*`.
Non-APK paths (signed indexes, listing pages) are passed through to the
Vercel production alias in `ORIGIN_HOST`.

Test URL: https://tashif-codes-fdroid.tashifkhan010.workers.dev

```sh
# from this directory, with CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID set
npx wrangler@4 deploy
```

## Rollback

1. Remove the two `/fdroid/*` routes (dashboard, or `wrangler deploy` after
   deleting the `routes` array in `wrangler.jsonc`). Requests then fall
   through to Vercel.
2. After APKs have been removed from git, Vercel will 404 those URLs. To
   keep serving APKs, leave the Worker routes in place or put the APKs back
   in `public/fdroid` and redeploy the site. Objects remain in R2 until
   deleted.

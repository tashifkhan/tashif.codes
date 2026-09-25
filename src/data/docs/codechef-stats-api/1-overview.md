# CodeChef stats API

FastAPI scraper for public CodeChef handles. Live at [codechef-stats.tashif.codes](https://codechef-stats.tashif.codes). Source is [tashifkhan/codechef-stats-api](https://github.com/tashifkhan/codechef-stats-api).

CodeTrace puts CodeChef in the `competitive` ring with Codeforces.

Path param is `handle`, not `username`. Canonical routes still look like `/{handle}/profile`. The old `/profile/{handle}` paths remain as deprecated aliases.

## Docs map

- [Overview](1-overview)
- [Dashboard](2-dashboard)
- [Canonical endpoints](3-canonical-endpoints)
- [Envelope and schemas](3.1-envelope-and-schemas)
- [Platform notes](4-platform-notes)
- [Architecture](5-architecture)
- [HTML scrape](5.1-html-scrape)
- [Request path](5.2-request-path)

## What it returns

Stars / rating / division, contest history, heatmap of submissions, and an SVG card. Data comes from public CodeChef profile pages, then gets mapped into the shared envelope.

## Live access

- Site: [codechef-stats.tashif.codes](https://codechef-stats.tashif.codes)
- Dashboard: [codechef-stats.tashif.codes/dashboard](https://codechef-stats.tashif.codes/dashboard)
- Playground: [codechef-stats.tashif.codes/playground](https://codechef-stats.tashif.codes/playground)
- OpenAPI: [codechef-stats.tashif.codes/docs](https://codechef-stats.tashif.codes/docs)
- Sample JSON: [tourist/profile](https://codechef-stats.tashif.codes/tourist/profile)
- Repo: [github.com/tashifkhan/codechef-stats-api](https://github.com/tashifkhan/codechef-stats-api)

## Run it locally

```bash
cd CodeChef
uv sync
uv run python -m uvicorn main:app --reload --port 8005
```

`python main.py` does nothing. There is no `__main__`. Always uvicorn.

Optional knobs: `CODECHEF_REQUEST_TIMEOUT`, `CODECHEF_RATE_LIMIT_REQUESTS`, `CODECHEF_CACHE_TTL_SECONDS`.

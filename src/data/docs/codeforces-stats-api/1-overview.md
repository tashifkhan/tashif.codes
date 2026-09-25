# Codeforces stats API

FastAPI wrapper around the public Codeforces API. Live at [codeforces-stats.tashif.codes](https://codeforces-stats.tashif.codes). Source is [tashifkhan/CodeForces-API](https://github.com/tashifkhan/CodeForces-API).

Path param is `userid` (the handle). Envelope `platform` is `"codeforces"`. Category in CodeTrace is `competitive`.

## Docs map

- [Overview](1-overview)
- [Dashboard](2-dashboard)
- [Canonical endpoints](3-canonical-endpoints)
- [Envelope and schemas](3.1-envelope-and-schemas)
- [Platform notes](4-platform-notes)
- [Architecture](5-architecture)
- [Official API](5.1-official-api)
- [Request path](5.2-request-path)

## What it returns

Rating, max rating, rank titles, contest history, solved count, heatmap from submissions, upcoming contests, and multi-handle helpers.

This is the one stats API that still has first-class non-user routes: upcoming contests, common contests, and `/multi/{handles}`.

## Live access

- Site: [codeforces-stats.tashif.codes](https://codeforces-stats.tashif.codes)
- Playground: [codeforces-stats.tashif.codes/playground](https://codeforces-stats.tashif.codes/playground)
- OpenAPI: [codeforces-stats.tashif.codes/docs](https://codeforces-stats.tashif.codes/docs)
- Sample JSON: [tourist/profile](https://codeforces-stats.tashif.codes/tourist/profile)
- Repo: [github.com/tashifkhan/CodeForces-API](https://github.com/tashifkhan/CodeForces-API)

## Run it locally

```bash
cd CodeForces
uv sync
uv run python -m uvicorn app:app --reload --port 8003
```

`python app.py` binds `8000` in production mode and `58353` in development. Use 8003.

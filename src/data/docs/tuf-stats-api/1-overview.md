# takeUforward stats API

FastAPI reader for public TUF DSA progress. Live at [tuf-stats.tashif.codes](https://tuf-stats.tashif.codes). Source is [tashifkhan/TUF-Stats-API](https://github.com/tashifkhan/TUF-Stats-API).

CodeTrace category is `dsa`, with LeetCode.

TUF's older shared-profile URL 404s. This service hits `https://backend-go.takeuforward.org/api/v1/progress/dsa/{username}`.

## Docs map

- [Overview](1-overview)
- [Dashboard](2-dashboard)
- [Canonical endpoints](3-canonical-endpoints)
- [Envelope and schemas](3.1-envelope-and-schemas)
- [Platform notes](4-platform-notes)
- [Architecture](5-architecture)
- [DSA progress API](5.1-dsa-progress-api)
- [Request path](5.2-request-path)

## What it returns

DSA sheet totals, topic bars, heatmap from 2023 onward (TUF rejects earlier years), badges if the profile has them. Contests and rating exist as empty canonical sections so the CodeTrace loop does not special-case the platform.

## Live access

- Site: [tuf-stats.tashif.codes](https://tuf-stats.tashif.codes)
- Playground: [tuf-stats.tashif.codes/playground](https://tuf-stats.tashif.codes/playground)
- OpenAPI: [tuf-stats.tashif.codes/docs](https://tuf-stats.tashif.codes/docs)
- Sample JSON: [striver/profile](https://tuf-stats.tashif.codes/striver/profile)
- Repo: [github.com/tashifkhan/TUF-Stats-API](https://github.com/tashifkhan/TUF-Stats-API)

## Run it locally

```bash
cd TUF
uv sync
uv run python -m uvicorn app:app --reload --port 8007
```

Optional:

```dotenv
TUF_REDIS_URL=redis://localhost:6379/0
TUF_API_CACHE_TTL_SECONDS=3600
TUF_FIRST_HEATMAP_YEAR=2023
```

# HackerRank stats API

FastAPI reader for public HackerRank profiles. Live at [hackerrank-stats.tashif.codes](https://hackerrank-stats.tashif.codes). Source is [tashifkhan/hackerrank-api](https://github.com/tashifkhan/hackerrank-api).

The schema puts HackerRank in `fundamentals` with GFG. CodeTrace's `fetchCard` currently tags it `dsa`. Same mismatch as GFG.

No auth. Public endpoints only. Some profiles return empty submission history even when the UI shows activity. That is upstream, not a cache bug.

## Docs map

- [Overview](1-overview)
- [Dashboard](2-dashboard)
- [Canonical endpoints](3-canonical-endpoints)
- [Envelope and schemas](3.1-envelope-and-schemas)
- [Platform notes](4-platform-notes)
- [Architecture](5-architecture)
- [Public REST](5.1-public-rest)
- [Request path](5.2-request-path)

## What it returns

Solved challenge count, practice score, best track rank, badges, recent submissions, contest history when it exists, heatmap when the calendar is populated.

Difficulty breakdown and acceptance rate are not in public HackerRank data. Canonical `byDifficulty` stays zeros / nulls.

## Live access

- Site: [hackerrank-stats.tashif.codes](https://hackerrank-stats.tashif.codes)
- Playground: [hackerrank-stats.tashif.codes/playground](https://hackerrank-stats.tashif.codes/playground)
- OpenAPI: [hackerrank-stats.tashif.codes/docs](https://hackerrank-stats.tashif.codes/docs)
- Repo: [github.com/tashifkhan/hackerrank-api](https://github.com/tashifkhan/hackerrank-api)

## Run it locally

```bash
cd HackerRank
uv sync
uv run python -m uvicorn main:app --reload --port 8006
```

Built-in default is `58352`, same as LeetCode. Use 8006.

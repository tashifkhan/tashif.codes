# Multi-Project Analytics API

A unified FastAPI service that combines Vercel migration data with live PostHog analytics data.

## Features

- **Multi-Project Support**: Handle multiple projects with a single API
- **Unified Data**: Merge historical Vercel data with live PostHog analytics
- **Parallel Fetching**: All PostHog queries run concurrently for fast responses
- **Dynamic Registry**: Easy to add new projects via configuration

## Project Structure

```
api/
├── main.py              # FastAPI application and routes
├── config.py            # Project registry configuration
├── models.py            # Pydantic data models
├── services/
│   ├── __init__.py
│   ├── posthog.py       # PostHog API integration
│   ├── vercel.py        # Vercel data loading
│   └── merger.py        # Data merging logic
├── data/                # Vercel migration JSON files
│   ├── portfolio.json
│   ├── blog.json
│   ├── dashboard.json
│   ├── jiit-campus-updates.json
│   └── jiit-timetable-website.json
├── .env.example         # Environment variables template
└── pyproject.toml       # Python dependencies
```

## Setup

1. **Install dependencies**:
   ```bash
   cd api
   pip install -e .
   # or with uv:
   uv sync
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your PostHog API key and project IDs
   ```

3. **Run the API**:
   ```bash
   uvicorn main:app --reload
   # or
   python main.py
   ```

## API Endpoints

### List Projects
```
GET /api/v1/projects
```
Returns all available projects:
```json
{
  "projects": [
    {"slug": "portfolio", "name": "Portfolio Website"},
    {"slug": "blog", "name": "Blog"}
  ],
  "total": 2
}
```

### Get Project Stats
```
GET /api/v1/{project_slug}/stats?days=30
```
Returns unified analytics for a specific project:
- `timeseries`: Daily pageviews and visitors
- `stats`: Breakdowns by path, device, referrer, OS, country

### Get Timeseries Only
```
GET /api/v1/{project_slug}/timeseries?days=30
```
Lightweight endpoint for time-based data only.

## Adding a New Project

1. **Get PostHog Project ID**: Settings → Project Settings in PostHog

2. **Add to Registry** (in `config.py`):
   ```python
   PROJECT_REGISTRY = {
       "my-new-project": {
           "ph_id": os.getenv("PH_MY_PROJECT_ID", ""),
           "vercel_file": DATA_DIR / "my-new-project.json",
           "display_name": "My New Project"
       }
   }
   ```

3. **Add environment variable** (in `.env`):
   ```
   PH_MY_PROJECT_ID=12345
   ```

4. **Add Vercel data** (optional): Place migration JSON in `data/my-new-project.json`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `POSTHOG_API_KEY` | Your PostHog personal API key |
| `POSTHOG_BASE_URL` | PostHog API URL (default: `https://us.posthog.com`) |
| `PH_*_ID` | PostHog project IDs for each project |
| `CLOUDFLARE_PROXY_URL` | JPortal's analytics proxy, which adds its own Cloudflare token and tags (default: `https://jportal.jmut.de/api/analytics`). Set empty to use `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_TAG` directly |

## Analytics snapshots

The stats dashboard uses the last successful response while it fetches an update.
Snapshots are keyed by project and day range. They are fresh for five minutes and
remain available for 30 days. Redis stores both the snapshot and a short refresh
lease, so separate Vercel instances do not repeat the same refresh concurrently.

### Production setup

1. Create or connect an Upstash Redis database to the Vercel project.
2. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to the server
   environment. Connecting the database through Vercel Storage with the default
   `KV` prefix sets `KV_REST_API_URL` and `KV_REST_API_TOKEN` instead, and the
   config reads those too. Use the read/write REST token. Never prefix these with `PUBLIC_`.
   Use separate databases for preview and production deployments.
3. Redeploy. `vercel.json` sets the Python function duration to 60 seconds.
   The provider refresh deadline is 45 seconds, leaving time for storage and a
   useful error response. Individual provider HTTP operations still use 8 seconds.
4. Open `/projects/stats?project=dashboard`. The first request for a project/range
   fills its snapshot. Subsequent requests read Redis. Visit the desired ranges
   once to warm them before sharing the page.

Without Redis credentials, local development uses a bounded instance cache.
That fallback does not persist across cold starts. The integration cannot provide
shared production snapshots until both environment variables are set.

### Request behavior

`GET /projects/stats/api/v1/stats?slugs=dashboard&days=0` returns a snapshot and a
`cache` object with `stale`, `refreshing`, `refresh_error`, and `retry_after`.
If there is no snapshot, it waits for an initial fetch. `refresh=true` requests a
new snapshot. Repeated refreshes within ten seconds use the latest result.

The browser displays a stale snapshot first, then sends a separate refresh request.
This does not depend on tasks surviving after a serverless response. If another
instance already owns the refresh, the browser polls every four seconds, at most
12 times. No refresh runs without a request from a visitor. Closing the page may
cancel its request; the next visitor can retry after the lease expires.

Both stats and timeseries endpoints share the same complete snapshot. Their
responses use `Cache-Control: no-store`, so CDN caching cannot hide refresh status
or retain errors. Provider failures never replace successful stats with empty or
partial data. A failed refresh preserves the original timestamp and applies a
60-second retry cooldown. If Redis is unreachable, the API can serve a snapshot
already held by that instance; a cold instance returns a recoverable error.

The UI keeps previous stats visible while changing filters and labels the project
and range still on screen. Initial loads use card/chart skeletons. Slow requests
show a message after four seconds. Failed refreshes keep the chart and offer retry.
The displayed update time always comes from the snapshot, not a browser-wide
refresh timestamp.

### Verification

```sh
uv run --project api python -m unittest discover -s api/tests -v
bunx astro check
bun run test:analytics
```

Backend tests simulate Redis persistence, concurrent refreshes, storage outages,
provider failures and deadline cancellation. Browser tests use mocked API responses;
they do not require production credentials. To verify the real integration after
deployment, request a snapshot, wait five minutes, reopen the dashboard and confirm
that old stats appear before the refresh completes. The Redis database should have
`analytics:v1:stats:dashboard:0` with the original timestamp until refresh succeeds.

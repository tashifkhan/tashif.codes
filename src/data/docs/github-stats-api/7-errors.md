# Error handling

The API uses ordinary HTTP status codes. FastAPI `HTTPException` bodies use `detail`. Some older stats errors still look like a zeroed `GitHubStatsResponse`. Redis middleware can answer 404 and 429 before a route runs.

## Status codes

| Status | When |
| --- | --- |
| `200` | Success. JSON, HTML, or `image/svg+xml` for the stats card. |
| `400` | Bad heatmap window. Unknown `view`, or `view=year` without `year`. |
| `404` | GitHub user missing, or a cached invalid handle. |
| `429` | This API's rate limit (IP or handle), not GitHub's. |
| `500` | Server config or uncaught failure. Missing `GITHUB_TOKEN` is the common case. |
| `502` | GitHub returned an error that is not 404 and not a throttle. |
| `503` | GitHub primary or secondary rate limit. Do not treat this as a missing user. |

GitHub 403 with `x-ratelimit-remaining: 0` or `retry-after` is `503`, not `404`. Mapping throttle to 404 used to blacklist a real login in the invalid-user cache.

## Error shapes

### FastAPI detail

Most handlers raise `HTTPException`. Body is:

```json
{
  "detail": "User tashifkhan not found"
}
```

Examples: `User {username} not found`, `GitHub API error`, `GitHub API rate limit exceeded, please retry shortly`, `Failed to retrieve pull requests`, `GitHub token not configured`.

### Stats-shaped error

`GitHubStatsResponse.error()` still exists for the combined stats payload:

```json
{
  "status": "error",
  "message": "User not found or API error",
  "topLanguages": [],
  "totalCommits": 0,
  "longestStreak": 0,
  "currentStreak": 0,
  "profile_visitors": 0,
  "contributions": null
}
```

Missing token:

```json
{
  "status": "error",
  "message": "GitHub token not configured",
  "topLanguages": [],
  "totalCommits": 0,
  "longestStreak": 0,
  "currentStreak": 0
}
```

Prefer the HTTP status over `message`. A 200 with `status: success` is the happy path for enveloped routes.

### Rate limit from this API

Redis middleware, when cache is enabled:

```json
{
  "status": "error",
  "message": "Rate limit exceeded",
  "retryAfter": 12,
  "limitedBy": "ip"
}
```

Headers: `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. `limitedBy` is `ip`, `handle`, `invalid-ip`, or `invalid-handle`.

Cached missing user:

```json
{
  "status": "error",
  "message": "User does not exist"
}
```

That response includes `X-Cache: NEGATIVE-HIT`.

## This API's rate limits

Defaults when Redis is configured. Override with env vars.

| Window | Default |
| --- | --- |
| Per IP | 60 requests / 60s (`RATE_LIMIT_IP_REQUESTS`) |
| Per handle | 30 requests / 60s (`RATE_LIMIT_HANDLE_REQUESTS`) |
| Invalid-user IP | 10 / 600s |
| Invalid-user handle | 5 / 600s |

Successful 200s cache for `API_CACHE_TTL_SECONDS` (default 3600). SVG uses its own 24h `Cache-Control`. Invalid users cache for `INVALID_USER_CACHE_TTL_SECONDS` (default 300). `/`, `/docs`, `/redoc`, `/openapi.json`, and `/favicon.ico` skip this cache.

Without Redis, this layer does not run. GitHub's 5000/hour token budget still applies. Attribution walks stop when remaining GitHub calls drop below `ATTRIBUTION_RATE_LIMIT_FLOOR` (default 500) so they do not starve every other route.

## What to retry

- `429` from this API: wait `Retry-After`.
- `503` from GitHub throttle: wait and retry. Do not cache that handle as missing.
- `502`: GitHub hiccup. Retry once.
- `404`: the login is gone, or it was recently 404-cached. Wait out the invalid TTL if you just created the account.
- `400` on heatmap: fix `view` / `year`.
- `500` with `GitHub token not configured`: operator problem, not the caller.

# Cache, rate limit, and deploy

## Redis

`REDIS_URL` turns the middleware on. There is no in-process HTTP cache on LeetCode (CodeChef is the sibling that also has `TTLCache`). Redis errors fail open: cache miss, rate limit allow.

| Env | Default |
| --- | --- |
| `API_CACHE_TTL_SECONDS` | 3600 |
| `INVALID_USER_CACHE_TTL_SECONDS` | 300 |
| `RATE_LIMIT_IP_REQUESTS` | 60 per 60s |
| `RATE_LIMIT_HANDLE_REQUESTS` | 30 per 60s |
| `INVALID_RATE_LIMIT_IP_REQUESTS` | 10 per 600s |
| `INVALID_RATE_LIMIT_HANDLE_REQUESTS` | 5 per 600s |
| `RATE_LIMIT_BACKOFF_BASE_SECONDS` | 5 |
| `RATE_LIMIT_BACKOFF_MAX_SECONDS` | 300 |

Keys:

- `cache:leetcode:{sha256}`
- `invalid:leetcode:{handle}`
- `rl:ip:leetcode:{ip}` / `rl:handle:leetcode:{handle}`
- `backoff:{same}` / `violations:{same}`

Invalid-user markers: `user does not exist`, `user not found`, `not found on`, `invalid username`. Contest-empty is not one of them.

## App bind

`PORT` default **58352**, `HOST` default `0.0.0.0`. `APP_ENV` or `FLASK_ENV` `development` turns uvicorn reload on. HackerRank's built-in port is also 58352. Local map in `RUNNING.md` pins LeetCode at **8002**.

`vercel.json` sends every path to `wsgi.py`. No `GITHUB_TOKEN` here. No LeetCode session cookie. Public GraphQL only.

## HTML

`GET /` is the custom docs page. `GET /playground` is the tester. FastAPI `/docs` and `/redoc` still exist. `GET/POST /ph/{path}` proxies PostHog to `https://eu.i.posthog.com` so the playground can count usage without a second origin.

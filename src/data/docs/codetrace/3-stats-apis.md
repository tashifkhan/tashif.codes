# Stats APIs

`src/api/unifiedClient.ts` maps each platform to a base URL. In production those are the Vite `/api/{platform}` proxies. Locally you can point `VITE_*_API` at the FastAPI processes from `~/Projects/Stats APIs`.

| Platform | Live API | Playground | Envelope |
| --- | --- | --- | --- |
| GitHub | [github-stats.tashif.codes](https://github-stats.tashif.codes) | [playground](https://github-stats.tashif.codes/playground) | [schemas](/docs/github-stats-api/3.1-envelope-and-schemas) |
| LeetCode | [leetcode-stats.tashif.codes](https://leetcode-stats.tashif.codes) | [playground](https://leetcode-stats.tashif.codes/playground) | [schemas](/docs/leetcode-stats-api/3.1-envelope-and-schemas) |
| Codeforces | [codeforces-stats.tashif.codes](https://codeforces-stats.tashif.codes) | [playground](https://codeforces-stats.tashif.codes/playground) | [schemas](/docs/codeforces-stats-api/3.1-envelope-and-schemas) |
| GFG | [gfg-stats.tashif.codes](https://gfg-stats.tashif.codes) | [playground](https://gfg-stats.tashif.codes/playground) | [schemas](/docs/gfg-stats-api/3.1-envelope-and-schemas) |
| CodeChef | [codechef-stats.tashif.codes](https://codechef-stats.tashif.codes) | [playground](https://codechef-stats.tashif.codes/playground) | [schemas](/docs/codechef-stats-api/3.1-envelope-and-schemas) |
| HackerRank | [hackerrank-stats.tashif.codes](https://hackerrank-stats.tashif.codes) | [playground](https://hackerrank-stats.tashif.codes/playground) | [schemas](/docs/hackerrank-stats-api/3.1-envelope-and-schemas) |
| TUF | [tuf-stats.tashif.codes](https://tuf-stats.tashif.codes) | [playground](https://tuf-stats.tashif.codes/playground) | [schemas](/docs/tuf-stats-api/3.1-envelope-and-schemas) |

GitHost (Forgejo / Gitea / Codeberg) is a sibling API. CodeTrace does not call it yet. See [GitHost stats API](/docs/githost-stats-api/1-overview).

## Canonical loop

`fetchCard` in `src/api/cards.ts` does **not** hit `GET /{username}`. It fires six section GETs in parallel:

```http
GET /{username}/profile
GET /{username}/stats
GET /{username}/contests
GET /{username}/rating
GET /{username}/heatmap
GET /{username}/badges
```

One section failing becomes an empty stub so the other five still paint. All six failing throws the first error.

Intended CodeTrace category map (schema + this table):

| Category | Platforms |
| --- | --- |
| `dsa` | LeetCode, TUF |
| `competitive` | CodeChef, Codeforces |
| `fundamentals` | GFG, HackerRank |
| `development` | GitHub |

What `fetchCard` actually assigns today: GitHub is `development`, Codeforces and CodeChef are `competitive`, everything else is `dsa`. GFG and HackerRank never land in `fundamentals`, so the aggregated profile's fundamentals bucket stays empty. The schema still has the four buckets. The client ternary is the mismatch.

Missing fields are `null` / `[]` / `{}`, never omitted. An empty TUF contest list is still a successful platform.

Envelope `status: "error"` or HTTP 429 throws. 429 surfaces `Retry-After` in the error string.

## Redis on the APIs

CodeTrace is the SPA. It does not run `CacheRateLimitMiddleware`. Each FastAPI behind `/api/{platform}` does. Same walk in every tree: CORS, then middleware with that platform's `platform=` key, then cache key `cache:{platform}:{sha256}`, invalid-user 404, 60/IP and 30/handle per minute.

| API | Walk |
| --- | --- |
| GitHub | [Cache and limiter](/docs/github-stats-api/8.2-cache-and-limiter) |
| LeetCode | [Request path](/docs/leetcode-stats-api/5.1-request-path) |
| Codeforces | [Request path](/docs/codeforces-stats-api/5.2-request-path) |
| GFG | [Request path](/docs/gfg-stats-api/5.2-request-path) |
| CodeChef | [Request path](/docs/codechef-stats-api/5.2-request-path) |
| HackerRank | [Request path](/docs/hackerrank-stats-api/5.2-request-path) |
| TUF | [Request path](/docs/tuf-stats-api/5.2-request-path) |
| GitHost | [Request path](/docs/githost-stats-api/5.3-request-path) |

Without `REDIS_URL` (or Upstash REST on GitHub, TUF, GitHost), those APIs skip cache and rate limits. CodeTrace still fires six GETs. You just pay upstream every time.

## Local backends

From `~/Projects/Stats APIs` (see `RUNNING.md` in that folder). Built-in ports collide, so pin 8001–8007:

```bash
cd GitHub      && uv run python -m uvicorn main:app --reload --port 8001
cd LeetCode    && uv run python -m uvicorn app:app --reload --port 8002
cd CodeForces  && uv run python -m uvicorn app:app --reload --port 8003
cd GFG         && uv run python -m uvicorn app:app --reload --port 8004
cd CodeChef    && uv run python -m uvicorn main:app --reload --port 8005
cd HackerRank  && uv run python -m uvicorn main:app --reload --port 8006
cd TUF         && uv run python -m uvicorn app:app --reload --port 8007
```

GitHub needs `GITHUB_TOKEN` in `GitHub/.env`. CodeChef's `python main.py` is a no-op. Always uvicorn.

From the CodeTrace repo, `scripts/start-apis.py` frees those ports, starts the seven FastAPI apps, and health-checks them. It looks for the sibling folders under `~/Projects/Stats APIs`. GitHost is not in that script. If you want it too:

```bash
cd GitHost && uv run uvicorn main:app --reload --port 8008
```

CodeTrace `.env.local`:

```dotenv
VITE_GITHUB_API=http://localhost:8001
VITE_LEETCODE_API=http://localhost:8002
VITE_CODEFORCES_API=http://localhost:8003
VITE_GFG_API=http://localhost:8004
VITE_CODECHEF_API=http://localhost:8005
VITE_HACKERRANK_API=http://localhost:8006
VITE_TUF_API=http://localhost:8007
```

Without those, Vite proxies `/api/github` and friends to the live `*-stats.tashif.codes` hosts.

Dev script `scripts/start-apis.py` in the CodeTrace repo can boot the FastAPI set for you.

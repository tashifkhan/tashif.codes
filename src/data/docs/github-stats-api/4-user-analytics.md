# API endpoints: user analytics

Languages, streaks, own-commit breakdown, profile views, the SVG card, and the canonical card routes that wrap the same data.

Default language exclusions on `/{username}/languages` and `/{username}/contributions/breakdown` are Markdown, JSON, YAML, and XML. `/{username}/stats` and `/{username}/stats/svg` default to excluding nothing unless you pass `exclude` or `excluded`.

`exclude` is a comma-separated string. `excluded` is the older repeatable query (`?excluded=HTML&excluded=CSS`). If `excluded` is present it wins.

## Own-commit attribution

With `attributed=true` (the default), language percentages count only commits the requested user authored. Forks contribute the patches they wrote, not the upstream codebase. Other people's commits in the user's repos are ignored. Vendored paths such as `node_modules`, `dist`, lockfiles, and minified bundles are skipped.

Walking diffs costs hundreds of GitHub calls and will not finish in one request. Each walk has a wall-clock deadline and caches per repo, keyed by `pushed_at`. Repos are remeasured only after a new push.

- `/{username}/languages` and `/{username}/stats` never fall back to whole-repo language bytes in attributed mode. A cold cache can return a thin or empty mix.
- `/{username}/repos` reads the attribution cache. It does not walk diffs.
- `/{username}/contributions/breakdown` reports `coverage`, `partial`, `cache_enabled`, `status`, and `message`. Check those first when the split looks empty.

`status` on the breakdown is one of `complete`, `deadline`, `rate_limited`, `cache_disabled`.

Without Redis, nothing accumulates between requests. Set `REDIS_URL`, or `UPSTASH_REDIS_REST_URL` plus `UPSTASH_REDIS_REST_TOKEN`.

Warm the cache:

```bash
python scripts/warm_attribution.py tashifkhan
```

Or hit the breakdown until coverage climbs:

```bash
for i in $(seq 6); do
  curl -s https://github-stats.tashif.codes/tashifkhan/contributions/breakdown \
    | python -c 'import json,sys; d=json.load(sys.stdin); print(d["coverage"], d["status"])'
done
```

Tuning knobs, all optional: `ATTRIBUTION_INLINE_DEADLINE` (3.5s inside a normal request), `ATTRIBUTION_BREAKDOWN_DEADLINE` (8s), `ATTRIBUTION_MAX_COMMITS_PER_REPO` (200), `ATTRIBUTION_MAX_COMMIT_DETAILS` (600), `ATTRIBUTION_RATE_LIMIT_FLOOR` (500 GitHub calls kept in reserve), `ATTRIBUTION_CACHE_TTL_SECONDS` (7 days).

## Canonical summary

- **Method and path.** `GET /{username}`
- **Response.** Envelope. `data.totalSolved` is total commits. `data.totalActiveDays` is days with at least one contribution.

```bash
curl -s https://github-stats.tashif.codes/tashifkhan
```

## Canonical profile

- **Method and path.** `GET /{username}/profile`
- **Response.** Envelope. `data` has `displayName`, `username`, `avatar`, `country` (GitHub location), `company`, `bio`, `websites`, and `social` (`github`, `twitter`, `linkedin`).

## Complete statistics

- **Method and path.** `GET /{username}/stats`
- **Query.** `exclude`, `excluded`, `attributed` (default `true`)
- **Response.** Envelope plus the older flat fields: `topLanguages`, `totalCommits`, `longestStreak`, `currentStreak`, `profile_visitors`, `contributions`. Canonical `data` maps commits to `totalSolved` and languages to `topicAnalysis`.

```bash
curl -s "https://github-stats.tashif.codes/tashifkhan/stats?exclude=HTML,CSS"
```

```json
{
  "status": "success",
  "message": "retrieved",
  "topLanguages": [{"name": "Python", "percentage": 45.0}],
  "totalCommits": 2068,
  "longestStreak": 25,
  "currentStreak": 10,
  "profile_visitors": 1234,
  "contributions": {},
  "platform": "github",
  "username": "tashifkhan",
  "cached": false,
  "data": {
    "totalSolved": 2068,
    "topicAnalysis": [{"topic": "Python", "count": 45}]
  }
}
```

## Stats SVG card

- **Method and path.** `GET /{username}/stats/svg`
- **Query.** `theme` (`dark` default, or `light`), `exclude`, `excluded`, `attributed` (default `true`)
- **Response.** `image/svg+xml`, cached 24 hours via `Cache-Control`. Commits, stars, streaks, language bars.

```bash
curl -s "https://github-stats.tashif.codes/tashifkhan/stats/svg?theme=light&exclude=HTML,CSS" -o stats.svg
```

## Contribution heatmap

- **Method and path.** `GET /{username}/heatmap`
- **Query.** `view` (`all` default, `last_365`, or `year`). `year` is required when `view=year`. Aliases such as `365` and `last365` map to `last_365`. Passing `year` with `view=all` becomes `view=year`.
- **Response.** Envelope. `data` includes `dailyContributions`, streaks, `availableYears`, and window fields (`view`, `year`, `startDate`, `endDate`). Yearly totals always describe full history even when the daily grid is sliced.

Invalid `view` is `400`. `view=year` without `year` is `400`.

## Badges

- **Method and path.** `GET /{username}/badges`
- **Response.** Envelope. GitHub profile achievements: `count`, `active`, `list` of `{id, name, icon, level}`.

## Programming languages

- **Method and path.** `GET /{username}/languages`
- **Query.** `exclude`, `excluded`, `attributed` (default `true`), `include_forks` (default `true`)
- **Response.** JSON array, not the envelope.

```bash
curl -s "https://github-stats.tashif.codes/tashifkhan/languages?exclude=HTML,CSS"
```

```json
[
  {"name": "Python", "percentage": 45.0},
  {"name": "JavaScript", "percentage": 30.0}
]
```

Set `attributed=false` to sum whole-repo language bytes, including other contributors and upstream code in forks.

## Contribution history

- **Method and path.** `GET /{username}/contributions`
- **Query.** `starting_year` (optional integer, defaults to account creation year)
- **Response.** Envelope. Canonical heatmap lives in `data`. The older payload is merged onto the root: `contributions` keyed by year, `totalCommits`, `longestStreak`, `currentStreak`.

```bash
curl -s "https://github-stats.tashif.codes/tashifkhan/contributions?starting_year=2022"
```

## Own-commit contribution breakdown

- **Method and path.** `GET /{username}/contributions/breakdown`
- **Query.** `exclude`, `excluded`, `include_forks` (default `true`)
- **Response.** `ContributionLanguageStats`. Per-repo commits, additions, deletions, files, language mix, and `contribution_percentage`. `method` is `commits`, `estimated`, or `contributor_stats`.

```json
{
  "username": "tashifkhan",
  "languages": [
    {"name": "Python", "percentage": 52.4, "lines": 18420, "files": 210}
  ],
  "total_additions": 35150,
  "total_deletions": 9820,
  "total_commits": 742,
  "files_changed": 1904,
  "repos_analyzed": 24,
  "forks_analyzed": 3,
  "coverage": 0.8,
  "partial": true,
  "status": "deadline",
  "message": "",
  "cache_enabled": true,
  "repositories": []
}
```

## Profile views

- **Method and path.** `GET /{username}/profile-views`
- **Query.** `increment` (default `true`), `base` (optional integer, sets the stored count for migration)
- **Response.** `{ "username", "views", "incremented" }`

```bash
curl -s "https://github-stats.tashif.codes/tashifkhan/profile-views?increment=false"
```

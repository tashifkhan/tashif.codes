# Canonical endpoints

Path param is `username`. Envelope always has `platform: "leetcode"`. Full field list, query params, errors, and a request/response mermaid: [Envelope and schemas](3.1-envelope-and-schemas).

Playground: [leetcode-stats.tashif.codes/playground](https://leetcode-stats.tashif.codes/playground).

HTML on the same app:

```http
GET /
GET /playground
GET /docs
GET /redoc
GET /openapi.json
```

`/` is a custom docs page. `/playground` fires the JSON routes from the browser. `/docs` is Swagger.

## Username routes

| Path | `data` |
| --- | --- |
| `GET /{user}` | Summary |
| `GET /{user}/profile` | Profile |
| `GET /{user}/stats` | Stats (solved + topics) |
| `GET /{user}/stats/svg` | SVG card, not JSON |
| `GET /{user}/contests` | Contests |
| `GET /{user}/rating` | Rating series |
| `GET /{user}/heatmap` | Heatmap |
| `GET /{user}/badges` | Badges |
| `GET /{user}/topics` | Topic bars only (when the platform has them) |

Heatmap window:

```http
GET /{username}/heatmap?view=all
GET /{username}/heatmap?view=last_365
GET /{username}/heatmap?view=year&year=2026
```

Unknown `view`, or `view=year` without `year`, is HTTP `400`.

SVG:

```http
GET /{username}/stats/svg?theme=dark
GET /{username}/stats/svg?theme=light&exclude=Arrays,Strings
```

Returns `image/svg+xml`. `Cache-Control` is 24h. `exclude` drops topic bars.

## Envelope

```json
{
  "status": "success",
  "message": "retrieved",
  "platform": "leetcode",
  "username": "khan-tashif",
  "cached": false,
  "data": {}
}
```

`/{username}` and `/{username}/stats` also flatten the older LeetCode fields next to `data` (`totalSolved`, `easySolved`, `acceptanceRate`, `ranking`, `submissionCalendar`). New clients should read `data`.

## Sample

```http
GET https://leetcode-stats.tashif.codes/khan-tashif
```

```json
{
  "status": "success",
  "platform": "leetcode",
  "username": "khan-tashif",
  "cached": false,
  "data": {
    "totalSolved": 1263,
    "totalActiveDays": 608,
    "totalContests": 57,
    "currentRating": 1745,
    "maxRating": 1803,
    "rank": "Knight",
    "badgesCount": 24
  }
}
```

Numbers above are shape, not a live snapshot.

# Canonical endpoints

Path param is `username`. Envelope `platform` is `"gfg"`. Full schemas: [Envelope and schemas](3.1-envelope-and-schemas). Playground: [gfg-stats.tashif.codes/playground](https://gfg-stats.tashif.codes/playground).

HTML on the same app:

```http
GET /
GET /playground
GET /docs
GET /redoc
GET /openapi.json
```

## Username routes

| Path | `data` |
| --- | --- |
| `GET /{username}` | Summary |
| `GET /{username}/profile` | Profile |
| `GET /{username}/stats` | Stats |
| `GET /{username}/stats/svg` | SVG card |
| `GET /{username}/contests` | Contests (usually empty) |
| `GET /{username}/rating` | Rating (usually empty) |
| `GET /{username}/heatmap` | Heatmap |
| `GET /{username}/badges` | Badges |
| `GET /{username}/topics` | Topic bars |

Heatmap also still accepts the old GFG window names as aliases: `range=all|last365days|year` plus `month`. Prefer `view`.

## Envelope

```json
{
  "status": "success",
  "message": "retrieved",
  "platform": "gfg",
  "username": "tashif_ahmad_khan",
  "cached": false,
  "data": {}
}
```

## Sample

```http
GET https://gfg-stats.tashif.codes/tashif_ahmad_khan
```

Older clients still see flattened `totalProblemsSolved`, `School`, `Basic`, `Easy`, `Medium`, `Hard` next to `data`.

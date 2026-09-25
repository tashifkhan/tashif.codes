# Canonical endpoints

Path param is `username`. Envelope `platform` is `"hackerrank"`. Full schemas: [Envelope and schemas](3.1-envelope-and-schemas). Playground: [hackerrank-stats.tashif.codes/playground](https://hackerrank-stats.tashif.codes/playground).

```http
GET /
GET /playground
GET /docs
GET /redoc
GET /openapi.json
```

| Path | `data` |
| --- | --- |
| `GET /{username}` | Summary |
| `GET /{username}/profile` | Profile |
| `GET /{username}/stats` | Stats |
| `GET /{username}/stats/svg` | SVG card |
| `GET /{username}/contests` | Contests |
| `GET /{username}/rating` | Rating |
| `GET /{username}/heatmap` | Heatmap |
| `GET /{username}/badges` | Badges |
| `GET /{username}/topics` | Topic bars |

No deprecated aliases. Old paths are the canonical ones.

`GET /{username}` still flattens `totalSolved`, `ranking`, `practiceScore`, `reputation`, `submissionCalendar` next to `data`.

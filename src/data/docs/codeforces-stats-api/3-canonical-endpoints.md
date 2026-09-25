# Canonical endpoints

Path param is `userid`. Envelope `platform` is `"codeforces"`. Full schemas: [Envelope and schemas](3.1-envelope-and-schemas). Playground: [codeforces-stats.tashif.codes/playground](https://codeforces-stats.tashif.codes/playground).

```http
GET /
GET /playground
GET /docs
GET /redoc
GET /openapi.json
```

## User routes

| Path | `data` |
| --- | --- |
| `GET /{userid}` | Summary |
| `GET /{userid}/profile` | Profile |
| `GET /{userid}/stats` | Stats |
| `GET /{userid}/stats/svg` | SVG card |
| `GET /{userid}/contests` | Contests |
| `GET /{userid}/rating` | Rating series |
| `GET /{userid}/heatmap` | Heatmap |
| `GET /{userid}/badges` | Badges |
| `GET /{userid}/topics` | Topic bars |

## Legacy helpers still mounted

```http
GET /{userid}/basic
GET /{userid}/solved
GET /multi/{userids}
GET /users/common-contests/{userids}
GET /contests/upcoming
```

`userids` is semicolon-separated (`tourist;Petr`). Commas are accepted and rewritten.

`/contests/upcoming?gym=true` includes gym contests.

These five are `deprecated=True` in OpenAPI. They still return useful data CodeTrace's detail page uses. Canonical card composition should go through `/{userid}/profile` and `/{userid}/contests`.

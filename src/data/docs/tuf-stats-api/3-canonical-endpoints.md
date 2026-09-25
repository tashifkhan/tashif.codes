# Canonical endpoints

Path param is `username`. Envelope `platform` is `"tuf"`. Full schemas: [Envelope and schemas](3.1-envelope-and-schemas). Playground: [tuf-stats.tashif.codes/playground](https://tuf-stats.tashif.codes/playground). Sample [striver/profile](https://tuf-stats.tashif.codes/striver/profile).

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
| `GET /{username}/contests` | Empty canonical contests |
| `GET /{username}/rating` | Empty canonical rating |
| `GET /{username}/heatmap` | Heatmap |
| `GET /{username}/badges` | Badges |

No legacy aliases. Only canonical paths are mounted.

Heatmap:

```http
GET /{username}/heatmap?view=all
GET /{username}/heatmap?view=last_365
GET /{username}/heatmap?view=year&year=2026
```

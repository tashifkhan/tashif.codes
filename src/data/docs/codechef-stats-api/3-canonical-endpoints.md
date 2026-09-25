# Canonical endpoints

Path param is `handle`. Envelope `platform` is `"codechef"`. Full schemas: [Envelope and schemas](3.1-envelope-and-schemas). Playground: [codechef-stats.tashif.codes/playground](https://codechef-stats.tashif.codes/playground).

```http
GET /
GET /playground
GET /dashboard
GET /docs
GET /redoc
```

## Handle routes

| Path | `data` |
| --- | --- |
| `GET /{handle}` | Summary |
| `GET /{handle}/profile` | Profile |
| `GET /{handle}/stats` | Stats |
| `GET /{handle}/stats/svg` | SVG card |
| `GET /{handle}/contests` | Contests |
| `GET /{handle}/rating` | Rating series |
| `GET /{handle}/heatmap` | Heatmap |
| `GET /{handle}/badges` | Badges |
| `GET /{handle}/topics` | Topic bars |

## Deprecated aliases

```http
GET /profile/{handle}
GET /heatmap/{handle}
GET /rating/{handle}
```

Same envelope. OpenAPI marks them deprecated. Prefer `GET /{handle}/profile` and friends.

Heatmap `view` / `year` work on both the new path and `/heatmap/{handle}`.

# Dashboard

Live [playground](https://codechef-stats.tashif.codes/playground), older [dashboard](https://codechef-stats.tashif.codes/dashboard), [OpenAPI](https://codechef-stats.tashif.codes/docs). Sample handle `tourist`.

Three HTML surfaces:

| Path | What |
| --- | --- |
| `GET /` | Custom docs page |
| `GET /playground` | Canonical route tester |
| `GET /dashboard` | Older handle-driven viewer for profile / heatmap / rating |

`/dashboard` predates the playground. It still works. New work should use `/playground`.

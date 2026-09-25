# Platform notes

Official Codeforces API, so handles 404 cleanly. Missing user is HTTP `404` with `detail`, not a fake zeroed stats object.

Heatmap also still understands the old `days` query. Prefer `view`.

Rate-limit this API politely. Codeforces bans noisy IPs. The local limiter is a courtesy, not a substitute.

`rank` is the title (`specialist`, `expert`, …). `globalRanking` may be null.

CORS `*`.

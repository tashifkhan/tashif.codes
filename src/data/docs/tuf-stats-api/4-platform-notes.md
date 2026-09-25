# Platform notes

TUF heatmap upstream rejects years before 2023. Canonical heatmaps fetch 2023 through the current year unless you set `TUF_FIRST_HEATMAP_YEAR`.

`/{username}/contests` and `/{username}/rating` return empty canonical blocks. TUF is a DSA sheet, not a contest platform.

No `/{username}/topics` extra route on TUF. Topics live inside `/stats`.

CORS `*`. Redis optional via `REDIS_URL` or `TUF_REDIS_URL`.

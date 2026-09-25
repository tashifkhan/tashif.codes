# Platform notes

`practiceScore` is the sum of per-track scores. It is not solved-challenge count.

`ranking` is the best rank among tracks with a non-zero practice score. It is not a global profile rank.

Heatmaps are often empty. The public submission-history endpoint returns `{}` for plenty of real accounts. CodeTrace already treats an empty heatmap as "no calendar", not an error.

Contest history is empty for users who never sat a rated contest. That is a `200` with `history: []`.

CORS `*`.

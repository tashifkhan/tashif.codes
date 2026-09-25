# Platform notes

LeetCode has no deprecated aliases. The old paths are the canonical ones.

`GET /{username}/topics` returns only `data` as the topic list, not the full stats object. CodeTrace still uses `/stats` and reads `topicAnalysis` there.

Difficulty keys in `byDifficulty` that LeetCode does not use (`school`, `basic`, `fundamental`) stay `0`.

Missing user: envelope `status: "error"` with a message, not always a 404. Treat `status === "error"` the same as a failed fetch. CodeTrace already does.

Rate limit is this API's IP/handle limiter, not LeetCode's. `429` with `Retry-After`.

CORS is `*`. Call from the browser or from CodeTrace's `/api/leetcode` Vite proxy.

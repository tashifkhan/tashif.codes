# Platform notes

CodeChef is scraped, not an official API. Upstream HTML changes will break fields before they break the envelope. Empty `data` with `status: "error"` is the usual miss.

In-memory TTL cache and per-IP rate limit live even without Redis. Redis still helps across workers on Vercel.

Stars show up as the contest `rank` string (1, 2, … with the star title). `currentRating` is the numeric rating.

Topic analysis is thin compared to LeetCode. Bars may be empty.

CORS `*`.

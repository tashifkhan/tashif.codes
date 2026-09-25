# Platform notes

Deprecated alias:

```http
GET /{username}/solved-problems
```

That path now returns the canonical stats envelope. OpenAPI marks it deprecated.

GFG does not have contests in the Codeforces sense. `/{username}/contests` and `/{username}/rating` exist so CodeTrace can loop the same paths. Expect empty history / null rating rather than a 404.

Difficulty keys `school` and `basic` are real here. LeetCode leaves them at 0.

CORS `*`. Optional Redis via `REDIS_URL`.

# Pages and routes

TanStack Router tree in `src/router.tsx`.

| Path | Page |
| --- | --- |
| `/` | Market / landing. URL builder, API links, demo heatmap. |
| `/app` | Handle form + stacked cards (`HomePage`). |
| `/profile` | Aggregated profile (heatmap, ratings, rings). |
| `/github/$username` | GitHub deep dive |
| `/leetcode/$username` | LeetCode deep dive |
| `/codeforces/$username` | Codeforces deep dive |
| `/gfg/$username` | GFG deep dive |
| `/codechef/$username` | CodeChef deep dive |
| `/hackerrank/$username` | HackerRank deep dive |
| `/tuf/$username` | TUF deep dive |
| `/login` | Google sign-in. `?next=/path` continues after auth. |
| `/account` | Claim username, save config. `/onboarding` is an alias. |
| `/$profileUsername` | Public saved profile. Catch-all, so it sits last. |

## Share URLs

`/app` and `/profile` sync handles with nuqs:

```http
https://codetrace.xyz/profile?github=tashifkhan&leetcode=khan-tashif&codeforces=tourist
```

Empty platforms are omitted. Share copies `window.location.href`. That is the long URL, not the claimed `/$username` unless you already opened that.

## Deep dives vs the stack

Platform cards on `/app` link into `/{platform}/$username`. Those pages still hit the same stats APIs, with extra charts the summary card skips (contest tables, full rating history).

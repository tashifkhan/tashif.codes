# Deep history

Gitea-family heatmap endpoints cap at about 371 days (`contributionsMaxAgeSeconds = 32,054,400`). Native counts **actions** (commits, PRs, issues, comments), not commits. `deep=true` rebuilds the calendar from commit walks. No background job. The request is the refresher.

## When synthesized vs native

Never splice two metrics at the 371-day seam.

| View | Source |
| --- | --- |
| `year`, `last_365` | Always native |
| `view=all` | Synthesized if Redis has a warmed manifest **or** `deep=true`; else native |

Heatmap block extras: `source` (`native` | `synthesized`), `complete`. Without Redis, `HistoryService.refresh` returns empty days and `complete: false`. Set `REDIS_URL` or Upstash REST.

## Walk

Own repos only. Skip `fork` and `mirror`. Need `owner.login`.

Manifest Redis hash `host:{instance}:histman:{username}` keyed by **`repo.id`**, never name. Per entry: `{pushed_at, head_sha, oldest_sha, page, complete}`. Histogram: `host:{instance}:hist:{username}:{repo_id}` TTL `GITHOST_HIST_TTL` (30d).

```text
request → GET /users/{u}/repos
          for each repo, compare pushed_at against the manifest:
            unchanged  → reuse cached day histogram
            changed    → walk newest-first, stop at manifest.head_sha
            new repo   → full walk once
            gone repo  → drop its entry
          merge histograms → respond → write back manifest
```

Commits listing has no author/since/until on this swagger. Filter here. Identity (`_matches_identity`): forge `commit.author.login` equals username, or git author email in `?emails=`, or email local-part **equals** username. Display-name match and "local-part contains" from the plan were not shipped. Merge commits are not skipped.

Outcomes per repo: `append`, `replace`, `invalidate` (rewalk if >0.5s left), `incomplete` (bookmark `page`, `complete: false`).

Caps: `GITHOST_HISTORY_MAX_PAGES` default 40 per repo. `GITHOST_REQUEST_DEADLINE` default 3.5s wall clock. Remaining ≤ 0 → reuse cached hist for later repos.

## Honesty costs

| Issue | Reality |
| --- | --- |
| Unit | Native = events. Deep = commits. When deep data exists, the whole `view=all` calendar is commits. |
| Coverage | Owned default-branch history. Issues/PRs on other people's repos are missing vs native. |
| Identity | Unknown emails drop commits. Common names can overcount. |
| Branches | Default branch listing only. |

Force push: stop-at-SHA never fires; if the walk passes the page cap without seeing the cached head, that repo is invalidated. Feature-branch push bumps `pushed_at` but a default-branch walk finds nothing new (one wasted page).

Full writeup: [dump 038](https://dump.taf.sh/d/038_githoststats-one-api-every-git-host-plan/).

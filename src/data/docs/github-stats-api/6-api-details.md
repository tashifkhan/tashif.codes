# API endpoints: dashboard details

Repos, stars, pins, starred lists, and commits. These are the heavier JSON lists. Tag in OpenAPI is Dashboard Details except where noted.

## Repository details

Public repos with README, languages, topics, and optional attribution fields.

- **Method and path.** `GET /{username}/repos`
- **Query.** `attributed` (default `true`), `full` (default `false`)
- **Response.** `RepoDetail[]`

Default is the lite path: README, languages, contributors, and the first page of releases with notes and assets. That finishes inside a serverless time budget and can warm Redis. `full=true` adds commit counts.

README for a conventional `README.md` comes from GitHub's raw CDN. The rate-limited Contents API is the fallback for other names and casing. The field is decoded Markdown, not base64.

With `attributed=true`, each repo may include `user_commits`, `user_additions`, `user_deletions`, `user_files_changed`, `user_languages`, and `contribution_percentage`. Those values are cache-only. They stay zero until `/{username}/contributions/breakdown` or `scripts/warm_attribution.py` has measured the repo.

```bash
curl -s "https://github-stats.tashif.codes/tashifkhan/repos?full=true"
```

```json
[
  {
    "title": "RepoName",
    "description": "A cool project.",
    "live_website_url": "https://example.com",
    "languages": ["Python", "JavaScript"],
    "topics": ["fastapi", "api", "dashboard"],
    "num_commits": 42,
    "stars": 25,
    "readme": "# RepoName\n\nProject documentation in Markdown.",
    "is_fork": false,
    "user_commits": 40,
    "user_additions": 1200,
    "user_deletions": 80,
    "user_files_changed": 30,
    "user_languages": [],
    "contribution_percentage": 95.0,
    "releases": [
      {
        "id": 123456,
        "tag_name": "v1.2.0",
        "name": "v1.2.0",
        "body": "## Changelog\n\n- Added release support",
        "url": "https://github.com/user/RepoName/releases/tag/v1.2.0",
        "draft": false,
        "prerelease": false,
        "created_at": "2024-01-01T00:00:00Z",
        "published_at": "2024-01-01T01:00:00Z",
        "assets": [
          {
            "name": "RepoName-v1.2.0.zip",
            "download_url": "https://github.com/user/RepoName/releases/download/v1.2.0/RepoName-v1.2.0.zip",
            "size": 102400,
            "download_count": 250,
            "content_type": "application/zip",
            "updated_at": "2024-01-01T01:05:00Z"
          }
        ]
      }
    ],
    "releases_page": {
      "total_count": 12,
      "page": 1,
      "per_page": 10,
      "has_more": true,
      "next": "/tashifkhan/repos/RepoName/releases?page=2&per_page=10"
    }
  }
]
```

Missing user is `404`. Other GitHub failures from this handler can be `500`.

### Releases are paginated

`releases` holds the newest 10 releases of each repo, not all of them. A repo with 12 releases returns 10 here, and the other 2 are on page 2. Check `releases_page` before you assume you have the full list:

| Field | Meaning |
| --- | --- |
| `total_count` | Every release the repo has. `null` if GitHub's count lookup failed. |
| `page` | Always `1` in `/repos`. |
| `per_page` | Releases per page. `10` in `/repos`. |
| `has_more` | `true` when a later page exists. |
| `next` | Path of the next page on this API, or `null` on the last page. |

`releases_page` is `null` when release data was unavailable, for example on a skeleton row from a timed-out request.

To get every release, request `next` against the API host and keep following each response's `releases_page.next` until it is `null`:

```ts
async function allReleases(repo) {
  const releases = [...repo.releases];
  let next = repo.releases_page?.next;
  while (next) {
    const page = await fetch(`https://github-stats.tashif.codes${next}`).then((r) => r.json());
    releases.push(...page.releases);
    next = page.releases_page.next;
  }
  return releases;
}
```

Keep the `per_page` that `next` carries. Changing the page size halfway shifts the page boundaries and you skip or repeat releases.

## Repository releases

One page of a repo's releases, newest first. Use it for the pages `/repos` does not embed.

- **Method and path.** `GET /{owner}/repos/{repo}/releases`
- **Query.** `page` (default `1`), `per_page` (default `10`, max `100`)
- **Response.** `RepoReleases`: `owner`, `repo`, `releases`, and the same `releases_page` object as above.

```bash
curl -s "https://github-stats.tashif.codes/tashifkhan/repos/Patchwork/releases?page=2&per_page=10"
```

```json
{
  "owner": "tashifkhan",
  "repo": "Patchwork",
  "releases": [
    { "tag_name": "v1.1.0", "body": "...", "assets": [] },
    { "tag_name": "v1.0.0", "body": "...", "assets": [] }
  ],
  "releases_page": {
    "total_count": 12,
    "page": 2,
    "per_page": 10,
    "has_more": false,
    "next": null
  }
}
```

If you want everything in one request and the repo has 100 releases or fewer, ask for `?per_page=100`. `has_more` tells you whether that was enough.

A missing repo is `404`. A failed GitHub request is `502`. `per_page` above 100 is `422`. Pages are cached in Redis like `/repos`.

## Stars

Star totals and owned repos sorted by star count.

- **Method and path.** `GET /{username}/stars`
- **Response.** `StarsData`

```json
{
  "total_stars": 150,
  "repositories": [
    {
      "name": "RepoName",
      "description": "A popular project",
      "stars": 100,
      "url": "https://github.com/user/repo",
      "language": "Python",
      "created_at": "2023-01-01T00:00:00Z",
      "updated_at": "2023-12-01T00:00:00Z"
    }
  ]
}
```

## Pinned repositories

Pins via GitHub GraphQL, up to six.

- **Method and path.** `GET /{username}/pinned`
- **Query.** `first` (default `6`, min `1`, max `6`)
- **Response.** Array of `{name, description, url, stars, forks, primary_language}`

```bash
curl -s "https://github-stats.tashif.codes/tashifkhan/pinned?first=6"
```

## Starred lists

Public Starred Lists the user created.

- **Method and path.** `GET /{username}/star-lists`
- **Query.** `include_repos` (default `true`). When true, each list includes `owner/repo` slugs.
- **Response.** Array of `{name, url, repositories, description, num_repos}`

```json
[
  {
    "name": "AI Projects",
    "url": "https://github.com/stars/username/lists/ai-projects",
    "repositories": ["pytorch/pytorch", "huggingface/transformers"]
  }
]
```

Empty or missing lists return `[]`. A 404 from GitHub is raised as `404` with `User not found or API error`.

## Commit history

Commits across owned repositories, newest first.

- **Method and path.** `GET /{username}/commits`
- **Response.** `CommitDetail[]`

```json
[
  {
    "repo": "RepoName",
    "message": "Fix: A critical bug",
    "timestamp": "2023-01-01T12:00:00Z",
    "sha": "commit_sha_hash",
    "url": "https://github.com/user/repo/commit/sha"
  }
]
```

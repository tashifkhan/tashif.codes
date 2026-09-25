# API endpoints: dashboard details

Repos, stars, pins, starred lists, and commits. These are the heavier JSON lists. Tag in OpenAPI is Dashboard Details except where noted.

## Repository details

Public repos with README, languages, topics, and optional attribution fields.

- **Method and path.** `GET /{username}/repos`
- **Query.** `attributed` (default `true`), `full` (default `false`)
- **Response.** `RepoDetail[]`

Default is the lite path: README, languages, contributors. That finishes inside a serverless time budget and can warm Redis. `full=true` adds release notes, assets, and commit counts.

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
    ]
  }
]
```

Missing user is `404`. Other GitHub failures from this handler can be `500`.

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

# API endpoints: pull requests and organizations

Three routes in `routes/pr.py`. They return arrays of Pydantic models, not the canonical envelope. Tag in OpenAPI is Dashboard Details.

## Pull requests in owned repos

PRs the user opened in repositories they own.

- **Method and path.** `GET /{username}/me/pulls`
- **Response.** `PullRequestDetail[]`. Failure to fetch is `500` with `Failed to retrieve pull requests`.

```bash
curl -s https://github-stats.tashif.codes/tashifkhan/me/pulls
```

```json
[
  {
    "repo": "RepoName",
    "number": 123,
    "title": "Fix bug in feature X",
    "state": "merged",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-02T00:00:00Z",
    "closed_at": "2024-01-02T00:00:00Z",
    "merged_at": "2024-01-02T00:00:00Z",
    "user": "tashifkhan",
    "url": "https://github.com/tashifkhan/RepoName/pull/123",
    "body": "This PR fixes ..."
  }
]
```

`state` follows GitHub: open, closed, or merged when `merged_at` is set.

## Organizations contributed to

Orgs where the user has a merged PR, plus the repo names those PRs landed in.

- **Method and path.** `GET /{username}/org-contributions`
- **Response.** `OrganizationContribution[]`

```json
[
  {
    "org": "openai",
    "org_id": 1,
    "org_url": "https://github.com/openai",
    "org_avatar_url": "https://avatars.githubusercontent.com/u/1",
    "repos": ["repo1", "repo2"]
  }
]
```

## Pull requests in other repositories

PRs the user opened in repos they do not own.

- **Method and path.** `GET /{username}/prs`
- **Response.** `PullRequestDetail[]`, same shape as `/{username}/me/pulls`.

```json
[
  {
    "repo": "OtherRepo",
    "number": 456,
    "title": "Add new feature",
    "state": "closed",
    "created_at": "2024-03-01T00:00:00Z",
    "updated_at": "2024-03-04T00:00:00Z",
    "closed_at": "2024-03-04T00:00:00Z",
    "merged_at": null,
    "user": "tashifkhan",
    "url": "https://github.com/someone/OtherRepo/pull/456",
    "body": null
  }
]
```

# API endpoints: dashboard details

Detailed metadata endpoints for repositories, stars, pins, and commits.

---

## 1. get user's repository details

Retrieves detailed info for each public repository, including README content.

- **Endpoint**: `GET /{username}/repos`
- **Description**: Includes Base64 encoded README, language list, and commit counts.

### Response

```json
[
	{
		"title": "RepoName",
		"description": "...",
		"languages": ["Python", "JavaScript"],
		"num_commits": 42,
		"stars": 25,
		"readme": "BASE64_ENCODED_README"
	}
]
```

---

## 2. get user's stars information

Retrieves stars stats and detailed repository info sorted by star count.

- **Endpoint**: `GET /{username}/stars`

### Response

```json
{
	"total_stars": 150,
	"repositories": [
		{
			"name": "RepoName",
			"stars": 100,
			"language": "Python"
		}
	]
}
```

---

## 3. get user's pinned repositories

Retrieves a user's pinned repositories via the GraphQL API.

- **Endpoint**: `GET /{username}/pinned`
- **Query Parameters**:
  - `first` (Optional, default: 6): Number of pins to fetch (1-6).

---

## 4. get user's starred lists

Retrieves public Starred Lists created by a user.

- **Endpoint**: `GET /{username}/star-lists`
- **Query Parameters**:
  - `include_repos` (Optional, default: `false`): Whether to include the list of repository slugs.

---

## 5. get user's commit history

Retrieves all commits made by the user across all owned repositories.

- **Endpoint**: `GET /{username}/commits`
- **Description**: Sorted by timestamp (most recent first).

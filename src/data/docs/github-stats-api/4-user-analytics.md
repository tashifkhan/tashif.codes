# API endpoints: user analytics

Endpoints for retrieving statistics, language data, and contribution history for specific GitHub users.

---

## 1. get user's programming languages

Retrieves the programming languages used in a user's repositories.

- **Endpoint**: `GET /{username}/languages`
- **Query Parameters**:
  - `exclude` (Optional): Comma-separated list of languages to exclude (e.g., `Markdown,JSON,HTML`).

### Example request

```bash
GET /tashifkhan/languages?exclude=HTML,CSS
```

### Response

```json
[
	{
		"name": "Python",
		"percentage": 45.0
	},
	{
		"name": "JavaScript",
		"percentage": 30.0
	}
]
```

---

## 2. get user's contribution history

Retrieves GitHub contribution history and statistics.

- **Endpoint**: `GET /{username}/contributions`
- **Query Parameters**:
  - `starting_year` (Optional): Starting year for history (defaults to account creation year).

### Example request

```bash
GET /tashifkhan/contributions?starting_year=2022
```

### Response

Includes a year-by-year breakdown of contribution data.

```json
{
    "contributions": {
        "2023": { ... }
    },
    "totalCommits": 1234,
    "longestStreak": 30,
    "currentStreak": 15
}
```

---

## 3. get user's complete statistics

Detailed statistics combining languages, streaks, and contribution counts.

- **Endpoint**: `GET /{username}/stats`
- **Query Parameters**:
  - `exclude` (Optional): Comma-separated list of languages to exclude.

### Response

```json
{
    "status": "success",
    "message": "retrieved",
    "topLanguages": [...],
    "totalCommits": 1234,
    "longestStreak": 30,
    "currentStreak": 15,
    "profile_visitors": 567,
    "contributions": { ... }
}
```

---

## 4. get and increment profile views

Tracks and increments profile view counts.

- **Endpoint**: `GET /{username}/profile-views`
- **Query Parameters**:
  - `increment` (Optional, default: `true`): Whether to increment the count.
  - `base` (Optional): Set a base count (useful for migration).

### Response

```json
{
	"username": "tashifkhan",
	"views": 1234,
	"incremented": true
}
```

# Canonical endpoints

No live hostname. Local `http://127.0.0.1:8008/playground`. Full schemas: [Envelope and schemas](3.1-envelope-and-schemas).

```http
GET /
GET /playground
GET /docs
GET /redoc
```

## Query-selected

```http
GET /{username}?host=codeberg
GET /{username}/profile?host=codeberg
GET /{username}/stats?host=codeberg&exclude=Markdown,SVG
GET /{username}/stats/svg?host=codeberg&theme=dark
GET /{username}/heatmap?host=codeberg&view=last_365
GET /{username}/heatmap?host=codeberg&view=year&year=2026&deep=true
GET /{username}/badges?host=codeberg
GET /{username}/repos?host=codeberg
GET /{username}/orgs?host=codeberg
```

`deep=true` on summary/stats/heatmap runs or continues the commit walk. See [Deep history](4-deep-history).

## Embed prefix

Same sections under `/f/{host}/{username}/...`. Hidden from OpenAPI (`include_in_schema=False`) so Swagger stays on the query form.

Orgs may come back `restricted` without a token for that instance.

Envelope extras:

```json
{
  "status": "success",
  "platform": "forgejo",
  "username": "tashifkhan",
  "instance": "codeberg",
  "software": { "name": "forgejo", "version": "11.0.0" },
  "cached": false,
  "data": {}
}
```

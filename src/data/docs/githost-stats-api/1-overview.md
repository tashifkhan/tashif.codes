# GitHost stats API

Same envelope as the GitHub stats API, pointed at Forgejo / Gitea / Codeberg / any Gitea-compatible host. Source is [tashifkhan/GitHost-Stats-API](https://github.com/tashifkhan/GitHost-Stats-API). Design notes: [dump 038](https://dump.taf.sh/d/038_githoststats-one-api-every-git-host-plan/).

There is no `githost-stats.tashif.codes` hostname yet. Run it yourself. Default local port is 8008. Local [playground](http://127.0.0.1:8008/playground). Sample `/taf/profile?host=git.taf.sh`.

CodeTrace does not call this today. The dashboard still talks to `github-stats.tashif.codes` for GitHub.com.

## Docs map

- [Overview](1-overview)
- [Targeting a host](2-host-targeting)
- [Canonical endpoints](3-canonical-endpoints)
- [Envelope and schemas](3.1-envelope-and-schemas)
- [Deep history](4-deep-history)
- [Architecture](5-architecture)
- [Why not GitHub's API](5.1-why-not-github-api)
- [SSRF and registry](5.2-ssrf-and-registry)
- [Request path](5.3-request-path)

## What it returns

Summary, profile, language stats, heatmap, derived badges, repos, orgs. Envelope adds `instance` (registry key or hostname) and `software` (`{name, version}`). `platform` is `"forgejo"` or `"gitea"` from a live version probe, not a hardcoded string.

Requests without an explicit host are rejected. There is no implicit "first registry entry".

## Run it locally

```bash
cd GitHost
uv sync
cp .env.example .env
uv run uvicorn main:app --reload --port 8008
```

Default registry:

```
taf=https://git.taf.sh,codeberg=https://codeberg.org,gitea=https://gitea.com
```

Override with `GITHOST_INSTANCES`. Optional tokens and Redis live in `.env`.

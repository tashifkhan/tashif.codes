# Targeting a host

Every username route needs a target. Three ways:

1. `?host=taf` (or `codeberg`, `gitea`, any key in `GITHOST_INSTANCES`)
2. `?base_url=https://git.example.com` (SSRF-guarded; private IPs blocked unless `GITHOST_BLOCK_PRIVATE_IPS=false`)
3. Prefix `/f/{host}/{username}/...` for README embeds that cannot use query strings

```http
GET /tashifkhan/profile?host=codeberg
GET /tashifkhan/stats?base_url=https://git.taf.sh
GET /f/codeberg/tashifkhan/stats/svg?theme=dark
```

Missing host is an error, not "guess Codeberg".

`GITHOST_ALLOW_CUSTOM_BASE=false` disables `base_url`. Keep `GITHOST_BLOCK_PRIVATE_IPS=true` unless this process itself sits on a tailnet and must reach LAN forges.

`?emails=` adds extra commit emails for identity matching on the deep heatmap walk.

"""Export Vercel request history for my public APIs into data/<target>.json.

Targets: stats-apis (the seven *-stats.tashif.codes APIs, the default),
delhi-metro-api and blr-metro-api. The metro targets count only /api/* calls,
since their Vercel projects also serve docs pages and, for Bangalore, the web app.

Reads Vercel request metrics through the Vercel CLI (`vercel login` first) and writes
the same shape as the other migration files, so the stats page treats it like any
other project's history:

- timeseries: pageviews are requests, visitors are distinct client IPs that day
- path: requests per API (LeetCode, GitHub, ...), or per endpoint for the metro APIs
- referrer: the site that made the call; "(no referrer)" for direct calls
- country: the client's country
- rows: requests per day for each (path, referrer, country) combination, so the
  stats page can apply several filters at once and still fill every breakdown.
  Visitors in rows are distinct IPs per combination, so summing them across
  combinations overcounts people who hit several.

Vercel buckets by UTC day, and daily breakdowns fail for anything older than
about 30 days, so each run covers the last 30.
Each UTC day is stored under that calendar date, stamped at IST midnight like the
other exports.

    uv run python scripts/export_stats_apis.py            # last 30 days
    uv run python scripts/export_stats_apis.py --target delhi-metro-api
    uv run python scripts/export_stats_apis.py --raw raw.json  # reuse a saved pull
"""

import argparse
import json
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

STATS_PROJECTS = {
    "leet-code-stats-api": "LeetCode",
    "git-hub-stats-api": "GitHub",
    "gfg-stats-api": "GFG",
    "tuf-stats-api": "TUF",
    "hackerrank-stats-api": "HackerRank",
    "codechef-stats-api": "CodeChef",
    "code-forces-api": "Codeforces",
}
# projects: Vercel project names. path: the dimension behind the "path" breakdown.
# only: an extra KQL filter.
TARGETS = {
    "stats-apis": {"projects": STATS_PROJECTS, "path": "projectName", "only": None},
    "delhi-metro-api": {"projects": {"dmrc-rest-api": "Delhi NCR Metro API"}, "path": "requestPath", "only": "requestPath:/api/*"},
    "blr-metro-api": {"projects": {"blr-metro": "Namma Metro API"}, "path": "requestPath", "only": "requestPath:/api/*"},
}
METRICS = {
    "req": {"metric": "vercel.request.count", "aggregation": "count"},
    "ips": {"metric": "vercel.request.count", "aggregation": "unique", "dimensions": ["clientIp"]},
}
IST = timezone(timedelta(hours=5, minutes=30))
DATA = Path(__file__).resolve().parent.parent / "data"


def target_filter(target: dict) -> str:
    projects = " OR ".join(f"projectName:{p}" for p in target["projects"])
    only = f" AND {target['only']}" if target["only"] else ""
    return f"environment:production AND ({projects}){only}"


def kinds(target: dict) -> dict:
    return {"total": None, "api": target["path"], "referrer": "referrerHostname", "country": "clientIpCountry"}


def query(dimension: str | list[str] | None, start: date, end: date, filter_: str) -> dict:
    body = {"metrics": METRICS, "outputs": ["req", "ips"], "bucketSeconds": 86400, "filter": filter_}
    if dimension:
        body["groupBy"] = dimension if isinstance(dimension, list) else [dimension]
        body["seriesSelection"] = {"limit": 500, "rankBy": [{"metric": "req", "direction": "desc"}]}
    command = ["npx", "-y", "vercel@latest", "metrics", "--all", "--json", "--data", "-",
               "-s", f"{start}T00:00:00Z", "-u", f"{end}T00:00:00Z"]
    for attempt in range(4):
        result = subprocess.run(command, input=json.dumps(body), capture_output=True, text=True, timeout=400)
        try:
            payload = json.loads(result.stdout)
        except ValueError:
            payload = {}
        if "data" in payload:
            return payload
        print(f"retrying {dimension} {start}: {payload.get('error') or result.stderr[-200:]}", file=sys.stderr)
        time.sleep(5 * (attempt + 1))
    raise SystemExit(f"Vercel metrics query failed for {dimension} {start}")


def pull(days: int, target: dict) -> dict:
    end = datetime.now(timezone.utc).date()  # today is partial, so it's excluded
    start = end - timedelta(days=days)
    raw = {}
    for kind, dimension in kinds(target).items():
        cursor = start
        while cursor < end:
            stop = min(cursor + timedelta(days=7), end)  # longer windows time out
            raw[f"{kind}_{cursor}"] = query(dimension, cursor, stop, target_filter(target))
            cursor = stop
    raw.update(pull_cube(start, end, target))
    return raw


def pull_cube(start: date, end: date, target: dict) -> dict:
    """One query per project per day: Vercel returns at most 500 combinations a query."""
    dims = [target["path"], "referrerHostname", "clientIpCountry"]
    jobs = [(project, start + timedelta(days=i)) for project in target["projects"] for i in range((end - start).days)]

    def run(job):
        project, day = job
        only = f" AND {target['only']}" if target["only"] else ""
        payload = query(dims, day, day + timedelta(days=1), f"environment:production AND projectName:{project}{only}")
        if len(payload.get("summary", [])) >= 500:
            print(f"warning: {project} {day} hit the 500 combination cap; rows are incomplete", file=sys.stderr)
        return f"cube_{project}_{day}", payload

    with ThreadPoolExecutor(max_workers=6) as pool:
        return dict(pool.map(run, jobs))


def stamp(day: date) -> str:
    return datetime.combine(day, datetime.min.time(), IST).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def rows(raw: dict, kind: str):
    seen = set()
    for key, payload in raw.items():
        if key.split("_", 1)[0] != kind:  # "api_referrer_..." is not "api"
            continue
        for row in payload["data"]:
            day = datetime.fromisoformat(row["timestamp"].replace("Z", "+00:00")).date()
            ident = (day, row.get("projectName"), row.get("requestPath"), row.get("referrerHostname"),
                     row.get("clientIpCountry"))
            if ident in seen:  # windows can share a boundary bucket
                continue
            seen.add(ident)
            yield day, row


def build(raw: dict, last_day: date, target: dict) -> dict:
    timeseries = [
        {"date": stamp(day), "pageviews": row["req"], "visitors": row["ips"], "bounce_rate": 0,
         "migration_date": day.isoformat()}
        for day, row in sorted(rows(raw, "total"), key=lambda r: r[0])
        if day <= last_day and row["req"]
    ]

    def entries(kind: str, field: str, label) -> list[dict]:
        out = []
        for day, row in rows(raw, kind):
            if day > last_day or not row["req"]:
                continue
            out.append({"key": label(row.get(field) or ""), "pageviews": row["req"], "visitors": row["ips"],
                        "migration_date": day.isoformat()})
        return sorted(out, key=lambda e: (e["migration_date"], -e["pageviews"]))

    def path_label(v):
        return target["projects"].get(v, v)

    def referrer_label(v):
        return v.lower().removeprefix("www.") or "(no referrer)"

    def country_label(v):
        return v or "Unknown"

    combos = [
        {"date": day.isoformat(), "path": path_label(row.get(target["path"]) or ""),
         "referrer": referrer_label(row.get("referrerHostname") or ""),
         "country": country_label(row.get("clientIpCountry") or ""),
         "pageviews": row["req"], "visitors": row["ips"]}
        for day, row in rows(raw, "cube")
        if day <= last_day and row["req"]
    ]

    return {
        "metadata": {
            "export_date": datetime.now(timezone.utc).isoformat(),
            "source": "vercel_request_metrics",
        },
        "timeseries": timeseries,
        "stats": {
            "path": entries("api", target["path"], path_label),
            "referrer": entries("referrer", "referrerHostname", referrer_label),
            "country": entries("country", "clientIpCountry", country_label),
            "device_type": [],
            "os_name": [],
        },
        "rows": sorted(combos, key=lambda r: (r["date"], -r["pageviews"])),
    }


def keep_older_history(data: dict, out: Path) -> dict:
    """Carry over days from the existing file that are older than this pull.

    Vercel only serves about 30 days of daily data, so each run would otherwise
    drop the oldest history.
    """
    if not out.exists() or not data["timeseries"]:
        return data
    first = data["timeseries"][0]["migration_date"]
    old = json.loads(out.read_text())
    data["timeseries"] = [e for e in old["timeseries"] if e["migration_date"] < first] + data["timeseries"]
    for field, entries in data["stats"].items():
        older = [e for e in old["stats"].get(field, []) if (e.get("migration_date") or "") < first]
        data["stats"][field] = older + entries
    data["rows"] = [r for r in old.get("rows", []) if r["date"] < first] + data["rows"]
    return data


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--target", choices=TARGETS, default="stats-apis", help="which API to export")
    parser.add_argument("--days", type=int, default=30, help="days of history (older daily data fails on Vercel)")
    parser.add_argument("--raw", type=Path, help="build from a saved pull instead of querying Vercel")
    parser.add_argument("--save-raw", type=Path, help="also save the raw Vercel responses here")
    parser.add_argument("--until", type=date.fromisoformat, help="last UTC day to include (default: yesterday)")
    args = parser.parse_args()

    target = TARGETS[args.target]
    out = DATA / f"{args.target}.json"
    raw = json.loads(args.raw.read_text()) if args.raw else pull(args.days, target)
    if args.save_raw:
        args.save_raw.write_text(json.dumps(raw))
    last_day = args.until or datetime.now(timezone.utc).date() - timedelta(days=1)
    data = keep_older_history(build(raw, last_day, target), out)
    out.write_text(json.dumps(data, indent=1) + "\n")
    total = sum(e["pageviews"] for e in data["timeseries"])
    print(f"wrote {out.name}: {len(data['timeseries'])} days, {total:,} requests, "
          f"{len({e['key'] for e in data['stats']['referrer']})} calling sites")


if __name__ == "__main__":
    main()

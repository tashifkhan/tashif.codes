"""Export request history for the seven *-stats.tashif.codes APIs into data/stats-apis.json.

Reads Vercel request metrics through the Vercel CLI (`vercel login` first) and writes
the same shape as the other migration files, so the stats page treats it like any
other project's history:

- timeseries: pageviews are requests, visitors are distinct client IPs that day
- path: requests per API (LeetCode, GitHub, ...)
- referrer: the site that made the call; "(no referrer)" for direct calls
- country: the client's country

Vercel buckets by UTC day, and daily breakdowns fail for anything older than
about 30 days, so each run covers the last 30.
Each UTC day is stored under that calendar date, stamped at IST midnight like the
other exports.

    uv run python scripts/export_stats_apis.py            # last 30 days
    uv run python scripts/export_stats_apis.py --raw raw.json  # reuse a saved pull
"""

import argparse
import json
import subprocess
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

PROJECTS = {
    "leet-code-stats-api": "LeetCode",
    "git-hub-stats-api": "GitHub",
    "gfg-stats-api": "GFG",
    "tuf-stats-api": "TUF",
    "hackerrank-stats-api": "HackerRank",
    "codechef-stats-api": "CodeChef",
    "code-forces-api": "Codeforces",
}
FILTER = "environment:production AND (" + " OR ".join(f"projectName:{p}" for p in PROJECTS) + ")"
METRICS = {
    "req": {"metric": "vercel.request.count", "aggregation": "count"},
    "ips": {"metric": "vercel.request.count", "aggregation": "unique", "dimensions": ["clientIp"]},
}
KINDS = {"total": None, "api": "projectName", "referrer": "referrerHostname", "country": "clientIpCountry"}
IST = timezone(timedelta(hours=5, minutes=30))
OUT = Path(__file__).resolve().parent.parent / "data" / "stats-apis.json"


def query(dimension: str | None, start: date, end: date) -> dict:
    body = {"metrics": METRICS, "outputs": ["req", "ips"], "bucketSeconds": 86400, "filter": FILTER}
    if dimension:
        body["groupBy"] = [dimension]
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


def pull(days: int) -> dict:
    end = datetime.now(timezone.utc).date()  # today is partial, so it's excluded
    start = end - timedelta(days=days)
    raw = {}
    for kind, dimension in KINDS.items():
        cursor = start
        while cursor < end:
            stop = min(cursor + timedelta(days=7), end)  # longer windows time out
            raw[f"{kind}_{cursor}"] = query(dimension, cursor, stop)
            cursor = stop
    return raw


def stamp(day: date) -> str:
    return datetime.combine(day, datetime.min.time(), IST).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def rows(raw: dict, kind: str):
    seen = set()
    for key, payload in raw.items():
        if key.rsplit("_", 1)[0] != kind:  # "api_referrer_..." is not "api"
            continue
        for row in payload["data"]:
            day = datetime.fromisoformat(row["timestamp"].replace("Z", "+00:00")).date()
            ident = (day, row.get("projectName"), row.get("referrerHostname"), row.get("clientIpCountry"))
            if ident in seen:  # windows can share a boundary bucket
                continue
            seen.add(ident)
            yield day, row


def build(raw: dict, last_day: date) -> dict:
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

    return {
        "metadata": {
            "export_date": datetime.now(timezone.utc).isoformat(),
            "source": "vercel_request_metrics",
        },
        "timeseries": timeseries,
        "stats": {
            "path": entries("api", "projectName", lambda v: PROJECTS.get(v, v)),
            "referrer": entries("referrer", "referrerHostname", lambda v: v.lower().removeprefix("www.") or "(no referrer)"),
            "country": entries("country", "clientIpCountry", lambda v: v or "Unknown"),
            "device_type": [],
            "os_name": [],
        },
    }


def keep_older_history(data: dict) -> dict:
    """Carry over days from the existing file that are older than this pull.

    Vercel only serves about 30 days of daily data, so each run would otherwise
    drop the oldest history.
    """
    if not OUT.exists() or not data["timeseries"]:
        return data
    first = data["timeseries"][0]["migration_date"]
    old = json.loads(OUT.read_text())
    data["timeseries"] = [e for e in old["timeseries"] if e["migration_date"] < first] + data["timeseries"]
    for field, entries in data["stats"].items():
        older = [e for e in old["stats"].get(field, []) if (e.get("migration_date") or "") < first]
        data["stats"][field] = older + entries
    return data


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--days", type=int, default=30, help="days of history (older daily data fails on Vercel)")
    parser.add_argument("--raw", type=Path, help="build from a saved pull instead of querying Vercel")
    parser.add_argument("--save-raw", type=Path, help="also save the raw Vercel responses here")
    parser.add_argument("--until", type=date.fromisoformat, help="last UTC day to include (default: yesterday)")
    args = parser.parse_args()

    raw = json.loads(args.raw.read_text()) if args.raw else pull(args.days)
    if args.save_raw:
        args.save_raw.write_text(json.dumps(raw))
    last_day = args.until or datetime.now(timezone.utc).date() - timedelta(days=1)
    data = keep_older_history(build(raw, last_day))
    OUT.write_text(json.dumps(data, indent=1) + "\n")
    total = sum(e["pageviews"] for e in data["timeseries"])
    print(f"wrote {OUT.name}: {len(data['timeseries'])} days, {total:,} requests, "
          f"{len({e['key'] for e in data['stats']['referrer']})} calling sites")


if __name__ == "__main__":
    main()

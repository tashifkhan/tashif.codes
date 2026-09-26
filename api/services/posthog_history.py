"""
Long-range PostHog stats built from calendar-quarter windows.

A single 912-day breakdown can run past PostHog's own gateway timeout (504).
Quarters keep each query small, one per quarter (see query_window), and a
quarter that has ended never changes, so its results are saved and later
refreshes only query the current quarter.

Visitors are summed across quarters, the same way merge_stat_lists sums them
across Vercel and PostHog data, so someone who visits in two quarters counts
twice in the breakdowns.
"""

import hashlib
import json
import logging
from datetime import date, datetime, timedelta, timezone

from models import StatEntry, TimeseriesEntry
from services import snapshots
from services.merger import merge_stat_lists
from services.parallel import gather_queries
from services.posthog import PH_FIELDS, query_window

logger = logging.getLogger(__name__)
PREFIX = "posthog-quarter:v1:"
QUARTER_TTL = 30 * 86400
WINDOW_LIMIT = 100  # Rows kept per quarter so the merged top 15 stays accurate.
BREAKDOWN_LIMIT = 15
_memory: dict[str, dict] = {}


def quarter_start(day: date) -> date:
    return date(day.year, 3 * ((day.month - 1) // 3) + 1, 1)


def next_quarter(day: date) -> date:
    start = quarter_start(day)
    return date(start.year + (start.month == 10), (start.month + 2) % 12 + 1, 1)


def windows(days: int, today: date, align: bool = False) -> list[tuple[date, date]]:
    """Split [today - days, tomorrow) at quarter boundaries.

    With align, start at the beginning of that first quarter so it is whole
    and can be cached too.
    """
    start = today - timedelta(days=days)
    if align:
        start = quarter_start(start)
    end = today + timedelta(days=1)
    result = []
    while start < end:
        stop = min(next_quarter(start), end)
        result.append((start, stop))
        start = stop
    return result


def _bounds(start: date, end: date | None) -> str:
    # PostHog reads these in the project's timezone, so the current window
    # has no upper bound or it would cut off the end of today there.
    bounds = f"timestamp >= toDateTime('{start.isoformat()} 00:00:00')"
    if end is not None:
        bounds += f" AND timestamp < toDateTime('{end.isoformat()} 00:00:00')"
    return bounds


async def _fetch_window(project_id: str, start: date, end: date | None, where: str) -> dict:
    return await query_window(project_id, _bounds(start, end), where, WINDOW_LIMIT)


async def _read_cached(key: str) -> dict | None:
    if key in _memory:
        return _memory[key]
    if snapshots.configured():
        try:
            raw = await snapshots.command("GET", key)
            if raw:
                _memory[key] = json.loads(raw)
                return _memory[key]
        except Exception:
            logger.warning("Quarter cache read failed for %s", key)
    return None


async def _cached_window(project_id: str, start: date, end: date, today: date, where: str = "") -> dict:
    # Only whole quarters that have ended are final.
    final = start == quarter_start(start) and end == next_quarter(start) and end <= today
    if not final:
        return await _fetch_window(project_id, start, end if end <= today else None, where)

    base_key = f"{PREFIX}{project_id}:{start.isoformat()}"
    key = base_key
    if where:
        key += ":" + hashlib.sha256(where.encode()).hexdigest()[:16]
        # Lifetime reaches back before most projects used PostHog. A quarter
        # with no events at all has none for any filter either.
        base = await _read_cached(base_key)
        if base is not None and not base["timeseries"]:
            return base
    cached = await _read_cached(key)
    if cached is not None:
        return cached

    window = await _fetch_window(project_id, start, end, where)
    _memory[key] = window
    if snapshots.configured():
        try:
            await snapshots.command("SET", key, json.dumps(window), "EX", QUARTER_TTL)
        except Exception:
            logger.warning("Quarter cache write failed for %s", key)
    return window


async def fetch_history(
    project_id: str, days: int, align: bool = False, where: str = ""
) -> tuple[list[TimeseriesEntry], dict[str, list[StatEntry]]]:
    """Fetch timeseries and breakdowns for the last `days` days, quarter by quarter.

    `where` holds extra HogQL conditions from services.filters.posthog_where.
    """
    today = datetime.now(timezone.utc).date()
    parts = await gather_queries(
        *(_cached_window(project_id, start, end, today, where) for start, end in windows(days, today, align))
    )

    by_day: dict[str, TimeseriesEntry] = {}
    for part in parts:
        for row in part["timeseries"]:
            day = datetime.fromisoformat(row["date"].replace("Z", "+00:00"))
            by_day[day.date().isoformat()] = TimeseriesEntry(
                date=day, pageviews=row["pageviews"], visitors=row["visitors"], bounce_rate=0.0
            )

    breakdowns = {}
    for field in PH_FIELDS:
        merged: list[StatEntry] = []
        for part in parts:
            merged = merge_stat_lists(merged, [StatEntry(**row) for row in part["breakdowns"][field]])
        breakdowns[field] = merged[:BREAKDOWN_LIMIT]

    return sorted(by_day.values(), key=lambda entry: entry.date), breakdowns

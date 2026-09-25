"""
PostHog Service Layer

Handles all interactions with the PostHog API using HogQL queries.
Supports dynamic project ID for multi-project analytics.
"""

import asyncio
from datetime import datetime

import httpx

from core.config import settings
from models import StatEntry, TimeseriesEntry
from services.parallel import gather_queries

from .client import http_client

# Field mapping for PostHog internal property names
PH_FIELDS = {
    "path": "properties.$pathname",
    "device_type": "properties.$device_type",
    "referrer": "properties.$referring_domain",
    "os_name": "properties.$os",
    "country": "properties.$geoip_country_code",
}


# Lifetime breakdowns scan years of events and take PostHog 10s to over 40s.
# The snapshot refresh deadline bounds the total wait.
QUERY_TIMEOUT = httpx.Timeout(8.0, read=120.0)
# PostHog answers bursts of concurrent queries with 429 or 503.
MAX_CONCURRENT_QUERIES = 4
RETRY_STATUSES = {429, 502, 503, 504}
_query_slots: dict[asyncio.AbstractEventLoop, asyncio.Semaphore] = {}


def _slots() -> asyncio.Semaphore:
    # One semaphore per event loop; a semaphore can't be shared across loops.
    loop = asyncio.get_running_loop()
    if loop not in _query_slots:
        _query_slots.clear()
        _query_slots[loop] = asyncio.Semaphore(MAX_CONCURRENT_QUERIES)
    return _query_slots[loop]


async def query_posthog(project_id: str, hogql: str) -> list:
    """
    Execute a HogQL query against a specific PostHog project.

    Args:
        project_id: The PostHog project ID
        hogql: The HogQL query string

    Returns:
        List of result rows from the query
    """
    if not settings.posthog_api_key:
        raise RuntimeError("PostHog is not configured")

    url = f"{settings.posthog_base_url}/api/projects/{project_id}/query/"
    headers = {"Authorization": f"Bearer {settings.posthog_api_key}"}

    body = {"query": {"kind": "HogQLQuery", "query": hogql}}
    try:
        for attempt in range(2):
            async with _slots():
                response = await http_client.post(url, headers=headers, json=body, timeout=QUERY_TIMEOUT)
            if response.status_code in RETRY_STATUSES and attempt == 0:
                retry_after = response.headers.get("Retry-After", "")
                await asyncio.sleep(min(float(retry_after), 10) if retry_after.isdigit() else 3)
                continue
            break
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload.get("results"), list):
            raise RuntimeError("PostHog query did not return completed results")
        return payload["results"]

    except httpx.HTTPError as e:
        raise RuntimeError("PostHog query failed") from e


async def fetch_timeseries(project_id: str, days: int = 30) -> list[TimeseriesEntry]:
    """
    Fetch timeseries pageview data from PostHog.

    Args:
        project_id: The PostHog project ID
        days: Number of days to look back

    Returns:
        List of TimeseriesEntry objects
    """
    query = f"""
        SELECT
            toStartOfDay(timestamp) as d,
            count() as pageviews,
            count(DISTINCT distinct_id) as visitors
        FROM events
        WHERE event = '$pageview'
            AND timestamp > now() - INTERVAL {days} DAY
        GROUP BY d
        ORDER BY d ASC
    """

    results = await query_posthog(project_id, query)

    return [
        TimeseriesEntry(
            date=datetime.fromisoformat(row[0]) if isinstance(row[0], str) else row[0],
            pageviews=row[1],
            visitors=row[2],
            bounce_rate=0.0,  # PostHog doesn't provide bounce rate in the same way
        )
        for row in results
    ]


async def fetch_timeseries_window(
    project_id: str, start_days_ago: int, end_days_ago: int
) -> list[TimeseriesEntry]:
    """
    Fetch timeseries data for a specific historical window.

    Args:
        project_id: The PostHog project ID
        start_days_ago: Window start offset from now in days (inclusive)
        end_days_ago: Window end offset from now in days (exclusive)

    Returns:
        List of TimeseriesEntry objects
    """
    query = f"""
        SELECT
            toStartOfDay(timestamp) as d,
            count() as pageviews,
            count(DISTINCT distinct_id) as visitors
        FROM events
        WHERE event = '$pageview'
            AND timestamp > now() - INTERVAL {end_days_ago} DAY
            AND timestamp <= now() - INTERVAL {start_days_ago} DAY
        GROUP BY d
        ORDER BY d ASC
    """

    results = await query_posthog(project_id, query)

    return [
        TimeseriesEntry(
            date=datetime.fromisoformat(row[0]) if isinstance(row[0], str) else row[0],
            pageviews=row[1],
            visitors=row[2],
            bounce_rate=0.0,
        )
        for row in results
    ]


async def fetch_timeseries_batched(
    project_id: str,
    total_days: int = 3650,
    batch_days: int = 90,
    max_concurrency: int = 4,
) -> list[TimeseriesEntry]:
    """
    Fetch long-range PostHog timeseries in smaller windows and merge by day.

    This avoids empty/failed responses often seen on very large single-range queries.
    """
    windows: list[tuple[int, int]] = []
    start = 0
    while start < total_days:
        end = min(start + batch_days, total_days)
        windows.append((start, end))
        start = end

    semaphore = asyncio.Semaphore(max_concurrency)

    async def run_window(window: tuple[int, int]) -> list[TimeseriesEntry]:
        w_start, w_end = window
        async with semaphore:
            return await fetch_timeseries_window(project_id, w_start, w_end)

    chunks = await gather_queries(*(run_window(window) for window in windows))

    merged: dict[str, TimeseriesEntry] = {}
    for chunk in chunks:
        for entry in chunk:
            day_key = entry.date.date().isoformat()
            if day_key in merged:
                merged[day_key].pageviews += entry.pageviews
                merged[day_key].visitors += entry.visitors
            else:
                merged[day_key] = TimeseriesEntry(
                    date=entry.date,
                    pageviews=entry.pageviews,
                    visitors=entry.visitors,
                    bounce_rate=entry.bounce_rate,
                    migration_date=entry.migration_date,
                )

    return sorted(merged.values(), key=lambda x: x.date)


async def fetch_breakdown(
    project_id: str, field: str, days: int = 30, limit: int = 15
) -> list[StatEntry]:
    """
    Fetch breakdown statistics for a specific field from PostHog.

    Args:
        project_id: The PostHog project ID
        field: The field to break down by (path, device_type, referrer, os_name, country)
        days: Number of days to look back
        limit: Maximum number of results to return

    Returns:
        List of StatEntry objects
    """
    target = PH_FIELDS.get(field, "properties.$pathname")

    query = f"""
        SELECT
            {target} as key,
            count() as pageviews,
            count(DISTINCT distinct_id) as visitors
        FROM events
        WHERE event = '$pageview'
            AND timestamp > now() - INTERVAL {days} DAY
            AND {target} IS NOT NULL
        GROUP BY key
        ORDER BY pageviews DESC
        LIMIT {limit}
    """

    results = await query_posthog(project_id, query)

    return [
        StatEntry(key=str(row[0]), pageviews=row[1], visitors=row[2]) for row in results
    ]


async def fetch_all_breakdowns(
    project_id: str, days: int = 30
) -> dict[str, list[StatEntry]]:
    """
    Fetch all breakdown statistics in parallel.

    Args:
        project_id: The PostHog project ID
        days: Number of days to look back

    Returns:
        Dictionary mapping field names to lists of StatEntry objects
    """
    fields = [
        "path",
        "device_type",
        "referrer",
        "os_name",
        "country",
    ]

    # Execute all breakdown queries in parallel
    tasks = [fetch_breakdown(project_id, field, days) for field in fields]
    results = await gather_queries(*tasks)

    return dict(zip(fields, results))

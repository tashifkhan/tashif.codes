"""
PostHog Service Layer

Handles all interactions with the PostHog API using HogQL queries.
Supports dynamic project ID for multi-project analytics.
"""

import asyncio

import httpx

from core.config import settings

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
# PostHog allows 3 concurrent queries and 240 a minute per project, and
# answers anything past that with 429.
MAX_CONCURRENT_QUERIES = 3
RETRY_STATUSES = {429, 502, 503, 504}
RETRY_DELAYS = (3, 8)
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
        for delay in (*RETRY_DELAYS, None):
            async with _slots():
                response = await http_client.post(url, headers=headers, json=body, timeout=QUERY_TIMEOUT)
            if response.status_code not in RETRY_STATUSES or delay is None:
                break
            retry_after = response.headers.get("Retry-After", "")
            await asyncio.sleep(min(float(retry_after), 15) if retry_after.isdigit() else delay)
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload.get("results"), list):
            raise RuntimeError("PostHog query did not return completed results")
        return payload["results"]

    except httpx.HTTPError as e:
        raise RuntimeError("PostHog query failed") from e


async def query_window(project_id: str, bounds: str, where: str = "", limit: int = 100) -> dict:
    """Daily timeseries and every breakdown for one time range, in one query.

    PostHog rate limits by query count, so ARRAY JOIN fans each event out
    into one row per dimension instead of running six separate queries.
    `bounds` is a HogQL condition on timestamp; `where` holds extra
    conditions from services.filters.posthog_where. A window must span
    fewer than `limit` days so no day is cut off.

    HogQL caps results at 100 rows unless the query sets its own LIMIT, so
    the outer LIMIT fits every field's rows.
    """
    pairs = ",\n            ".join(
        f"('{field}', toString({target}))" for field, target in PH_FIELDS.items()
    )
    rows = await query_posthog(project_id, f"""
        SELECT pair.1 AS field, pair.2 AS key, count() AS pageviews, count(DISTINCT distinct_id) AS visitors
        FROM events
        ARRAY JOIN [
            ('day', formatDateTime(toStartOfDay(timestamp), '%Y-%m-%dT%H:%i:%S%z')),
            {pairs}
        ] AS pair
        WHERE event = '$pageview' AND {bounds} AND pair.2 IS NOT NULL{where}
        GROUP BY field, key
        ORDER BY pageviews DESC
        LIMIT {limit} BY field
        LIMIT {limit * (len(PH_FIELDS) + 1)}
    """)
    timeseries = []
    breakdowns: dict[str, list[dict]] = {field: [] for field in PH_FIELDS}
    for field, key, pageviews, visitors in rows:
        row = {"pageviews": pageviews, "visitors": visitors}
        if field == "day":
            timeseries.append({"date": key, **row})
        elif field in breakdowns:
            breakdowns[field].append({"key": key, **row})
    timeseries.sort(key=lambda row: row["date"])
    return {"timeseries": timeseries, "breakdowns": breakdowns}

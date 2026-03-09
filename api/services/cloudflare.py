"""
Cloudflare Web Analytics Service Layer

Handles all interactions with Cloudflare's GraphQL API for RUM (Real User Monitoring) data.
"""

import httpx
from .client import http_client
from core.config import settings
from models import StatEntry, TimeseriesEntry
from datetime import datetime, timezone, timedelta


# Cloudflare API Configuration
CF_API_URL = "https://api.cloudflare.com/client/v4/graphql"
CF_MAX_QUERY_DAYS = 90
CF_MAX_LOOKBACK_DAYS = 184
CF_EMPTY_WINDOW_STOP_THRESHOLD = 3


def _as_dict(value: object) -> dict:
    """Return value when it is a dict, otherwise an empty dict."""
    return value if isinstance(value, dict) else {}


def _as_list(value: object) -> list:
    """Return value when it is a list, otherwise an empty list."""
    return value if isinstance(value, list) else []


def _to_int(value: object) -> int:
    """Safely convert incoming values to int, defaulting to 0."""
    if value is None:
        return 0
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            return 0
    return 0


def _iter_time_windows(
    days: int, window_days: int = CF_MAX_QUERY_DAYS
) -> list[tuple[datetime, datetime]]:
    """Build backward windows (newest first) to satisfy Cloudflare range limits."""
    now = datetime.now(timezone.utc)
    remaining = days
    window_end = now
    windows: list[tuple[datetime, datetime]] = []

    while remaining > 0:
        span = min(window_days, remaining)
        window_start = window_end - timedelta(days=span)
        windows.append((window_start, window_end))
        window_end = window_start
        remaining -= span

    return windows


def _merge_timeseries_entries(entries: list[TimeseriesEntry]) -> list[TimeseriesEntry]:
    """Merge daily entries from multiple windows into one sorted list."""
    daily: dict[str, TimeseriesEntry] = {}

    for entry in entries:
        day_key = entry.date.strftime("%Y-%m-%d")
        if day_key in daily:
            daily[day_key].pageviews += entry.pageviews
            daily[day_key].visitors += entry.visitors
        else:
            daily[day_key] = TimeseriesEntry(
                date=datetime.fromisoformat(f"{day_key}T00:00:00+00:00"),
                pageviews=entry.pageviews,
                visitors=entry.visitors,
                bounce_rate=0.0,
            )

    return sorted(daily.values(), key=lambda x: x.date)


def _merge_breakdown_entries(entries: list[StatEntry], limit: int) -> list[StatEntry]:
    """Merge duplicate keys from multiple windows and keep top N by pageviews."""
    merged: dict[str, StatEntry] = {}

    for entry in entries:
        key = entry.key or "(unknown)"
        if key in merged:
            merged[key].pageviews += entry.pageviews
            merged[key].visitors += entry.visitors
        else:
            merged[key] = StatEntry(
                key=key,
                pageviews=entry.pageviews,
                visitors=entry.visitors,
            )

    ranked = sorted(
        merged.values(),
        key=lambda x: (x.pageviews, x.visitors),
        reverse=True,
    )
    return ranked[:limit]


async def _fetch_cf_timeseries_range(
    site_tag: str, from_date: str, to_date: str
) -> list[TimeseriesEntry]:
    """Fetch Cloudflare timeseries for a single date range window."""
    query = """
    query RumTimeseries($accountTag: String!, $filter: ZoneRumPageloadEventsAdaptiveGroupsFilter_InputObject!) {
        viewer {
            accounts(filter: {accountTag: $accountTag}) {
                rumPageloadEventsAdaptiveGroups(limit: 5000, filter: $filter, orderBy: [datetimeHour_ASC]) {
                    count
                    sum {
                        visits
                    }
                    dimensions {
                        ts: datetimeHour
                    }
                }
            }
        }
    }
    """

    variables = {
        "accountTag": settings.cloudflare_account_tag,
        "filter": {
            "AND": [
                {"datetime_geq": from_date, "datetime_leq": to_date},
                {"siteTag": site_tag},
                {"bot": 0},
            ]
        },
    }

    result = await query_cloudflare(query, variables)

    try:
        result_dict = _as_dict(result)
        data = _as_dict(result_dict.get("data"))
        viewer = _as_dict(data.get("viewer"))
        accounts = _as_list(viewer.get("accounts"))
        account = _as_dict(accounts[0]) if accounts else {}
        groups = _as_list(account.get("rumPageloadEventsAdaptiveGroups"))

        daily_data: dict[str, TimeseriesEntry] = {}
        for group in groups:
            if not isinstance(group, dict):
                continue

            dimensions = _as_dict(group.get("dimensions"))
            ts = dimensions.get("ts")
            if not isinstance(ts, str) or not ts:
                continue

            date_obj = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            day_key = date_obj.strftime("%Y-%m-%d")

            sum_data = _as_dict(group.get("sum"))
            pageviews = _to_int(group.get("count"))
            visitors = _to_int(sum_data.get("visits"))

            if day_key in daily_data:
                daily_data[day_key].pageviews += pageviews
                daily_data[day_key].visitors += visitors
            else:
                daily_data[day_key] = TimeseriesEntry(
                    date=datetime.fromisoformat(f"{day_key}T00:00:00+00:00"),
                    pageviews=pageviews,
                    visitors=visitors,
                    bounce_rate=0.0,
                )

        return sorted(daily_data.values(), key=lambda x: x.date)
    
    except Exception as e:
        print(f"Error parsing Cloudflare timeseries: {e!r}")
        return []


async def _fetch_cf_breakdown_range(
    site_tag: str,
    dimension: str,
    from_date: str,
    to_date: str,
    limit: int,
) -> list[StatEntry]:
    """Fetch Cloudflare breakdown for a single date range window."""
    query = f"""
    query GetRumBreakdown($accountTag: String!, $siteTag: String!, $from: Time!, $to: Time!) {{
        viewer {{
            accounts(filter: {{ accountTag: $accountTag }}) {{
                rumPageloadEventsAdaptiveGroups(
                    limit: {limit}
                    filter: {{ datetime_geq: $from, datetime_leq: $to, siteTag: $siteTag, bot: 0 }}
                    orderBy: [sum_visits_DESC]
                ) {{
                    dimensions {{
                        key: {dimension}
                    }}
                    count
                    sum {{
                        visits
                    }}
                }}
            }}
        }}
    }}
    """

    variables = {
        "accountTag": settings.cloudflare_account_tag,
        "siteTag": site_tag,
        "from": from_date,
        "to": to_date,
    }

    result = await query_cloudflare(query, variables)

    try:
        result_dict = _as_dict(result)
        data = _as_dict(result_dict.get("data"))
        viewer = _as_dict(data.get("viewer"))
        accounts = _as_list(viewer.get("accounts"))
        account = _as_dict(accounts[0]) if accounts else {}
        groups = _as_list(account.get("rumPageloadEventsAdaptiveGroups"))

        entries: list[StatEntry] = []
        for group in groups:
            if not isinstance(group, dict):
                continue

            dimensions = _as_dict(group.get("dimensions"))
            raw_key = dimensions.get("key")
            key = raw_key.strip().lower() if isinstance(raw_key, str) else ""
            normalized_key = key if key else "(unknown)"

            entries.append(
                StatEntry(
                    key=normalized_key,
                    pageviews=_to_int(group.get("count")),
                    visitors=_to_int(_as_dict(group.get("sum")).get("visits")),
                )
            )

        return entries
    except Exception as e:
        print(f"Error parsing Cloudflare breakdown: {e!r}")
        return []


async def query_cloudflare(query: str, variables: dict) -> dict:
    """
    Execute a GraphQL query against Cloudflare's API.

    Args:
        query: The GraphQL query string
        variables: Query variables

    Returns:
        The response data or empty dict on error
    """
    if not settings.cloudflare_api_token or not settings.cloudflare_account_tag:
        return {}

    headers = {
        "Authorization": f"Bearer {settings.cloudflare_api_token}",
        "Content-Type": "application/json",
    }

    try:
        response = await http_client.post(
            CF_API_URL,
            headers=headers,
            json={"query": query, "variables": variables},
        )
        response.raise_for_status()
        payload = response.json()
        
        if not isinstance(payload, dict):
            print(
                f"Cloudflare API returned non-dict payload: {type(payload).__name__}"
            )
            return {}
        
        if payload.get("errors"):
            print(f"Cloudflare GraphQL errors: {payload['errors']}")
        
        return payload
        
    except httpx.HTTPError as e:
        print(f"Cloudflare API error: {e}")
        return {}
        
    except Exception as e:
        print(f"Cloudflare unexpected error: {e}")
        return {}


async def fetch_cf_timeseries(site_tag: str, days: int = 30) -> list[TimeseriesEntry]:
    """
    Fetch timeseries pageview/visit data from Cloudflare Web Analytics.

    Args:
        site_tag: The Cloudflare site tag
        days: Number of days to look back

    Returns:
        List of TimeseriesEntry objects
    """
    if days <= 0:
        return []

    effective_days = min(days, CF_MAX_LOOKBACK_DAYS)

    if effective_days <= CF_MAX_QUERY_DAYS:
        now = datetime.now(timezone.utc)
        from_date = (now - timedelta(days=effective_days)).isoformat()
        to_date = now.isoformat()
        return await _fetch_cf_timeseries_range(site_tag, from_date, to_date)

    windowed_entries: list[TimeseriesEntry] = []
    empty_windows = 0
    windows = _iter_time_windows(effective_days, CF_MAX_QUERY_DAYS)

    for window_start, window_end in windows:
        window_result = await _fetch_cf_timeseries_range(
            site_tag,
            window_start.isoformat(),
            window_end.isoformat(),
        )

        if window_result:
            empty_windows = 0
            windowed_entries.extend(window_result)
        else:
            empty_windows += 1
            if empty_windows >= CF_EMPTY_WINDOW_STOP_THRESHOLD:
                break

    return _merge_timeseries_entries(windowed_entries)


async def fetch_cf_breakdown(
    site_tag: str, dimension: str, days: int = 30, limit: int = 15
) -> list[StatEntry]:
    """
    Fetch breakdown statistics for a specific dimension from Cloudflare.

    Args:
        site_tag: The Cloudflare site tag
        dimension: The dimension to break down by (userAgentOS, userAgentBrowser, countryName, refererHost, requestPath)
        days: Number of days to look back
        limit: Maximum number of results to return

    Returns:
        List of StatEntry objects
    """
    if days <= 0:
        return []

    effective_days = min(days, CF_MAX_LOOKBACK_DAYS)

    if effective_days <= CF_MAX_QUERY_DAYS:
        now = datetime.now(timezone.utc)
        from_date = (now - timedelta(days=effective_days)).isoformat()
        to_date = now.isoformat()
        return await _fetch_cf_breakdown_range(
            site_tag, dimension, from_date, to_date, limit
        )

    per_window_limit = max(limit * 5, 100)
    windowed_entries: list[StatEntry] = []
    empty_windows = 0
    windows = _iter_time_windows(effective_days, CF_MAX_QUERY_DAYS)

    for window_start, window_end in windows:
        window_result = await _fetch_cf_breakdown_range(
            site_tag,
            dimension,
            window_start.isoformat(),
            window_end.isoformat(),
            per_window_limit,
        )

        if window_result:
            empty_windows = 0
            windowed_entries.extend(window_result)
        else:
            empty_windows += 1
            if empty_windows >= CF_EMPTY_WINDOW_STOP_THRESHOLD:
                break

    return _merge_breakdown_entries(windowed_entries, limit)


async def fetch_cf_all_breakdowns(
    site_tag: str, days: int = 30
) -> dict[str, list[StatEntry]]:
    """
    Fetch all breakdown statistics in parallel from Cloudflare.

    Args:
        site_tag: The Cloudflare site tag
        days: Number of days to look back

    Returns:
        Dictionary mapping field names to lists of StatEntry objects
    """
    import asyncio

    # Map our standard field names to Cloudflare dimensions
    dimension_map = {
        "path": "requestPath",
        "os_name": "userAgentOS",
        "device_type": "userAgentDevice",
        "referrer": "refererHost",
        "country": "countryName",
    }

    tasks = {
        field: fetch_cf_breakdown(site_tag, cf_dim, days)
        for field, cf_dim in dimension_map.items()
    }

    results = await asyncio.gather(*tasks.values())

    return dict(zip(tasks.keys(), results))

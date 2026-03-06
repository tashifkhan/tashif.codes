"""
Data Merging Service

Handles the unification of Vercel migration data and PostHog live data.
"""

from models import StatEntry, TimeseriesEntry, Stats
import sys
from pathlib import Path

# Add parent directory to path to import utils
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils import get_country_display


def merge_stat_lists(
    list_a: list[StatEntry], list_b: list[StatEntry]
) -> list[StatEntry]:
    """
    Merge two lists of StatEntry objects, summing pageviews/visitors for matching keys.
    Keys are normalized to lowercase for case-insensitive matching.

    Args:
        list_a: First list of StatEntry objects (e.g., from Vercel)
        list_b: Second list of StatEntry objects (e.g., from PostHog)

    Returns:
        Merged and sorted list of StatEntry objects
    """
    merged: dict[str, StatEntry] = {}

    for entry in list_a + list_b:
        # Normalize key to lowercase for case-insensitive matching
        normalized_key = entry.key.lower() if entry.key else entry.key
        if normalized_key in merged:
            # Sum the values for duplicate keys
            merged[normalized_key].pageviews += entry.pageviews
            merged[normalized_key].visitors += entry.visitors
        else:
            # Create a new copy with normalized key
            merged[normalized_key] = StatEntry(
                key=normalized_key, pageviews=entry.pageviews, visitors=entry.visitors
            )

    # Sort by pageviews descending
    return sorted(merged.values(), key=lambda x: x.pageviews, reverse=True)


def merge_timeseries(
    list_a: list[TimeseriesEntry], list_b: list[TimeseriesEntry]
) -> list[TimeseriesEntry]:
    """
    Merge two timeseries lists and sort by date.
    Filters to start from the first non-zero pageview entry.

    Args:
        list_a: First timeseries list (e.g., from Vercel)
        list_b: Second timeseries list (e.g., from PostHog)

    Returns:
        Merged and sorted timeseries list starting from first non-zero pageviews
    """
    # Combine entries by UTC day to avoid duplicate dates and incorrect totals.
    # Vercel migration exports can contain multiple entries per day.
    aggregated: dict[str, TimeseriesEntry] = {}

    for entry in list_a + list_b:
        day_key = entry.date.date().isoformat()
        if day_key in aggregated:
            existing = aggregated[day_key]
            existing.pageviews += entry.pageviews
            existing.visitors += entry.visitors

            if entry.pageviews > 0:
                total_pageviews = existing.pageviews
                previous_pageviews = total_pageviews - entry.pageviews
                if previous_pageviews > 0:
                    existing.bounce_rate = (
                        (existing.bounce_rate * previous_pageviews)
                        + (entry.bounce_rate * entry.pageviews)
                    ) / total_pageviews
                else:
                    existing.bounce_rate = entry.bounce_rate
        else:
            aggregated[day_key] = TimeseriesEntry(
                date=entry.date,
                pageviews=entry.pageviews,
                visitors=entry.visitors,
                bounce_rate=entry.bounce_rate,
                migration_date=entry.migration_date,
            )

    sorted_data = sorted(aggregated.values(), key=lambda x: x.date)

    # Find first non-zero pageview entry
    first_nonzero_idx = next(
        (i for i, entry in enumerate(sorted_data) if entry.pageviews > 0), 0
    )

    return sorted_data[first_nonzero_idx:]


def merge_stats(
    vercel_stats: Stats, posthog_stats: dict[str, list[StatEntry]]
) -> Stats:
    """
    Merge Vercel Stats with PostHog breakdown data.
    Formats country codes to display names with flags.

    Args:
        vercel_stats: Stats object from Vercel migration data
        posthog_stats: Dictionary of PostHog breakdown results

    Returns:
        Merged Stats object with formatted country names
    """
    # Merge country data and format the keys
    merged_countries = merge_stat_lists(
        vercel_stats.country, posthog_stats.get("country", [])
    )

    # Format country codes to display names with flags
    formatted_countries = [
        StatEntry(
            key=get_country_display(entry.key),
            pageviews=entry.pageviews,
            visitors=entry.visitors,
        )
        for entry in merged_countries
    ]

    return Stats(
        path=merge_stat_lists(vercel_stats.path, posthog_stats.get("path", [])),
        device_type=merge_stat_lists(
            vercel_stats.device_type, posthog_stats.get("device_type", [])
        ),
        referrer=merge_stat_lists(
            vercel_stats.referrer, posthog_stats.get("referrer", [])
        ),
        os_name=merge_stat_lists(
            vercel_stats.os_name, posthog_stats.get("os_name", [])
        ),
        country=formatted_countries,
    )

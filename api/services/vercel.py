"""
Vercel Data Service Layer

Handles loading and processing of Vercel migration data from local JSON files.
"""

import json
from pathlib import Path

from models import AllStats, Metadata, Stats, TimeseriesEntry
from datetime import datetime, timezone


def load_vercel_data(file_path: Path) -> AllStats | None:
    """
    Load Vercel migration data from a JSON file.

    Args:
        file_path: Path to the JSON file

    Returns:
        AllStats object or None if file doesn't exist
    """
    try:
        with open(file_path, "r") as f:
            data = json.load(f)
            return AllStats(**data)
    
    except FileNotFoundError:
        return None
    
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON file {file_path}: {e}")
        return None


def get_empty_stats() -> AllStats:
    """
    Create an empty AllStats object for projects without migration data.

    Returns:
        AllStats with empty timeseries and stats
    """
    return AllStats(
        metadata=Metadata(export_date=datetime.now(timezone.utc), source="initialized"),
        timeseries=[],
        stats=Stats(),
    )


def filter_timeseries_by_date(
    timeseries: list[TimeseriesEntry], days: int | None = None
) -> list[TimeseriesEntry]:
    """
    Filter timeseries entries to only include entries within the specified day range.
    Starts from the first non-zero pageview entry.

    Args:
        timeseries: List of TimeseriesEntry objects
        days: Number of days to include (None for all)

    Returns:
        Filtered list of TimeseriesEntry objects
    """
    if days is None:
        # Find first non-zero pageview entry
        first_nonzero_idx = next(
            (i for i, entry in enumerate(timeseries) if entry.pageviews > 0), 0
        )
        return timeseries[first_nonzero_idx:]

    from datetime import timedelta

    cutoff = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    ) - timedelta(days=days)

    filtered = [
        entry
        for entry in timeseries
        if entry.date.replace(tzinfo=timezone.utc) >= cutoff
    ]

    # Find first non-zero pageview entry in filtered data
    first_nonzero_idx = next(
        (i for i, entry in enumerate(filtered) if entry.pageviews > 0), 0
    )

    return filtered[first_nonzero_idx:]


def filter_stats_by_date(stats: "Stats", days: int | None = None) -> "Stats":
    """
    Filter stats entries to only include entries within the specified day range,
    then aggregate entries with the same key.

    Args:
        stats: Stats object containing breakdown data
        days: Number of days to include (None for all)

    Returns:
        Filtered Stats object with aggregated entries
    """
    from models import StatEntry

    if days is None:
        return stats

    from datetime import timedelta

    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days)).date()

    def filter_and_aggregate(entries: list[StatEntry]) -> list[StatEntry]:
        """Filter entries by date and aggregate same keys (case-insensitive)."""
        # Filter entries within date range
        filtered = [
            entry
            for entry in entries
            if entry.migration_date is None or entry.migration_date >= cutoff_date
        ]

        # Aggregate entries with the same key (case-insensitive)
        aggregated: dict[str, StatEntry] = {}
        for entry in filtered:
            # Normalize key to lowercase for case-insensitive matching
            normalized_key = entry.key.lower() if entry.key else entry.key
            if normalized_key in aggregated:
                aggregated[normalized_key].pageviews += entry.pageviews
                aggregated[normalized_key].visitors += entry.visitors
            else:
                # Create a copy with normalized key
                aggregated[normalized_key] = StatEntry(
                    key=normalized_key,
                    pageviews=entry.pageviews,
                    visitors=entry.visitors,
                )

        # Sort by pageviews descending
        return sorted(aggregated.values(), key=lambda x: x.pageviews, reverse=True)

    return Stats(
        path=filter_and_aggregate(stats.path),
        device_type=filter_and_aggregate(stats.device_type),
        referrer=filter_and_aggregate(stats.referrer),
        os_name=filter_and_aggregate(stats.os_name),
        country=filter_and_aggregate(stats.country),
    )

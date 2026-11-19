"""
Vercel Data Service Layer

Handles loading and processing of Vercel migration data from local JSON files.
"""

import json
from datetime import datetime, time, timedelta, timezone
from pathlib import Path

from models import AllStats, Metadata, StatEntry, Stats, TimeseriesEntry

from .filters import Filter, raw_values

# Export days are IST calendar days; the unfiltered timeseries stamps each
# at IST midnight, so filtered history does the same.
IST = timezone(timedelta(hours=5, minutes=30))


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


_rows_cache: dict[Path, tuple[float, list[dict] | None]] = {}

# Fields the export's combination rows carry.
ROW_FIELDS = ("path", "referrer", "country")


def load_vercel_rows(file_path: Path) -> list[dict] | None:
    """
    The export's per-day (path, referrer, country) rows, or None if it has none.

    Only the request metrics exports (scripts/export_stats_apis.py) write them.
    The parsed list is kept until the file changes.
    """
    try:
        mtime = file_path.stat().st_mtime
    except OSError:
        return None
    cached = _rows_cache.get(file_path)
    if cached and cached[0] == mtime:
        return cached[1]
    try:
        rows = json.loads(file_path.read_text()).get("rows") or None
    except (OSError, json.JSONDecodeError):
        rows = None
    _rows_cache[file_path] = (mtime, rows)
    return rows


def _stamp(day) -> datetime:
    return datetime.combine(day, time(), IST).astimezone(timezone.utc)


def filter_vercel_rows(
    data: AllStats, rows: list[dict], filters: list[Filter], days: int | None = None
) -> AllStats | None:
    """
    History matching any set of filters, from the export's combination rows.

    Every breakdown is filled, not just the filtered field. Visitors in rows
    are distinct IPs per combination, so sums across combinations overcount.
    With a single filter the timeseries and that field's entries come from the
    per-field totals instead, which count each IP once per day.
    """
    if any(field not in ROW_FIELDS for field, _ in filters):
        return None
    cutoff = ((datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat() if days else None)
    wanted = [(field, raw_values(field, value)) for field, value in filters]
    matched = [
        row
        for row in rows
        if (cutoff is None or row["date"] >= cutoff)
        and all(str(row.get(field, "")).lower() in values for field, values in wanted)
    ]

    def totals(field: str) -> list[StatEntry]:
        sums: dict[str, list[int]] = {}
        for row in matched:
            key = row[field]
            entry = sums.setdefault(key, [0, 0])
            entry[0] += row["pageviews"]
            entry[1] += row["visitors"]
        return sorted(
            (StatEntry(key=key, pageviews=pv, visitors=v) for key, (pv, v) in sums.items()),
            key=lambda e: e.pageviews,
            reverse=True,
        )

    stats = {field: totals(field) for field in ROW_FIELDS}
    if len(filters) == 1:
        exact = filter_vercel_history(data, filters, days)
        if exact is not None:
            field = filters[0][0]
            stats[field] = getattr(exact.stats, field)
            return AllStats(metadata=data.metadata, timeseries=exact.timeseries, stats=Stats(**stats))

    daily: dict[str, list[int]] = {}
    for row in matched:
        day = daily.setdefault(row["date"], [0, 0])
        day[0] += row["pageviews"]
        day[1] += row["visitors"]
    timeseries = [
        TimeseriesEntry(
            date=_stamp(datetime.fromisoformat(day).date()),
            pageviews=pageviews,
            visitors=visitors,
            bounce_rate=0,
            migration_date=datetime.fromisoformat(day).date(),
        )
        for day, (pageviews, visitors) in sorted(daily.items())
    ]
    return AllStats(metadata=data.metadata, timeseries=timeseries, stats=Stats(**stats))


def filter_vercel_history(data: AllStats, filters: list[Filter], days: int | None = None) -> AllStats | None:
    """
    Vercel history matching one filter, or None when it can't be filtered.

    The export has daily totals per key for each field on its own, so one
    filter gives an exact daily timeseries and that field's own entries.
    Other fields, and any combination of filters, have no data to split.
    """
    if len(filters) != 1:
        return None
    field, value = filters[0]
    matches = raw_values(field, value)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).date() if days else None
    entries = [
        entry
        for entry in getattr(data.stats, field)
        if entry.key.lower() in matches
        and entry.migration_date
        and (cutoff is None or entry.migration_date >= cutoff)
    ]

    daily: dict = {}
    for entry in entries:
        day = daily.setdefault(entry.migration_date, [0, 0])
        day[0] += entry.pageviews
        day[1] += entry.visitors
    timeseries = [
        TimeseriesEntry(
            date=datetime.combine(day, time(), IST).astimezone(timezone.utc),
            pageviews=pageviews,
            visitors=visitors,
            bounce_rate=0,
            migration_date=day,
        )
        for day, (pageviews, visitors) in sorted(daily.items())
    ]
    return AllStats(
        metadata=data.metadata,
        timeseries=timeseries,
        stats=Stats(**{field: [StatEntry(key=e.key, pageviews=e.pageviews, visitors=e.visitors) for e in entries]}),
    )

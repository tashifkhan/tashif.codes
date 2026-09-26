"""
Pydantic Models for Analytics API

These models define the structure for unified analytics data
combining Vercel migration data with PostHog live data.
"""

from datetime import datetime, date
from pydantic import BaseModel, Field


class Metadata(BaseModel):
    """Metadata about the analytics export."""

    export_date: datetime
    source: str
    # Vercel migration history has per-day totals for each field on its own,
    # with no per-event data. One filter can use its field's daily totals, so
    # history counts in the chart, totals and that field's list
    # (history_field). More filters leave history out (excludes_history).
    excludes_history: bool = False
    history_field: str | None = None


class TimeseriesEntry(BaseModel):
    """A single timeseries data point."""

    date: datetime
    pageviews: int
    visitors: int
    bounce_rate: float
    migration_date: date | None = None  # type: ignore


class StatEntry(BaseModel):
    """A single stat entry for breakdowns (path, device, etc.)."""

    key: str
    pageviews: int
    visitors: int
    migration_date: date | None = None


class Stats(BaseModel):
    """Aggregated breakdown statistics."""

    path: list[StatEntry] = Field(default_factory=list)
    device_type: list[StatEntry] = Field(default_factory=list)
    referrer: list[StatEntry] = Field(default_factory=list)
    os_name: list[StatEntry] = Field(default_factory=list)
    country: list[StatEntry] = Field(default_factory=list)


class AllStats(BaseModel):
    """Complete analytics data structure."""

    metadata: Metadata
    timeseries: list[TimeseriesEntry]
    stats: Stats


class ProjectInfo(BaseModel):
    """Information about an available project."""

    slug: str
    name: str


class ProjectListResponse(BaseModel):
    """Response for the projects listing endpoint."""

    projects: list[ProjectInfo]
    total: int

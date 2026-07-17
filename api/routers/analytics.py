import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Query
from fastapi.responses import Response

from core.config import list_available_projects
from core.dependencies import get_project
from models import AllStats, Metadata, ProjectInfo, ProjectListResponse
from services import (
    fetch_timeseries_batched,
    fetch_all_breakdowns,
    fetch_cf_timeseries,
    fetch_cf_all_breakdowns,
    load_vercel_data,
    get_empty_stats,
    merge_timeseries,
    merge_stats,
    filter_timeseries_by_date,
    filter_stats_by_date,
    cached,
)

router = APIRouter(prefix="/v1", tags=["analytics"])

POSTHOG_FALLBACK_DAYS = 90
CLOUDFLARE_EFFECTIVE_LOOKBACK_DAYS = 184
IN_PROCESS_CACHE_TTL = 300  # 5 minutes


def _cache_control(days: int) -> str:
    """Return Cache-Control header value based on data freshness needs."""
    if days == 0:
        return "public, s-maxage=14400, stale-while-revalidate=3600"
    elif days <= 7:
        return "public, s-maxage=1800, stale-while-revalidate=900"
    else:
        return "public, s-maxage=3600, stale-while-revalidate=1800"


@router.get("/projects", response_model=ProjectListResponse)
async def get_projects(response: Response):
    """
    List all projects available on this dashboard.
    Returns a list of projects with their slugs and display names.
    """
    response.headers["Cache-Control"] = "public, s-maxage=86400, stale-while-revalidate=3600"
    projects = list_available_projects()
    return ProjectListResponse(
        projects=[ProjectInfo(**p) for p in projects], total=len(projects)
    )


async def _get_project_stats_internal(project: dict, days: int) -> AllStats:
    """Internal business logic to fetch and merge stats for a single project."""
    project_slug = project["slug"]
    config = project["config"]

    ph_id = config["ph_id"]
    cf_site_tag = config.get("cf_site_tag", "")
    vercel_file = config.get("vercel_file")
    analytics_provider = config.get("analytics_provider", "posthog")

    effective_days = (
        CLOUDFLARE_EFFECTIVE_LOOKBACK_DAYS
        if analytics_provider == "cloudflare" and days == 0
        else days
    )

    # 1. Load Vercel migration data and filter by days
    if vercel_file:
        vercel_data = load_vercel_data(vercel_file)
        if vercel_data is None:
            vercel_data = get_empty_stats()
    else:
        vercel_data = get_empty_stats()

    filter_days = effective_days if effective_days > 0 else None
    filtered_vercel_timeseries = filter_timeseries_by_date(
        vercel_data.timeseries, filter_days
    )
    filtered_vercel_stats = filter_stats_by_date(vercel_data.stats, filter_days)

    # 2. Fetch live analytics data based on provider
    live_timeseries = []
    live_breakdowns = {}

    query_days = effective_days if effective_days > 0 else 912

    if analytics_provider == "cloudflare" and cf_site_tag:
        ts_task = fetch_cf_timeseries(cf_site_tag, query_days)
        breakdowns_task = fetch_cf_all_breakdowns(cf_site_tag, query_days)
        live_timeseries, live_breakdowns = await asyncio.gather(
            ts_task, breakdowns_task
        )

    elif ph_id:
        ts_task = fetch_timeseries_batched(ph_id, total_days=query_days, batch_days=30)
        breakdowns_task = fetch_all_breakdowns(ph_id, query_days)

        live_timeseries, live_breakdowns = await asyncio.gather(
            ts_task, breakdowns_task
        )

        if query_days > POSTHOG_FALLBACK_DAYS and not live_timeseries:
            ts_task = fetch_timeseries_batched(ph_id, total_days=POSTHOG_FALLBACK_DAYS, batch_days=30)
            breakdowns_task = fetch_all_breakdowns(ph_id, POSTHOG_FALLBACK_DAYS)
            live_timeseries, live_breakdowns = await asyncio.gather(
                ts_task, breakdowns_task
            )

    # 3. Merge Vercel and live data
    merged_timeseries = merge_timeseries(filtered_vercel_timeseries, live_timeseries)
    merged_stats = merge_stats(filtered_vercel_stats, live_breakdowns)

    # 4. Build unified response
    return AllStats(
        metadata=Metadata(
            export_date=datetime.now(timezone.utc),
            source=f"unified_{project_slug}",
        ),
        timeseries=merged_timeseries,
        stats=merged_stats,
    )


async def _get_project_timeseries_internal(project: dict, days: int) -> dict:
    """Internal business logic to fetch timeseries for a single project."""
    project_slug = project["slug"]
    config = project["config"]

    ph_id = config["ph_id"]
    cf_site_tag = config.get("cf_site_tag", "")
    vercel_file = config.get("vercel_file")
    analytics_provider = config.get("analytics_provider", "posthog")

    effective_days = (
        CLOUDFLARE_EFFECTIVE_LOOKBACK_DAYS
        if analytics_provider == "cloudflare" and days == 0
        else days
    )

    filter_days = effective_days if effective_days > 0 else None
    vercel_data = load_vercel_data(vercel_file) if vercel_file else None
    vercel_ts = (
        filter_timeseries_by_date(vercel_data.timeseries, filter_days)
        if vercel_data
        else []
    )

    live_ts = []
    query_days = effective_days if effective_days > 0 else 912

    if analytics_provider == "cloudflare" and cf_site_tag:
        live_ts = await fetch_cf_timeseries(cf_site_tag, query_days)

    elif ph_id:
        live_ts = await fetch_timeseries_batched(ph_id, total_days=query_days, batch_days=30)

        if query_days > POSTHOG_FALLBACK_DAYS and not live_ts:
            live_ts = await fetch_timeseries_batched(ph_id, total_days=POSTHOG_FALLBACK_DAYS, batch_days=30)

    merged = merge_timeseries(vercel_ts, live_ts)

    return {"project": project_slug, "days": days, "timeseries": merged}


@router.get("/stats")
async def get_project_stats(
    response: Response,
    slugs: list[str] = Query(..., description="List of project slugs to fetch"),
    days: int = Query(
        default=30,
        ge=0,
        le=3650,
        description="Number of days to fetch data for (0 for lifetime)",
    ),
    refresh: bool = Query(
        default=False,
        description="Bypass in-process and CDN caches and re-fetch live analytics",
    ),
):
    """
    Get unified analytics stats for one or multiple projects concurrently.
    """
    if refresh:
        # Don't let shared caches serve a stale body after a forced refresh.
        response.headers["Cache-Control"] = "no-store"
    else:
        response.headers["Cache-Control"] = _cache_control(days)

    async def fetch_one(slug: str):
        try:
            project = get_project(slug)
            stats = await cached(
                f"stats:{slug}:{days}",
                IN_PROCESS_CACHE_TTL,
                lambda p=project: _get_project_stats_internal(project=p, days=days),
                force=refresh,
            )
            return {
                "slug": slug,
                "data": stats,
                "error": None,
            }
        except Exception as e:
            return {
                "slug": slug,
                "data": None,
                "error": str(e),
            }

    results = await asyncio.gather(*(fetch_one(slug) for slug in slugs))
    return {
        "results": results,
    }


@router.get("/timeseries")
async def get_project_timeseries(
    response: Response,
    slugs: list[str] = Query(..., description="List of project slugs to fetch"),
    days: int = Query(
        default=30,
        ge=0,
        le=3650,
        description="Number of days to fetch data for (0 for lifetime)",
    ),
    refresh: bool = Query(
        default=False,
        description="Bypass in-process and CDN caches and re-fetch live analytics",
    ),
):
    """
    Get only timeseries data for one or multiple projects concurrently.
    """
    if refresh:
        response.headers["Cache-Control"] = "no-store"
    else:
        response.headers["Cache-Control"] = _cache_control(days)

    async def fetch_one(slug: str):
        try:
            project = get_project(slug)
            ts = await cached(
                f"timeseries:{slug}:{days}",
                IN_PROCESS_CACHE_TTL,
                lambda p=project: _get_project_timeseries_internal(project=p, days=days),
                force=refresh,
            )
            return {
                "slug": slug,
                "data": ts,
                "error": None,
            }

        except Exception as e:
            return {
                "slug": slug,
                "data": None,
                "error": str(e),
            }

    results = await asyncio.gather(*(fetch_one(slug) for slug in slugs))
    return {
        "results": results,
    }

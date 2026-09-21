from services.parallel import gather_queries
from datetime import datetime, timezone

from fastapi import APIRouter, Query
from services.snapshots import get_snapshot
from services.posthog_history import fetch_history
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
)

router = APIRouter(prefix="/v1", tags=["analytics"])

CLOUDFLARE_EFFECTIVE_LOOKBACK_DAYS = 183


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
        live_timeseries, live_breakdowns = await gather_queries(
            ts_task, breakdowns_task
        )

    elif ph_id and query_days > 90:
        # Long ranges go quarter by quarter; past quarters come from cache.
        live_timeseries, live_breakdowns = await fetch_history(
            ph_id, query_days, align=effective_days == 0
        )

    elif ph_id:
        ts_task = fetch_timeseries_batched(ph_id, total_days=query_days, batch_days=90)
        breakdowns_task = fetch_all_breakdowns(ph_id, query_days)

        live_timeseries, live_breakdowns = await gather_queries(
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


@router.get("/stats")
async def get_project_stats(
    response: Response,
    slugs: list[str] = Query(..., max_length=8, description="List of project slugs to fetch"),
    days: int = Query(
        default=30,
        ge=0,
        le=3650,
        description="Number of days to fetch data for (0 for lifetime)",
    ),
    refresh: bool = Query(
        default=False,
        description="Refresh the saved snapshot, preserving it if the provider fails",
    ),
):
    """
    Get unified analytics stats for one or multiple projects concurrently.
    """
    # Snapshot freshness is explicit in the body. Never CDN-cache failures or
    # a response saying a refresh is still running.
    response.headers["Cache-Control"] = "no-store"

    async def fetch_one(slug: str):
        project = get_project(slug)
        payload = await get_snapshot(
            f"stats:{slug}:{days}",
            lambda: _get_project_stats_internal(project, days),
            refresh=refresh,
        )
        return {"slug": slug, **payload}

    # Validate before launching work, and avoid duplicate provider queries.
    unique_slugs = list(dict.fromkeys(slugs))
    for slug in unique_slugs:
        get_project(slug)
    return {"results": await gather_queries(*(fetch_one(slug) for slug in unique_slugs))}


@router.get("/timeseries")
async def get_project_timeseries(
    response: Response,
    slugs: list[str] = Query(..., max_length=8, description="List of project slugs to fetch"),
    days: int = Query(
        default=30,
        ge=0,
        le=3650,
        description="Number of days to fetch data for (0 for lifetime)",
    ),
    refresh: bool = Query(
        default=False,
        description="Refresh the saved snapshot, preserving it if the provider fails",
    ),
):
    """
    Get only timeseries data for one or multiple projects concurrently.
    """
    response.headers["Cache-Control"] = "no-store"

    async def fetch_one(slug: str):
        project = get_project(slug)
        payload = await get_snapshot(
            f"stats:{slug}:{days}",
            lambda: _get_project_stats_internal(project, days),
            refresh=refresh,
        )
        if payload["data"] is not None:
            payload["data"] = {
                "project": slug, "days": days,
                "timeseries": payload["data"]["timeseries"],
            }
        return {"slug": slug, **payload}

    unique_slugs = list(dict.fromkeys(slugs))
    for slug in unique_slugs:
        get_project(slug)
    return {"results": await gather_queries(*(fetch_one(slug) for slug in unique_slugs))}

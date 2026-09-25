import datetime

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from core.config import list_available_projects
from core.dependencies import get_project
from models import AllStats, Metadata, ProjectInfo, ProjectListResponse
from services import (
    fetch_all_breakdowns,
    fetch_cf_all_breakdowns,
    fetch_cf_timeseries,
    fetch_timeseries_batched,
    filter_stats_by_date,
    filter_timeseries_by_date,
    get_empty_stats,
    load_vercel_data,
    merge_stats,
    merge_timeseries,
)
from services.cloudflare import CF_DIMENSIONS
from services.filters import (
    MAX_FILTERS,
    Filter,
    cache_suffix,
    cloudflare_filters,
    parse_filters,
    posthog_where,
)
from services.parallel import gather_queries
from services.posthog import PH_FIELDS
from services.posthog_history import fetch_history
from services.snapshots import get_snapshot

router = APIRouter(prefix="/v1", tags=["analytics"])

CLOUDFLARE_EFFECTIVE_LOOKBACK_DAYS = 183


@router.get("/projects", response_model=ProjectListResponse)
async def get_projects(response: Response):
    """
    List all projects available on this dashboard.
    Returns a list of projects with their slugs and display names.
    """
    response.headers["Cache-Control"] = (
        "public, s-maxage=86400, stale-while-revalidate=3600"
    )
    projects = list_available_projects()
    return ProjectListResponse(
        projects=[ProjectInfo(**p) for p in projects], total=len(projects)
    )


async def _get_project_stats_internal(
    project: dict, days: int, filters: list[Filter] | None = None
) -> AllStats:
    """Internal business logic to fetch and merge stats for a single project."""
    filters = filters or []
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

    # 1. Load Vercel migration data and filter by days. The export only has
    # per-dimension totals, so filtered views leave it out entirely.
    if vercel_file and not filters:
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
        conditions = cloudflare_filters(filters, CF_DIMENSIONS)
        ts_task = fetch_cf_timeseries(cf_site_tag, query_days, conditions)
        breakdowns_task = fetch_cf_all_breakdowns(cf_site_tag, query_days, conditions)
        live_timeseries, live_breakdowns = await gather_queries(
            ts_task, breakdowns_task
        )

    elif ph_id and query_days > 90:
        # Long ranges go quarter by quarter; past quarters come from cache.
        live_timeseries, live_breakdowns = await fetch_history(
            ph_id, query_days, align=effective_days == 0, where=posthog_where(filters, PH_FIELDS)
        )

    elif ph_id:
        where = posthog_where(filters, PH_FIELDS)
        ts_task = fetch_timeseries_batched(ph_id, total_days=query_days, batch_days=90, where=where)
        breakdowns_task = fetch_all_breakdowns(ph_id, query_days, where=where)

        live_timeseries, live_breakdowns = await gather_queries(
            ts_task, breakdowns_task
        )

    # 3. Merge Vercel and live data
    merged_timeseries = merge_timeseries(filtered_vercel_timeseries, live_timeseries)
    merged_stats = merge_stats(filtered_vercel_stats, live_breakdowns)

    # 4. Build unified response
    return AllStats(
        metadata=Metadata(
            export_date=datetime.datetime.now(datetime.UTC),
            source=f"unified_{project_slug}",
            excludes_history=bool(filters and vercel_file and vercel_file.exists()),
        ),
        timeseries=merged_timeseries,
        stats=merged_stats,
    )


@router.get("/stats")
async def get_project_stats(
    response: Response,
    slugs: list[str] = Query(
        ...,
        max_length=8,
        description="List of project slugs to fetch",
    ),
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
    filter: list[str] = Query(
        default=[],
        max_length=MAX_FILTERS,
        description="Breakdown filters as field:value, e.g. country:🇮🇳 India. Filtered stats leave out Vercel migration history.",
    ),
):
    """
    Get unified analytics stats for one or multiple projects concurrently.
    """
    # Snapshot freshness is explicit in the body. Never CDN-cache failures or
    # a response saying a refresh is still running.
    response.headers["Cache-Control"] = "no-store"
    try:
        filters = parse_filters(filter)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    async def fetch_one(slug: str):
        project = get_project(slug)
        payload = await get_snapshot(
            f"stats:{slug}:{days}{cache_suffix(filters)}",
            lambda: _get_project_stats_internal(project, days, filters),
            refresh=refresh,
        )
        return {"slug": slug, **payload}

    # Validate before launching work, and avoid duplicate provider queries.
    unique_slugs = list(dict.fromkeys(slugs))
    for slug in unique_slugs:
        get_project(slug)
    return {
        "results": await gather_queries(*(fetch_one(slug) for slug in unique_slugs))
    }


@router.get("/timeseries")
async def get_project_timeseries(
    response: Response,
    slugs: list[str] = Query(
        ...,
        max_length=8,
        description="List of project slugs to fetch",
    ),
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
                "project": slug,
                "days": days,
                "timeseries": payload["data"]["timeseries"],
            }
        return {
            "slug": slug,
            **payload,
        }

    unique_slugs = list(dict.fromkeys(slugs))

    for slug in unique_slugs:
        get_project(slug)

    return {
        "results": await gather_queries(*(fetch_one(slug) for slug in unique_slugs))
    }

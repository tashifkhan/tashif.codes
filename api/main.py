"""
Multi-Project Analytics API

A unified API for fetching analytics data from multiple projects,
combining Vercel migration data with live PostHog data.

Endpoints:
- GET /api/v1/projects - List all available projects
- GET /api/v1/{project_slug}/stats - Get unified stats for a project
"""

import asyncio
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables BEFORE importing modules that depend on them
load_dotenv()

from config import PROJECT_REGISTRY, get_project_config, list_available_projects
from models import AllStats, Metadata, ProjectInfo, ProjectListResponse
from services import (
    fetch_timeseries,
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


POSTHOG_FALLBACK_DAYS = 90
CLOUDFLARE_EFFECTIVE_LOOKBACK_DAYS = 184

# --- APP SETUP ---
app = FastAPI(
    title="Multi-Project Analytics API",
    description="Unified analytics combining Vercel migration data with PostHog live data",
    version="1.0.0",
)

# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- ENDPOINTS ---


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "ok",
        "message": "Multi-Project Analytics API",
        "version": "1.0.0",
    }


@app.get("/api/v1/projects", response_model=ProjectListResponse)
async def get_projects():
    """
    List all projects available on this dashboard.

    Returns a list of projects with their slugs and display names.
    """
    projects = list_available_projects()
    return ProjectListResponse(
        projects=[ProjectInfo(**p) for p in projects], total=len(projects)
    )


@app.get("/api/v1/{project_slug}/stats", response_model=AllStats)
async def get_project_stats(
    project_slug: str,
    days: int = Query(
        default=30,
        ge=0,
        le=3650,
        description="Number of days to fetch data for (0 for lifetime)",
    ),
):
    """
    Get unified analytics stats for a specific project.

    Combines Vercel migration data with live PostHog data.

    Args:
        project_slug: The URL slug of the project (e.g., "portfolio", "blog")
        days: Number of days to look back (1-365, default: 30)

    Returns:
        AllStats object containing merged timeseries and breakdown stats
    """
    # Validate project exists
    config = get_project_config(project_slug)
    if config is None:
        raise HTTPException(
            status_code=404,
            detail=f"Project '{project_slug}' not found. Use /api/v1/projects to see available projects.",
        )

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

    # Filter Vercel data to match the requested day range (days=0 means lifetime/no filter)
    filter_days = effective_days if effective_days > 0 else None
    filtered_vercel_timeseries = filter_timeseries_by_date(
        vercel_data.timeseries, filter_days
    )
    filtered_vercel_stats = filter_stats_by_date(vercel_data.stats, filter_days)

    # 2. Fetch live analytics data based on provider
    live_timeseries = []
    live_breakdowns = {}

    # For lifetime (days=0), use a large target range.
    # PostHog timeseries is fetched in batches for reliability.
    query_days = effective_days if effective_days > 0 else 3650

    if analytics_provider == "cloudflare" and cf_site_tag:
        # Fetch from Cloudflare Web Analytics
        ts_task = fetch_cf_timeseries(cf_site_tag, query_days)
        breakdowns_task = fetch_cf_all_breakdowns(cf_site_tag, query_days)
        live_timeseries, live_breakdowns = await asyncio.gather(
            ts_task, breakdowns_task
        )
    elif ph_id:
        # Fetch from PostHog.
        # For lifetime, fetch in 90-day batches and merge.
        ts_task = (
            fetch_timeseries_batched(ph_id, total_days=query_days, batch_days=90)
            if effective_days == 0
            else fetch_timeseries(ph_id, query_days)
        )
        breakdowns_task = fetch_all_breakdowns(ph_id, query_days)
        live_timeseries, live_breakdowns = await asyncio.gather(
            ts_task, breakdowns_task
        )

        if query_days > POSTHOG_FALLBACK_DAYS and not live_timeseries:
            ts_task = fetch_timeseries(ph_id, POSTHOG_FALLBACK_DAYS)
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
            export_date=datetime.now(timezone.utc), source=f"unified_{project_slug}"
        ),
        timeseries=merged_timeseries,
        stats=merged_stats,
    )


@app.get("/api/v1/{project_slug}/timeseries")
async def get_project_timeseries(
    project_slug: str,
    days: int = Query(
        default=30,
        ge=0,
        le=3650,
        description="Number of days to fetch data for (0 for lifetime)",
    ),
):
    """
    Get only timeseries data for a specific project.

    This is a lighter endpoint when you only need the time-based data.
    """
    config = get_project_config(project_slug)
    if config is None:
        raise HTTPException(
            status_code=404, detail=f"Project '{project_slug}' not found."
        )

    ph_id = config["ph_id"]
    cf_site_tag = config.get("cf_site_tag", "")
    vercel_file = config.get("vercel_file")
    analytics_provider = config.get("analytics_provider", "posthog")

    effective_days = (
        CLOUDFLARE_EFFECTIVE_LOOKBACK_DAYS
        if analytics_provider == "cloudflare" and days == 0
        else days
    )

    # Load Vercel data and filter by days (days=0 means lifetime/no filter)
    filter_days = effective_days if effective_days > 0 else None
    vercel_data = load_vercel_data(vercel_file) if vercel_file else None
    vercel_ts = (
        filter_timeseries_by_date(vercel_data.timeseries, filter_days)
        if vercel_data
        else []
    )

    # Fetch live timeseries based on provider
    live_ts = []
    query_days = effective_days if effective_days > 0 else 3650

    if analytics_provider == "cloudflare" and cf_site_tag:
        live_ts = await fetch_cf_timeseries(cf_site_tag, query_days)
    elif ph_id:
        live_ts = (
            await fetch_timeseries_batched(ph_id, total_days=query_days, batch_days=90)
            if effective_days == 0
            else await fetch_timeseries(ph_id, query_days)
        )

        if query_days > POSTHOG_FALLBACK_DAYS and not live_ts:
            live_ts = await fetch_timeseries(ph_id, POSTHOG_FALLBACK_DAYS)

    # Merge and return
    merged = merge_timeseries(vercel_ts, live_ts)

    return {"project": project_slug, "days": days, "timeseries": merged}


# --- MAIN ENTRY POINT ---


def main():
    """Run the API server (for development)."""
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()

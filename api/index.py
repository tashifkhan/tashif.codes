"""
Multi-Project Analytics API

A unified API for fetching analytics data from multiple projects,
combining Vercel migration data with live PostHog data.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

import os
import sys

# Add the current directory to sys.path so Vercel can find local modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from routers.analytics import router as analytics_router

API_PREFIX = "/projects/stats/api"
CANONICAL_SITE_URL = "https://tashif.codes"

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

# --- ROUTES ---


def _health_payload(request: Request) -> dict:
    base_url = str(request.base_url).rstrip("/")
    canonical_health_url = f"{CANONICAL_SITE_URL}{API_PREFIX}"
    api_list_url = f"{CANONICAL_SITE_URL}{API_PREFIX}/v1/list"

    return {
        "status": "ok",
        "message": "Multi-Project Analytics API",
        "version": "1.0.0",
        "request_base_url": base_url,
        "health_url": canonical_health_url,
        "api_list_url": api_list_url,
    }


def _api_list_payload() -> dict:
    return {
        "service": "Multi-Project Analytics API",
        "version": "v1",
        "canonical_base": f"{CANONICAL_SITE_URL}{API_PREFIX}",
        "endpoints": [
            {
                "name": "Health",
                "method": "GET",
                "path": f"{API_PREFIX}",
                "full_url": f"{CANONICAL_SITE_URL}{API_PREFIX}",
                "description": "API health check and metadata.",
                "query_params": [],
            },
            {
                "name": "List APIs",
                "method": "GET",
                "path": f"{API_PREFIX}/v1/list",
                "full_url": f"{CANONICAL_SITE_URL}{API_PREFIX}/v1/list",
                "description": "List all available API endpoints and details.",
                "query_params": [],
            },
            {
                "name": "List Projects",
                "method": "GET",
                "path": f"{API_PREFIX}/v1/projects",
                "full_url": f"{CANONICAL_SITE_URL}{API_PREFIX}/v1/projects",
                "description": "List all supported project slugs and display names.",
                "query_params": [],
            },
            {
                "name": "Project Stats",
                "method": "GET",
                "path": f"{API_PREFIX}/v1/stats",
                "full_url": f"{CANONICAL_SITE_URL}{API_PREFIX}/v1/stats",
                "description": "Fetch merged analytics stats for one or more projects.",
                "query_params": [
                    {
                        "name": "slugs",
                        "type": "list[string]",
                        "required": True,
                        "example": "slugs=dashboard&slugs=blog",
                    },
                    {
                        "name": "days",
                        "type": "int",
                        "required": False,
                        "default": 30,
                        "range": "0..912",
                        "description": "0 means lifetime data.",
                    },
                    {
                        "name": "refresh",
                        "type": "bool",
                        "required": False,
                        "default": False,
                        "description": "Bypass caches and re-fetch live analytics.",
                    },
                ],
            },
            {
                "name": "Project Timeseries",
                "method": "GET",
                "path": f"{API_PREFIX}/v1/timeseries",
                "full_url": f"{CANONICAL_SITE_URL}{API_PREFIX}/v1/timeseries",
                "description": "Fetch merged timeseries data for one or more projects.",
                "query_params": [
                    {
                        "name": "slugs",
                        "type": "list[string]",
                        "required": True,
                        "example": "slugs=dashboard&slugs=blog",
                    },
                    {
                        "name": "days",
                        "type": "int",
                        "required": False,
                        "default": 30,
                        "range": "0..912",
                        "description": "0 means lifetime data.",
                    },
                    {
                        "name": "refresh",
                        "type": "bool",
                        "required": False,
                        "default": False,
                        "description": "Bypass caches and re-fetch live analytics.",
                    },
                ],
            },
        ],
    }


@app.get("/")
async def root(request: Request):
    """Health check endpoint (root)."""
    return _health_payload(request)


@app.get(API_PREFIX)
async def canonical_health(request: Request):
    """Health check endpoint at canonical API prefix."""
    return _health_payload(request)


@app.get(f"{API_PREFIX}/v1/list")
async def list_api_endpoints():
    """List all API endpoints and their usage details."""
    return _api_list_payload()


# Include modular routers
app.include_router(analytics_router, prefix=API_PREFIX)

# --- MAIN ENTRY POINT ---


def main():
    """Run the API server (for development)."""
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()

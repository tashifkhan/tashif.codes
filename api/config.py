"""
Project Registry Configuration

This file maps project slugs to their respective PostHog Project IDs
and local Vercel migration data files.

To add a new project:
1. Get the Project ID from PostHog (Settings -> Project Settings)
2. Add/move the Vercel migration JSON to the data/ folder
3. Add an entry to PROJECT_REGISTRY below
"""

import os
from pathlib import Path

# Base path for data files
DATA_DIR = Path(__file__).parent / "data"

# --- PROJECT REGISTRY ---
# Map project slugs to their respective metadata
# - ph_id: PostHog Project ID (get from PostHog Settings -> Project Settings)
# - vercel_file: Path to the Vercel migration JSON file
# - display_name: Human-readable name for the dashboard
PROJECT_REGISTRY = {
    "jiit-timetable-website": {
        "ph_id": os.getenv("PH_JIIT_TIMETABLE_ID", ""),
        "vercel_file": DATA_DIR / "jiit-timetable-website.json",
        "display_name": "JIIT Timetable Website",
    },
    "jiit-campus-updates": {
        "ph_id": os.getenv("PH_JIIT_CAMPUS_UPDATES_ID", ""),
        "vercel_file": DATA_DIR / "jiit-campus-updates.json",
        "display_name": "JIIT Placement",
    },
    "jportal": {
        "ph_id": "",  # Uses Cloudflare instead
        "cf_site_tag": os.getenv("CF_JPORTAL_SITE_TAG", ""),
        "vercel_file": DATA_DIR / "jportal.json",
        "display_name": "JPortal",
        "analytics_provider": "cloudflare",
    },
    "talentsync": {
        "ph_id": os.getenv("PH_TALENTSYNC_ID", ""),
        "vercel_file": DATA_DIR / "talentsync.json",
        "display_name": "TalentSync",
    },
    "dashboard": {
        "ph_id": os.getenv("PH_DASHBOARD_ID", ""),
        "vercel_file": DATA_DIR / "dashboard.json",
        "display_name": "tashif.codes",
    },
    "blog": {
        "ph_id": os.getenv("PH_BLOG_ID", ""),
        "vercel_file": DATA_DIR / "blog.json",
        "display_name": "Blog",
    },
    "portfolio": {
        "ph_id": os.getenv("PH_PORTFOLIO_ID", ""),
        "vercel_file": DATA_DIR / "portfolio.json",
        "display_name": "Portfolio Website",
    },
    "mooc-utils": {
        "ph_id": os.getenv("PH_MOOC_UTILS_ID", ""),
        "display_name": "MOOC Utils",
    },
}


def get_project_config(slug: str) -> dict | None:
    """Get configuration for a specific project by slug."""
    return PROJECT_REGISTRY.get(slug)


def list_available_projects() -> list[dict]:
    """List all available projects with their slugs and display names."""
    return [
        {"slug": slug, "name": config["display_name"]}
        for slug, config in PROJECT_REGISTRY.items()
    ]

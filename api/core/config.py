"""
Core Configuration Module
Uses pydantic-settings to manage environment variables and project registry.
"""

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

# Base path for data files
DATA_DIR = Path(__file__).parent.parent / "data"


class Settings(BaseSettings):
    """Application Settings using environment variables."""

    # PostHog IDs
    ph_jiit_timetable_id: str = Field(default="", validation_alias="PH_JIIT_TIMETABLE_ID")
    ph_jiit_campus_updates_id: str = Field(default="", validation_alias="PH_JIIT_CAMPUS_UPDATES_ID")
    ph_talentsync_id: str = Field(default="", validation_alias="PH_TALENTSYNC_ID")
    ph_dashboard_id: str = Field(default="", validation_alias="PH_DASHBOARD_ID")
    ph_blog_id: str = Field(default="", validation_alias="PH_BLOG_ID")
    ph_portfolio_id: str = Field(default="", validation_alias="PH_PORTFOLIO_ID")
    ph_mooc_utils_id: str = Field(default="", validation_alias="PH_MOOC_UTILS_ID")

    # Cloudflare Tags
    cf_jportal_site_tag: str = Field(default="", validation_alias="CF_JPORTAL_SITE_TAG")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


# Instantiate settings singleton
settings = Settings()

# --- PROJECT REGISTRY ---
PROJECT_REGISTRY = {
    "jiit-timetable-website": {
        "ph_id": settings.ph_jiit_timetable_id,
        "vercel_file": DATA_DIR / "jiit-timetable-website.json",
        "display_name": "JIIT Timetable Website",
    },
    "jiit-campus-updates": {
        "ph_id": settings.ph_jiit_campus_updates_id,
        "vercel_file": DATA_DIR / "jiit-campus-updates.json",
        "display_name": "JIIT Placement",
    },
    "jportal": {
        "ph_id": "",  # Uses Cloudflare instead
        "cf_site_tag": settings.cf_jportal_site_tag,
        "vercel_file": DATA_DIR / "jportal.json",
        "display_name": "JPortal",
        "analytics_provider": "cloudflare",
    },
    "talentsync": {
        "ph_id": settings.ph_talentsync_id,
        "vercel_file": DATA_DIR / "talentsync.json",
        "display_name": "TalentSync",
    },
    "dashboard": {
        "ph_id": settings.ph_dashboard_id,
        "vercel_file": DATA_DIR / "dashboard.json",
        "display_name": "tashif.codes",
    },
    "blog": {
        "ph_id": settings.ph_blog_id,
        "vercel_file": DATA_DIR / "blog.json",
        "display_name": "Blog",
    },
    "portfolio": {
        "ph_id": settings.ph_portfolio_id,
        "vercel_file": DATA_DIR / "portfolio.json",
        "display_name": "Portfolio Website",
    },
    "mooc-utils": {
        "ph_id": settings.ph_mooc_utils_id,
        "display_name": "MOOC Utils",
    },
}


def get_project_config(slug: str) -> dict | None:
    """Get configuration for a specific project by slug."""
    return PROJECT_REGISTRY.get(slug)


def list_available_projects() -> list[dict]:
    """List all available projects with their slugs and display names."""
    return [
        {
            "slug": slug,
            "name": config["display_name"],
        }
        for slug, config in PROJECT_REGISTRY.items()
    ]

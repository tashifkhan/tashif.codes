"""
Core Configuration Module
Uses pydantic-settings to manage environment variables and project registry.
"""

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AliasChoices, Field

# Base path for data files
DATA_DIR = Path(__file__).parent.parent / "data"


class Settings(BaseSettings):
    """Application Settings using environment variables."""

    # Shared analytics snapshots. Leave empty for instance-only local development.
    # The Vercel Upstash integration injects the KV_REST_API_* names.
    upstash_redis_rest_url: str = Field(
        default="",
        validation_alias=AliasChoices("UPSTASH_REDIS_REST_URL", "KV_REST_API_URL"),
    )
    upstash_redis_rest_token: str = Field(
        default="",
        validation_alias=AliasChoices("UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_TOKEN"),
    )

    # PostHog Configuration
    posthog_api_key: str = Field(default="", validation_alias="POSTHOG_API_KEY")
    posthog_base_url: str = Field(default="https://eu.posthog.com", validation_alias="POSTHOG_BASE_URL")

    # PostHog IDs
    ph_jiit_timetable_id: str = Field(default="", validation_alias="PH_JIIT_TIMETABLE_ID")
    ph_jiit_campus_updates_id: str = Field(default="", validation_alias="PH_JIIT_CAMPUS_UPDATES_ID")
    ph_talentsync_id: str = Field(default="", validation_alias="PH_TALENTSYNC_ID")
    ph_dashboard_id: str = Field(default="", validation_alias="PH_DASHBOARD_ID")
    ph_blog_id: str = Field(default="", validation_alias="PH_BLOG_ID")
    ph_portfolio_id: str = Field(default="", validation_alias="PH_PORTFOLIO_ID")
    ph_mooc_utils_id: str = Field(default="", validation_alias="PH_MOOC_UTILS_ID")

    # Cloudflare Configuration
    cloudflare_api_token: str = Field(default="", validation_alias="CLOUDFLARE_API_TOKEN")
    cloudflare_account_tag: str = Field(default="", validation_alias="CLOUDFLARE_ACCOUNT_TAG")
    # JPortal's own analytics proxy fills in its account tag, site tag, and token,
    # so JPortal stats need no Cloudflare credentials here. Set empty to query
    # Cloudflare directly with the token above.
    cloudflare_proxy_url: str = Field(
        default="https://jportal.jmut.de/api/analytics",
        validation_alias="CLOUDFLARE_PROXY_URL",
    )

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
    # The seven *-stats.tashif.codes APIs together. History is Vercel request
    # metrics (scripts/export_stats_apis.py): pageviews are requests, visitors
    # are unique client IPs per day, path is the API, referrer is the calling
    # site. Live per-request telemetry goes to Honeycomb, whose query API is
    # Enterprise-only, so this view is a dated snapshot.
    "stats-apis": {
        "ph_id": "",
        "vercel_file": DATA_DIR / "stats-apis.json",
        "display_name": "Coding Stats APIs",
        "labels": {
            "pageviews": "Requests",
            "visitors": "Unique IPs",
            "visitors_note": "Distinct client IPs, summed per day",
            "paths": "Top APIs",
            "referrers": "Calling Sites",
            "bounce": False,
        },
    },
    # The metro APIs, from the same Vercel export (--target delhi-metro-api /
    # blr-metro-api). Only /api/* calls count, and path is the endpoint.
    "delhi-metro-api": {
        "ph_id": "",
        "vercel_file": DATA_DIR / "delhi-metro-api.json",
        "display_name": "Delhi NCR Metro API",
        "labels": {
            "pageviews": "API calls",
            "visitors": "Unique IPs",
            "visitors_note": "Distinct client IPs, summed per day",
            "paths": "Top Endpoints",
            "referrers": "Calling Sites",
            "bounce": False,
        },
    },
    "blr-metro-api": {
        "ph_id": "",
        "vercel_file": DATA_DIR / "blr-metro-api.json",
        "display_name": "Namma Metro API",
        "labels": {
            "pageviews": "API calls",
            "visitors": "Unique IPs",
            "visitors_note": "Distinct client IPs, summed per day",
            "paths": "Top Endpoints",
            "referrers": "Calling Sites",
            "bounce": False,
        },
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
            "labels": config.get("labels"),
        }
        for slug, config in PROJECT_REGISTRY.items()
    ]

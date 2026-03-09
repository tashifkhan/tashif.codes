from fastapi import HTTPException
from core.config import get_project_config

def get_project(project_slug: str):
    """
    Dependency to fetch and validate project configuration.
    Raises a 404 HTTPException if the project is not found.
    """
    config = get_project_config(project_slug)
    if config is None:
        raise HTTPException(
            status_code=404, detail=f"Project '{project_slug}' not found."
        )
    return {
        "slug": project_slug,
        "config": config
    }

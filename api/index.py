"""
Multi-Project Analytics API

A unified API for fetching analytics data from multiple projects,
combining Vercel migration data with live PostHog data.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import os
import sys

# Add the current directory to sys.path so Vercel can find local modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from routers.analytics import router as analytics_router

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

@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "ok",
        "message": "Multi-Project Analytics API",
        "version": "1.0.0",
    }

# Include modular routers
app.include_router(analytics_router)

# --- MAIN ENTRY POINT ---

def main():
    """Run the API server (for development)."""
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

if __name__ == "__main__":
    main()

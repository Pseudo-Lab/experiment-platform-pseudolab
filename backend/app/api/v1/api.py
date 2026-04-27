from fastapi import APIRouter
from app.api.v1.endpoints import (
    status, experiments, dashboard, bug_reports,
    events, feature_flags, analytics, decisions, reflections,
)

api_router = APIRouter()
api_router.include_router(status.router,        prefix="/status",        tags=["status"])
api_router.include_router(experiments.router,   prefix="/experiments",   tags=["experiments"])
api_router.include_router(dashboard.router,     prefix="/dashboard",     tags=["dashboard"])
api_router.include_router(bug_reports.router,   prefix="/bug-reports",   tags=["bug-reports"])
api_router.include_router(events.router,        prefix="",               tags=["events"])
api_router.include_router(feature_flags.router, prefix="/feature-flags", tags=["feature-flags"])
api_router.include_router(analytics.router,     prefix="/analytics",     tags=["analytics"])
api_router.include_router(decisions.router,     prefix="",               tags=["decisions"])
api_router.include_router(reflections.router,   prefix="/reflections",   tags=["reflections"])

from fastapi import APIRouter
from app.core.config import settings

router = APIRouter()

@router.get("/")
async def get_status():
    return {
        "status": "connected",
        "version": settings.PROJECT_VERSION,
        "team": settings.TEAM_NAME,
        "message": "Backend is ready to lead the data valuation standard."
    }

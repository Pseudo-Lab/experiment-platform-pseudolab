from fastapi import APIRouter
from app.api.v1.endpoints import status, experiments

api_router = APIRouter()
api_router.include_router(status.router, prefix="/status", tags=["status"])
api_router.include_router(experiments.router, prefix="/experiments", tags=["experiments"])

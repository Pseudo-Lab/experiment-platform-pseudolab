from fastapi import APIRouter, HTTPException
from app.schemas.experiment_analytics import ExperimentAnalyticsResponse
from app.services.experiment_analytics import experiment_analytics_service

router = APIRouter()


@router.get("/{experiment_id}/analytics", response_model=ExperimentAnalyticsResponse)
async def get_experiment_analytics(experiment_id: str):
    """실험별 노출/전환 analytics 및 통계적 유의성 반환."""
    return await experiment_analytics_service.get_analytics(experiment_id)

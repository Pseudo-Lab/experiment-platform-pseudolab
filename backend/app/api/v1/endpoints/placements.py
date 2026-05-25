from typing import Optional

from fastapi import APIRouter, Query

from app.schemas.experiment_placement import ExperimentPlacementDecisionResponse
from app.services.experiment_placement import experiment_placement_service

router = APIRouter()


@router.get("/{placement_key}/decide", response_model=ExperimentPlacementDecisionResponse)
async def decide_placement(
    placement_key: str,
    project_id: str = Query(...),
    user_id: Optional[str] = Query(None),
):
    return await experiment_placement_service.decide_by_placement(placement_key, user_id, project_id)

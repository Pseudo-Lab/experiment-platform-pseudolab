from typing import List, Optional

from fastapi import APIRouter, Query

from app.schemas.experiment_placement import (
    ExperimentPlacementConfig,
    ExperimentPlacementConfigUpdate,
    ExperimentPlacementDecisionResponse,
)
from app.services.experiment_placement import experiment_placement_service

router = APIRouter()


@router.get("/{experiment_id}/placements", response_model=List[ExperimentPlacementConfig])
async def list_experiment_placement_configs(experiment_id: str):
    return await experiment_placement_service.list_configs(experiment_id)


@router.get("/{experiment_id}/placements/{placement_key}/decide", response_model=ExperimentPlacementDecisionResponse)
async def decide_experiment_placement(
    experiment_id: str,
    placement_key: str,
    project_id: str = Query(...),
    user_id: Optional[str] = Query(None),
    scenario: Optional[str] = Query(None),
):
    return await experiment_placement_service.decide(experiment_id, placement_key, user_id, project_id, scenario)


@router.get("/{experiment_id}/placements/{placement_key}/config", response_model=ExperimentPlacementConfig)
async def get_experiment_placement_config(experiment_id: str, placement_key: str):
    return await experiment_placement_service.get_config(experiment_id, placement_key)


@router.patch("/{experiment_id}/placements/{placement_key}/config", response_model=ExperimentPlacementConfig)
async def update_experiment_placement_config(
    experiment_id: str,
    placement_key: str,
    data: ExperimentPlacementConfigUpdate,
):
    return await experiment_placement_service.update_config(experiment_id, placement_key, data)

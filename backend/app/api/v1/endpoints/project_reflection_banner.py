from typing import Optional

from fastapi import APIRouter, Query

from app.schemas.project_reflection_banner import (
    ProjectReflectionBannerConfig,
    ProjectReflectionBannerConfigUpdate,
    ProjectReflectionBannerDecisionResponse,
)
from app.services.project_reflection_banner import project_reflection_banner_service

router = APIRouter()


@router.get("/decide", response_model=ProjectReflectionBannerDecisionResponse)
async def decide_project_reflection_banner(
    project_id: str = Query(...),
    user_id: Optional[str] = Query(None),
    scenario: Optional[str] = Query(None),
):
    return await project_reflection_banner_service.decide(user_id, project_id, scenario)


@router.get("/config/{experiment_id}", response_model=ProjectReflectionBannerConfig)
async def get_project_reflection_banner_config(experiment_id: str):
    return await project_reflection_banner_service.get_config(experiment_id)


@router.patch("/config/{experiment_id}", response_model=ProjectReflectionBannerConfig)
async def update_project_reflection_banner_config(
    experiment_id: str,
    data: ProjectReflectionBannerConfigUpdate,
):
    return await project_reflection_banner_service.update_config(experiment_id, data)

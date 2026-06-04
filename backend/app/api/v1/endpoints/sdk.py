from typing import Optional

from fastapi import APIRouter, Depends

from app.api.deps import get_project_from_api_key
from app.schemas.project import Project
from app.schemas.sdk import UnifiedDecideRequest, UnifiedDecideResponse
from app.services.feature_flag import feature_flag_service
from app.services.placement import placement_service

router = APIRouter()


@router.post("/decide", response_model=UnifiedDecideResponse)
async def unified_decide(
    body: UnifiedDecideRequest,
    project: Optional[Project] = Depends(get_project_from_api_key),
):
    """Unified decide endpoint for both feature flags (A/B test) and placements (quasi-experiment).

    Lookup order: feature_flags → placements.
    Returns a consistent { key, type, show, variant, payload } shape.
    """
    project_id = project.id if project else None

    # 1. Try feature flag first
    flag = await feature_flag_service.get(body.key, include_archived=False)
    if flag is not None:
        variant = await feature_flag_service.decide(
            body.key, body.user_id, track=body.track, project_id=project_id
        )
        return UnifiedDecideResponse(
            key=body.key,
            type="flag",
            show=variant != "control",
            variant=variant,
            payload=None,
        )

    # 2. Fall back to placement
    result = await placement_service.decide(
        body.key,
        user_id=body.user_id,
        role=body.role,
        cohort=body.cohort,
        scenario=body.scenario,
    )
    return UnifiedDecideResponse(
        key=body.key,
        type="placement",
        show=result.show,
        variant="treatment" if result.show else "control",
        payload={"completed": result.completed, "reason": result.reason},
    )

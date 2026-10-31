from typing import Optional
import json
from uuid import NAMESPACE_URL, uuid5

from app.db import d1

from fastapi import APIRouter, Depends, HTTPException, Response

from app.api.deps import get_project_from_api_key
from app.schemas.project import Project
from app.schemas.sdk import TrackingContext, UnifiedDecideRequest, UnifiedDecideResponse
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
        context = None
        experiment_id = None
        if body.event_model == "sdk_v1":
            if flag.project_id != project_id:
                raise HTTPException(status_code=403, detail="Matching project SDK key required")
            rows = await d1.query(
                """SELECT id FROM experiments WHERE flag_key = ?
                   AND project_id IS ? AND experiment_type = 'ab_test'
                   AND status = 'running' AND event_model = 'sdk_v1'""", [body.key, project_id],
            )
            if body.experiment_id:
                if body.experiment_id not in {row["id"] for row in rows}:
                    raise HTTPException(status_code=422, detail="Experiment is not running for this flag/project")
                experiment_id = body.experiment_id
            elif len(rows) == 1:
                experiment_id = rows[0]["id"]
            elif len(rows) > 1:
                raise HTTPException(status_code=409, detail="Specify experiment_id for this flag")
        variant = await feature_flag_service.decide(
            body.key, body.user_id, track=body.track if body.event_model is None else False, project_id=project_id
        )
        if body.event_model == "sdk_v1":
            context = TrackingContext(
                experiment_id=experiment_id, key=body.key, variant=variant,
                project_id=project_id, user_id=body.user_id,
                assignment_id=str(uuid5(NAMESPACE_URL, json.dumps(
                    [project_id, experiment_id, body.key, body.user_id, variant]))),
            )
        return UnifiedDecideResponse(
            key=body.key,
            type="flag",
            show=variant != "control",
            variant=variant,
            payload=flag.payload,
            tracking_context=context,
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


@router.get("/sdk/demo-config")
async def demo_config(response: Response):
    """Public SDK identifier for the bundled demo; never a server credential."""
    from app.services.project import project_service

    response.headers["Cache-Control"] = "no-store"
    project = await project_service.get("demo-app")
    if project is None:
        raise HTTPException(status_code=503, detail="Demo configuration unavailable")
    return {"api_key": project.api_key}

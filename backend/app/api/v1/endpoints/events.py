from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from app.schemas.event import EventCapture, ExperimentEvent, PersonIdentify
from app.schemas.project import Project
from app.services.event import event_service
from app.api.deps import get_project_from_api_key

router = APIRouter()


@router.post("/capture", status_code=202)
async def capture(
    data: EventCapture,
    project: Optional[Project] = Depends(get_project_from_api_key),
):
    project_id = project.id if project else None
    await event_service.capture(data, project_id=project_id)
    return {"success": True, "message": "accepted"}


@router.post("/events", status_code=202)
async def track_experiment_event(data: ExperimentEvent):
    """SDK가 직접 호출하는 실험 impression/conversion 이벤트 수집."""
    saved = await event_service.track_experiment_event(data)
    if not saved:
        raise HTTPException(status_code=502, detail="Failed to persist event")
    return {"success": True}


@router.post("/identify", status_code=200)
async def identify(data: PersonIdentify):
    await event_service.identify(data)
    return {"success": True, "message": "identified"}

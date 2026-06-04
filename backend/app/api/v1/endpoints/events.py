from fastapi import APIRouter, Depends
from typing import Optional
from app.schemas.event import EventCapture, PersonIdentify
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


@router.post("/identify", status_code=200)
async def identify(data: PersonIdentify):
    await event_service.identify(data)
    return {"success": True, "message": "identified"}

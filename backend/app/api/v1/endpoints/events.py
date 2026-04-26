from fastapi import APIRouter
from app.schemas.event import EventCapture, PersonIdentify
from app.services.event import event_service

router = APIRouter()


@router.post("/capture", status_code=202)
async def capture(data: EventCapture):
    await event_service.capture(data)
    return {"success": True, "message": "accepted"}


@router.post("/identify", status_code=200)
async def identify(data: PersonIdentify):
    await event_service.identify(data)
    return {"success": True, "message": "identified"}

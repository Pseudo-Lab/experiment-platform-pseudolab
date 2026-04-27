from fastapi import APIRouter, Query
from datetime import datetime
from typing import Optional, List
from app.schemas.analytics import (
    EventListResponse, TrendsResponse, FunnelResponse,
    RetentionResponse, FunnelRequest,
)
from app.services.analytics import analytics_service

router = APIRouter()


@router.get("/events", response_model=EventListResponse)
async def get_events(
    event_name: Optional[str] = Query(None),
    from_: Optional[datetime] = Query(None, alias="from"),
    to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    return await analytics_service.get_events(event_name, from_, to, page, limit)


@router.get("/event-names", response_model=List[str])
async def get_event_names():
    return await analytics_service.get_event_names()


@router.get("/trends", response_model=TrendsResponse)
async def get_trends(
    event_name: str = Query(...),
    from_: datetime = Query(..., alias="from"),
    to: datetime = Query(...),
    granularity: str = Query("day", pattern="^(day|week)$"),
):
    return await analytics_service.get_trends(event_name, from_, to, granularity)


@router.post("/funnels", response_model=FunnelResponse)
async def get_funnels(data: FunnelRequest):
    return await analytics_service.get_funnels(data.steps, data.from_, data.to)


@router.get("/retention", response_model=RetentionResponse)
async def get_retention(event_name: str = Query(...)):
    return await analytics_service.get_retention(event_name)

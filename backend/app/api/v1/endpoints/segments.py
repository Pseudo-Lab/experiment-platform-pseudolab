from typing import List

from fastapi import APIRouter, Path, Query

from app.schemas.segment import (
    SEGMENT_ID_PATTERN,
    Segment,
    SegmentCreate,
    SegmentMember,
    SegmentRefreshRequest,
    SegmentRefreshResponse,
)
from app.services.segment import segment_service

router = APIRouter()


@router.get("/", response_model=List[Segment])
async def list_segments():
    return await segment_service.list()


@router.post("/", response_model=Segment, status_code=201)
async def create_segment(data: SegmentCreate):
    return await segment_service.create(data)


@router.post("/{segment_id}/refresh", response_model=SegmentRefreshResponse)
async def refresh_segment(
    data: SegmentRefreshRequest | None = None,
    segment_id: str = Path(..., pattern=SEGMENT_ID_PATTERN),
):
    return await segment_service.refresh(segment_id, data or SegmentRefreshRequest())


@router.get("/{segment_id}/members", response_model=List[SegmentMember])
async def list_segment_members(
    segment_id: str = Path(..., pattern=SEGMENT_ID_PATTERN),
    limit: int = Query(default=100, ge=1, le=1000),
):
    return await segment_service.members(segment_id, limit)

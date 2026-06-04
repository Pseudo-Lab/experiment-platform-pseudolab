from typing import List, Optional

from fastapi import APIRouter, Path, Query

from app.schemas.placement import Placement, PlacementCreate, PlacementDecideResponse
from app.services.placement import placement_service

router = APIRouter()


@router.get("/", response_model=List[Placement])
async def list_placements(project_id: Optional[str] = Query(None)):
    return await placement_service.list(project_id=project_id)


@router.post("/", response_model=Placement, status_code=201)
async def create_placement(data: PlacementCreate):
    return await placement_service.create(data)


@router.get("/{key}", response_model=Placement)
async def get_placement(key: str = Path(...)):
    return await placement_service.get(key)


@router.delete("/{key}", status_code=204)
async def delete_placement(key: str = Path(...)):
    await placement_service.delete(key)


@router.get("/{key}/decide", response_model=PlacementDecideResponse)
async def decide_placement(
    key: str,
    user_id: str = Query(..., min_length=1),
    role: Optional[str] = Query(None),
    cohort: Optional[str] = Query(None),
    scenario: Optional[str] = Query(None),
):
    return await placement_service.decide(key, user_id=user_id, role=role, cohort=cohort, scenario=scenario)

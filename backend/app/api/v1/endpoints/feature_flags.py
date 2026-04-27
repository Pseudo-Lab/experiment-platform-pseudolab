from fastapi import APIRouter, Query
from typing import List
from app.schemas.feature_flag import FeatureFlag, FeatureFlagCreate, FeatureFlagUpdate, FlagDecision
from app.services.feature_flag import feature_flag_service

router = APIRouter()


@router.get("/decide", response_model=dict)
async def decide(flag_key: str = Query(...), user_id: str = Query(...)):
    variant = await feature_flag_service.decide(flag_key, user_id)
    return {"success": True, "data": {"variant": variant}}


@router.get("/", response_model=List[FeatureFlag])
async def list_flags():
    return await feature_flag_service.list()


@router.post("/", response_model=FeatureFlag, status_code=201)
async def create_flag(data: FeatureFlagCreate):
    return await feature_flag_service.create(data)


@router.patch("/{flag_key}", response_model=FeatureFlag)
async def update_flag(flag_key: str, data: FeatureFlagUpdate):
    return await feature_flag_service.update(flag_key, data)

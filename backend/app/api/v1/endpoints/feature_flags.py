from fastapi import APIRouter, Path, Query
from typing import List
from app.schemas.feature_flag import (
    FLAG_KEY_PATTERN,
    FeatureFlag,
    FeatureFlagCreate,
    FeatureFlagUpdate,
)
from app.schemas.feature_flag_rule import (
    RULE_ID_PATTERN,
    FeatureFlagRule,
    FeatureFlagRuleCreate,
    FeatureFlagRuleUpdate,
)
from app.services.feature_flag import feature_flag_service

router = APIRouter()


@router.get("/decide", response_model=dict)
async def decide(
    flag_key: str = Query(..., pattern=FLAG_KEY_PATTERN),
    user_id: str = Query(..., min_length=1),
):
    variant = await feature_flag_service.decide(flag_key, user_id)
    return {"success": True, "data": {"variant": variant}}


@router.get("/", response_model=List[FeatureFlag])
async def list_flags(include_archived: bool = Query(default=False)):
    return await feature_flag_service.list(include_archived=include_archived)


@router.post("/", response_model=FeatureFlag, status_code=201)
async def create_flag(data: FeatureFlagCreate):
    return await feature_flag_service.create(data)


@router.patch("/{flag_key}", response_model=FeatureFlag)
async def update_flag(data: FeatureFlagUpdate, flag_key: str = Path(..., pattern=FLAG_KEY_PATTERN)):
    return await feature_flag_service.update(flag_key, data)


@router.post("/{flag_key}/archive", response_model=FeatureFlag)
async def archive_flag(flag_key: str = Path(..., pattern=FLAG_KEY_PATTERN)):
    return await feature_flag_service.archive(flag_key)


@router.get("/{flag_key}/rules", response_model=List[FeatureFlagRule])
async def list_rules(flag_key: str = Path(..., pattern=FLAG_KEY_PATTERN)):
    return await feature_flag_service.list_rules(flag_key)


@router.post("/{flag_key}/rules", response_model=FeatureFlagRule, status_code=201)
async def create_rule(data: FeatureFlagRuleCreate, flag_key: str = Path(..., pattern=FLAG_KEY_PATTERN)):
    return await feature_flag_service.create_rule(flag_key, data)


@router.patch("/{flag_key}/rules/{rule_id}", response_model=FeatureFlagRule)
async def update_rule(
    data: FeatureFlagRuleUpdate,
    flag_key: str = Path(..., pattern=FLAG_KEY_PATTERN),
    rule_id: str = Path(..., pattern=RULE_ID_PATTERN),
):
    return await feature_flag_service.update_rule(flag_key, rule_id, data)

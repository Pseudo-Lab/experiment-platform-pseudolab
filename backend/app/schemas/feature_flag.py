from pydantic import BaseModel, Field
from datetime import datetime
from typing import Any, Optional

FLAG_KEY_PATTERN = r"^[a-z0-9][a-z0-9_-]{2,63}$"


class FeatureFlagCreate(BaseModel):
    flag_key: str = Field(..., pattern=FLAG_KEY_PATTERN)
    description: Optional[str] = None
    rollout_pct: int = Field(default=0, ge=0, le=100)
    enabled: bool = False
    product: Optional[str] = None
    project_id: Optional[str] = None
    payload: Optional[dict[str, Any]] = None


class FeatureFlagUpdate(BaseModel):
    description: Optional[str] = None
    rollout_pct: Optional[int] = Field(default=None, ge=0, le=100)
    enabled: Optional[bool] = None
    product: Optional[str] = None
    project_id: Optional[str] = None
    payload: Optional[dict[str, Any]] = None
    # forced_variant: 설정 시 rollout_pct/enabled 무시하고 이 값을 항상 반환.
    # None을 명시적으로 보내면 강제 적용을 해제할 수 있도록 sentinel 처리.
    forced_variant: Optional[str] = Field(default="__unset__")


class FeatureFlag(BaseModel):
    flag_key: str
    description: Optional[str] = None
    rollout_pct: int
    enabled: bool
    product: Optional[str] = None
    project_id: Optional[str] = None
    payload: Optional[dict[str, Any]] = None
    forced_variant: Optional[str] = None
    archived_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class FlagDecision(BaseModel):
    variant: str  # "treatment" | "control"

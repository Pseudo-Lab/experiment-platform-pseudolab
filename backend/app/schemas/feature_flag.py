from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class FeatureFlagCreate(BaseModel):
    flag_key: str
    description: Optional[str] = None
    rollout_pct: int = Field(default=0, ge=0, le=100)
    enabled: bool = False


class FeatureFlagUpdate(BaseModel):
    description: Optional[str] = None
    rollout_pct: Optional[int] = Field(default=None, ge=0, le=100)
    enabled: Optional[bool] = None


class FeatureFlag(BaseModel):
    flag_key: str
    description: Optional[str] = None
    rollout_pct: int
    enabled: bool
    created_at: datetime
    updated_at: datetime


class FlagDecision(BaseModel):
    variant: str  # "treatment" | "control"

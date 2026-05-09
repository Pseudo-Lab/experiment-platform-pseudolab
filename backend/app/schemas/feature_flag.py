from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

FLAG_KEY_PATTERN = r"^[a-z0-9][a-z0-9_-]{2,63}$"


class FeatureFlagCreate(BaseModel):
    flag_key: str = Field(..., pattern=FLAG_KEY_PATTERN)
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
    archived_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class FlagDecision(BaseModel):
    variant: str  # "treatment" | "control"

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.feature_flag import FLAG_KEY_PATTERN
from app.schemas.segment import SEGMENT_ID_PATTERN

RULE_ID_PATTERN = r"^[a-z0-9][a-z0-9_-]{2,63}$"
VARIANT_PATTERN = r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$"


class FeatureFlagRuleCreate(BaseModel):
    id: Optional[str] = Field(default=None, pattern=RULE_ID_PATTERN)
    priority: int = Field(default=100, ge=0)
    segment_id: Optional[str] = Field(default=None, pattern=SEGMENT_ID_PATTERN)
    rollout_pct: int = Field(default=100, ge=0, le=100)
    variant: str = Field(default="treatment", pattern=VARIANT_PATTERN)
    enabled: bool = True
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


class FeatureFlagRuleUpdate(BaseModel):
    priority: Optional[int] = Field(default=None, ge=0)
    segment_id: Optional[str] = Field(default=None, pattern=SEGMENT_ID_PATTERN)
    rollout_pct: Optional[int] = Field(default=None, ge=0, le=100)
    variant: Optional[str] = Field(default=None, pattern=VARIANT_PATTERN)
    enabled: Optional[bool] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


class FeatureFlagRule(BaseModel):
    id: str
    flag_key: str = Field(..., pattern=FLAG_KEY_PATTERN)
    priority: int
    segment_id: Optional[str] = None
    rollout_pct: int
    variant: str
    enabled: bool
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

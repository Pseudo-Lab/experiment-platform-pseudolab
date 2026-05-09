from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.feature_flag import FLAG_KEY_PATTERN


class FeatureFlagExposure(BaseModel):
    id: str
    flag_key: str = Field(..., pattern=FLAG_KEY_PATTERN)
    user_id: str
    variant: str
    reason: Optional[str] = None
    evaluated_at: datetime
    context_json: Optional[str] = None


class FeatureFlagExposureSummary(BaseModel):
    flag_key: str = Field(..., pattern=FLAG_KEY_PATTERN)
    from_: Optional[datetime] = Field(default=None, alias="from")
    to: Optional[datetime] = None
    total_exposures: int
    unique_users: int
    first_exposure_users: int
    variant_counts: dict[str, int]

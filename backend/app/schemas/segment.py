from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

SEGMENT_ID_PATTERN = r"^[a-z0-9][a-z0-9_-]{2,63}$"
SegmentSource = Literal["manual", "query"]


class SegmentCreate(BaseModel):
    id: str = Field(..., pattern=SEGMENT_ID_PATTERN)
    name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = None
    source: SegmentSource = "manual"
    query_name: Optional[str] = None
    rules_json: Optional[str] = None
    enabled: bool = True
    user_ids: List[str] = Field(default_factory=list)


class Segment(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    source: str
    query_name: Optional[str] = None
    rules_json: Optional[str] = None
    enabled: bool
    created_at: datetime
    updated_at: datetime
    member_count: int = 0


class SegmentRefreshRequest(BaseModel):
    user_ids: Optional[List[str]] = None
    reason: Optional[str] = "manual"


class SegmentRefreshResponse(BaseModel):
    segment_id: str
    refreshed_count: int
    source: str


class SegmentMember(BaseModel):
    segment_id: str
    user_id: str
    reason: Optional[str] = None
    refreshed_at: datetime

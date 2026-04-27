from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Any


class EventLogItem(BaseModel):
    id: int
    user_id: str
    cohort_id: Optional[str] = None
    event_name: str
    properties: Optional[Any] = None
    event_time: datetime
    created_at: datetime


class EventListResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[EventLogItem]


class TrendPoint(BaseModel):
    date: str
    count: int


class TrendsResponse(BaseModel):
    event_name: str
    granularity: str
    data: List[TrendPoint]


class FunnelStep(BaseModel):
    step: str
    users: int
    conversion_rate: Optional[float] = None


class FunnelRequest(BaseModel):
    steps: List[str]
    from_: Optional[datetime] = None
    to: Optional[datetime] = None

    class Config:
        populate_by_name = True


class FunnelResponse(BaseModel):
    steps: List[FunnelStep]


class RetentionCell(BaseModel):
    cohort_week: str
    week_num: int
    retained: int
    cohort_size: int
    retention_rate: float


class RetentionResponse(BaseModel):
    event_name: str
    data: List[RetentionCell]

from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Any


class EventCapture(BaseModel):
    user_id: str
    event_name: str
    properties: Optional[dict[str, Any]] = None
    timestamp: Optional[datetime] = None


class PersonIdentify(BaseModel):
    user_id: str
    cohort_id: Optional[str] = None
    cohort_name: Optional[str] = None
    team_name: Optional[str] = None
    role: Optional[str] = None


class EventLog(BaseModel):
    id: int
    user_id: str
    cohort_id: Optional[str] = None
    event_name: str
    properties: Optional[dict[str, Any]] = None
    event_time: datetime
    created_at: datetime


class Person(BaseModel):
    user_id: str
    cohort_id: Optional[str] = None
    cohort_name: Optional[str] = None
    team_name: Optional[str] = None
    role: Optional[str] = None
    updated_at: datetime

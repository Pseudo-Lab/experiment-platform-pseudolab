from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Any


class EventCapture(BaseModel):
    user_id: str
    event_name: str
    properties: Optional[dict[str, Any]] = None
    timestamp: Optional[datetime] = None
    # 확장 필드 (PLAT-1)
    event_id: Optional[str] = None       # 클라이언트 UUID — 멱등 적재 기준
    session_id: Optional[str] = None     # 세션 단위 분석
    experiment_id: Optional[str] = None  # 실험 ID (상위 컬럼)
    variant: Optional[str] = None        # variant (상위 컬럼)
    device: Optional[str] = None         # 디바이스 구분
    anon_id: Optional[str] = None        # 비로그인 식별자


class EventBatch(BaseModel):
    """배치 이벤트 수집 (POST /ingest/events)."""
    events: list[EventCapture]


class PersonIdentify(BaseModel):
    user_id: str
    cohort_id: Optional[str] = None
    cohort_name: Optional[str] = None
    team_name: Optional[str] = None
    role: Optional[str] = None
    traits: Optional[dict[str, Any]] = None


class EventLog(BaseModel):
    id: int
    user_id: str
    cohort_id: Optional[str] = None
    event_name: str
    properties: Optional[dict[str, Any]] = None
    event_time: datetime
    created_at: datetime


class ExperimentEvent(BaseModel):
    type: str
    key: str
    variant: str = 'unknown'
    url: Optional[str] = None
    user_id: str
    experiment_id: Optional[str] = None
    properties: Optional[dict[str, Any]] = None


class Person(BaseModel):
    user_id: str
    cohort_id: Optional[str] = None
    cohort_name: Optional[str] = None
    team_name: Optional[str] = None
    role: Optional[str] = None
    properties_json: Optional[dict[str, Any]] = None
    updated_at: datetime

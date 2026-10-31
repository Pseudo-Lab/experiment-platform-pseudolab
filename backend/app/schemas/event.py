from pydantic import BaseModel, model_validator
from datetime import datetime
from typing import Optional, Any, Literal
from app.schemas.sdk import ExposureContext


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
    tracking_context: Optional[ExposureContext] = None
    sdk_event_type: Optional[Literal["exposure", "click", "conversion"]] = None

    @model_validator(mode="after")
    def validate_sdk_event(self):
        context = self.tracking_context
        if context is None:
            if self.sdk_event_type is not None:
                raise ValueError("tracking_context required")
            return self
        if not self.event_id or not self.sdk_event_type:
            raise ValueError("event_id and sdk_event_type required")
        if (self.user_id, self.experiment_id, self.variant, self.session_id) != (
            context.user_id, context.experiment_id, context.variant, context.session_id
        ):
            raise ValueError("Event attribution must match tracking_context")
        if (self.sdk_event_type == "exposure") != (self.event_name == "exp_exposure"):
            raise ValueError("exp_exposure is reserved for exposure events")
        if self.sdk_event_type == "exposure" and self.event_id != context.impression_id:
            raise ValueError("Exposure event_id must equal impression_id")
        return self


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
    timestamp: Optional[datetime] = None  # 생략 시 서버 수신 시각


class Person(BaseModel):
    user_id: str
    cohort_id: Optional[str] = None
    cohort_name: Optional[str] = None
    team_name: Optional[str] = None
    role: Optional[str] = None
    properties_json: Optional[dict[str, Any]] = None
    updated_at: datetime

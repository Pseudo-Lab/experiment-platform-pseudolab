from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class TrackingContext(BaseModel):
    experiment_id: Optional[str] = None
    key: str = Field(min_length=1)
    variant: str = Field(min_length=1)
    project_id: Optional[str] = None
    source: Literal["sdk_v1"] = "sdk_v1"
    assignment_id: str = Field(min_length=1)
    user_id: str = Field(min_length=1)


class ExposureContext(TrackingContext):
    impression_id: str = Field(min_length=1)
    session_id: str = Field(min_length=1)


class UnifiedDecideRequest(BaseModel):
    key: str
    user_id: str
    role: Optional[str] = None
    cohort: Optional[str] = None
    scenario: Optional[str] = None
    track: bool = True
    event_model: Optional[Literal["sdk_v1"]] = None
    experiment_id: Optional[str] = None


class UnifiedDecideResponse(BaseModel):
    key: str
    type: Literal["flag", "placement"]
    show: bool
    variant: str
    payload: Optional[dict[str, Any]] = None
    tracking_context: Optional[TrackingContext] = None

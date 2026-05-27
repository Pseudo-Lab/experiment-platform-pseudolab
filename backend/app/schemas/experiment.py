import re

from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import datetime
from typing import Optional, List
from enum import Enum


class ExperimentStatus(str, Enum):
    DRAFT = "draft"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class ExperimentType(str, Enum):
    AB_TEST = "ab_test"
    QUASI_EXPERIMENT = "quasi_experiment"
    ROLLOUT = "rollout"


VALID_TRANSITIONS: dict[str, set[str]] = {
    ExperimentStatus.DRAFT:     {ExperimentStatus.RUNNING, ExperimentStatus.ARCHIVED},
    ExperimentStatus.RUNNING:   {ExperimentStatus.PAUSED, ExperimentStatus.COMPLETED, ExperimentStatus.ARCHIVED},
    ExperimentStatus.PAUSED:    {ExperimentStatus.RUNNING, ExperimentStatus.COMPLETED, ExperimentStatus.ARCHIVED},
    ExperimentStatus.COMPLETED: set(),
    ExperimentStatus.ARCHIVED:  set(),
}


# Variant schemas
class VariantCreate(BaseModel):
    name: str
    traffic_ratio: float = Field(..., ge=0, le=1)
    description: Optional[str] = None


class Variant(VariantCreate):
    id: str
    experiment_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# Experiment schemas
class ExperimentCreate(BaseModel):
    id: Optional[str] = None
    name: str
    hypothesis: Optional[str] = None
    expected_effect: Optional[str] = None
    primary_metric: Optional[str] = None
    completion_event: Optional[str] = None
    experiment_type: ExperimentType = ExperimentType.AB_TEST
    cohort_id: Optional[str] = None
    flag_key: Optional[str] = None
    owner_id: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    variants: List[VariantCreate] = []

    @field_validator("id")
    @classmethod
    def validate_experiment_id(cls, value: Optional[str]):
        if value is None:
            return value
        normalized = value.strip()
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,78}[a-z0-9]", normalized):
            raise ValueError("id는 영문 소문자, 숫자, 하이픈으로 된 3~80자 slug여야 합니다")
        return normalized

    @model_validator(mode="after")
    def check_create_contract(self):
        if self.variants:
            total = sum(v.traffic_ratio for v in self.variants)
            if abs(total - 1.0) > 0.01:
                raise ValueError(f"variants traffic_ratio 합계는 1.0이어야 합니다 (현재: {total:.2f})")
        if self.start_at and self.end_at and self.start_at >= self.end_at:
            raise ValueError("end_at은 start_at보다 이후여야 합니다")
        return self


class ExperimentUpdate(BaseModel):
    name: Optional[str] = None
    hypothesis: Optional[str] = None
    expected_effect: Optional[str] = None
    primary_metric: Optional[str] = None
    completion_event: Optional[str] = None
    experiment_type: Optional[ExperimentType] = None
    cohort_id: Optional[str] = None
    flag_key: Optional[str] = None
    status: Optional[ExperimentStatus] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    reflection_start_date: Optional[datetime] = None
    reflection_window_days: Optional[int] = None

    @model_validator(mode="after")
    def check_update_contract(self):
        if self.start_at and self.end_at and self.start_at >= self.end_at:
            raise ValueError("end_at은 start_at보다 이후여야 합니다")
        return self


class Experiment(BaseModel):
    id: str
    name: str
    hypothesis: Optional[str] = None
    expected_effect: Optional[str] = None
    primary_metric: Optional[str] = None
    completion_event: Optional[str] = None
    experiment_type: ExperimentType = ExperimentType.AB_TEST
    cohort_id: Optional[str] = None
    flag_key: Optional[str] = None
    status: ExperimentStatus
    owner_id: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    reflection_start_date: Optional[datetime] = None
    reflection_window_days: int = 7
    created_at: datetime
    updated_at: datetime
    variants: List[Variant] = []

    class Config:
        from_attributes = True


# Assignment schemas
class AssignmentResponse(BaseModel):
    experiment_id: str
    variant_id: str
    variant_name: str
    user_id: str
    assigned_at: datetime


# Experiment result schemas
class VariantResult(BaseModel):
    variant_id: str
    variant_name: str
    users: int
    conversions: int
    rate: float


class ExperimentResult(BaseModel):
    experiment_id: str
    primary_metric: Optional[str]
    treatment: Optional[VariantResult] = None
    control: Optional[VariantResult] = None
    uplift: Optional[float] = None
    probability_treatment_wins: Optional[float] = None
    srm_warning: bool = False
    sample_size: int
    message: Optional[str] = None

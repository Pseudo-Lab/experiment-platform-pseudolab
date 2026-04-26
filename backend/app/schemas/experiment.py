from pydantic import BaseModel, Field, model_validator
from datetime import datetime
from typing import Optional, List
from enum import Enum


class ExperimentStatus(str, Enum):
    DRAFT = "draft"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"


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
    name: str
    hypothesis: Optional[str] = None
    expected_effect: Optional[str] = None
    primary_metric: Optional[str] = None
    cohort_id: Optional[str] = None
    owner_id: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    variants: List[VariantCreate] = []

    @model_validator(mode="after")
    def check_traffic_ratio_sum(self):
        if self.variants:
            total = sum(v.traffic_ratio for v in self.variants)
            if abs(total - 1.0) > 0.01:
                raise ValueError(f"variants traffic_ratio 합계는 1.0이어야 합니다 (현재: {total:.2f})")
        return self


class ExperimentUpdate(BaseModel):
    name: Optional[str] = None
    hypothesis: Optional[str] = None
    expected_effect: Optional[str] = None
    primary_metric: Optional[str] = None
    cohort_id: Optional[str] = None
    status: Optional[ExperimentStatus] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    reflection_start_date: Optional[datetime] = None
    reflection_window_days: Optional[int] = None


class Experiment(BaseModel):
    id: str
    name: str
    hypothesis: Optional[str] = None
    expected_effect: Optional[str] = None
    primary_metric: Optional[str] = None
    cohort_id: Optional[str] = None
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

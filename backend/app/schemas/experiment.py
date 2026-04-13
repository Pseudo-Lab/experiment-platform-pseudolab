from pydantic import BaseModel, Field, model_validator
from datetime import datetime
from typing import Optional, List
from enum import Enum


class ExperimentStatus(str, Enum):
    DRAFT = "draft"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"


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
    status: Optional[ExperimentStatus] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None


class Experiment(BaseModel):
    id: str
    name: str
    hypothesis: Optional[str] = None
    status: ExperimentStatus
    owner_id: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
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

from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from enum import Enum

class ExperimentStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"

class ExperimentBase(BaseModel):
    name: str
    status: ExperimentStatus = ExperimentStatus.DRAFT

class ExperimentCreate(ExperimentBase):
    pass

class ExperimentUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[ExperimentStatus] = None

class Experiment(ExperimentBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True

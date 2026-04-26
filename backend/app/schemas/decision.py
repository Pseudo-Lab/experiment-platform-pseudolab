from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from enum import Enum


class DecisionType(str, Enum):
    SHIP = "SHIP"
    HOLD = "HOLD"
    ROLLBACK = "ROLLBACK"


class DecisionCreate(BaseModel):
    experiment_id: str
    decision: DecisionType
    reason: str
    decided_by: str


class Decision(BaseModel):
    id: str
    experiment_id: str
    decision: DecisionType
    reason: str
    decided_by: str
    decided_at: datetime


class LearningNoteCreate(BaseModel):
    experiment_id: str
    content: str
    created_by: Optional[str] = None


class LearningNote(BaseModel):
    id: str
    experiment_id: str
    content: str
    created_by: Optional[str] = None
    created_at: datetime

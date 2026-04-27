from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from enum import Enum


class ProjectType(str, Enum):
    RESEARCH = "research"
    IMPLEMENTATION = "implementation"
    PRESENTATION = "presentation"
    DOCUMENT = "document"
    OPENSOURCE = "opensource"


class ReflectionCreate(BaseModel):
    experiment_id: str
    user_id: str
    project_id: str
    project_type: ProjectType
    output_types: Optional[List[str]] = None
    response_good: Optional[str] = None
    response_blocked: Optional[str] = None
    response_goal: Optional[str] = None
    final_output_type: Optional[str] = None


class Reflection(BaseModel):
    id: str
    experiment_id: str
    user_id: str
    project_id: str
    project_type: ProjectType
    output_types: Optional[List[str]] = None
    response_good: Optional[str] = None
    response_blocked: Optional[str] = None
    response_goal: Optional[str] = None
    final_output_type: Optional[str] = None
    completed_at: datetime
    created_at: datetime


class ReflectionCheckResponse(BaseModel):
    submitted: bool
    completed_at: Optional[datetime] = None


class ProjectTypeSummary(BaseModel):
    type: str
    completed: int


class ReflectionSummary(BaseModel):
    total_completed: int
    by_project_type: List[ProjectTypeSummary]


class ReflectionWindowUpdate(BaseModel):
    reflection_start_date: Optional[datetime] = None
    reflection_window_days: int = 7

from enum import Enum
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ProjectReflectionBannerReason(str, Enum):
    NOT_AUTHENTICATED = "not_authenticated"
    NOT_S12_PROJECT = "not_s12_project"
    NOT_PROJECT_MEMBER = "not_project_member"
    UNSUPPORTED_ROLE = "unsupported_role"
    INACTIVE_MEMBERSHIP = "inactive_membership"
    OUTSIDE_REFLECTION_WINDOW = "outside_reflection_window"
    ALREADY_SUBMITTED = "already_submitted"
    EXPERIMENT_NOT_FOUND = "experiment_not_found"
    ELIGIBLE = "eligible"


class ProjectReflectionBannerLoggingContext(BaseModel):
    experiment_id: str
    banner_id: str
    project_id: str
    project_cohort: str
    user_project_role: str
    source: str


class ProjectReflectionBannerDecisionResponse(BaseModel):
    show: bool
    reason: ProjectReflectionBannerReason
    submitted: bool = False
    experiment_id: Optional[str] = None
    banner_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    target_url: Optional[str] = None
    logging_context: Optional[ProjectReflectionBannerLoggingContext] = None


class ProjectReflectionBannerConfig(BaseModel):
    experiment_id: str
    banner_id: str
    title: str
    description: str
    target_url: str
    source: str
    enabled: bool
    created_at: datetime
    updated_at: datetime


class ProjectReflectionBannerConfigUpdate(BaseModel):
    banner_id: Optional[str] = Field(None, min_length=1)
    title: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = Field(None, min_length=1)
    target_url: Optional[str] = Field(None, min_length=1)
    source: Optional[str] = Field(None, min_length=1)
    enabled: Optional[bool] = None

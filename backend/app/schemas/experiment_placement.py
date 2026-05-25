from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ExperimentPlacementReason(str, Enum):
    NOT_AUTHENTICATED = "not_authenticated"
    NOT_TARGET_COHORT = "not_target_cohort"
    NOT_PROJECT_MEMBER = "not_project_member"
    UNSUPPORTED_ROLE = "unsupported_role"
    INACTIVE_MEMBERSHIP = "inactive_membership"
    OUTSIDE_EXPOSURE_WINDOW = "outside_exposure_window"
    ALREADY_SUBMITTED = "already_submitted"
    EXPERIMENT_NOT_FOUND = "experiment_not_found"
    PLACEMENT_NOT_FOUND = "placement_not_found"
    ELIGIBLE = "eligible"


class ExperimentPlacementUI(BaseModel):
    id: str
    type: str
    title: str
    description: str
    target_url: str


class ExperimentPlacementLoggingContext(BaseModel):
    experiment_id: str
    placement_key: str
    ui_id: str
    ui_type: str
    project_id: str
    project_cohort: str
    user_project_role: str
    source: str


class ExperimentPlacementDecisionResponse(BaseModel):
    show: bool
    reason: ExperimentPlacementReason
    submitted: bool = False
    experiment_id: Optional[str] = None
    placement_key: Optional[str] = None
    ui: Optional[ExperimentPlacementUI] = None
    logging_context: Optional[ExperimentPlacementLoggingContext] = None


class ExperimentPlacementConfig(BaseModel):
    experiment_id: str
    placement_key: str
    ui_id: str
    ui_type: str
    title: str
    description: str
    target_url: str
    source: str
    target_cohort: str
    allowed_roles: list[str]
    enabled: bool
    created_at: datetime
    updated_at: datetime


class ExperimentPlacementConfigCreate(BaseModel):
    placement_key: str = Field(..., min_length=1)
    ui_id: str = Field(..., min_length=1)
    ui_type: str = Field("banner", min_length=1)
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    target_url: str = Field(..., min_length=1)
    source: str = Field("unknown", min_length=1)
    target_cohort: str = Field("*", min_length=1)
    allowed_roles: list[str] = Field(default_factory=list)
    enabled: bool = True


class ExperimentPlacementConfigUpdate(BaseModel):
    ui_id: Optional[str] = Field(None, min_length=1)
    ui_type: Optional[str] = Field(None, min_length=1)
    title: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = Field(None, min_length=1)
    target_url: Optional[str] = Field(None, min_length=1)
    source: Optional[str] = Field(None, min_length=1)
    target_cohort: Optional[str] = Field(None, min_length=1)
    allowed_roles: Optional[list[str]] = None
    enabled: Optional[bool] = None

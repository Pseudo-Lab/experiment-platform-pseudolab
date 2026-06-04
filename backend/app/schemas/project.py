from pydantic import BaseModel, Field
from typing import Literal, Optional

PROJECT_ID_PATTERN = r"^[a-z0-9][a-z0-9-]{1,39}$"


class ProjectCreate(BaseModel):
    id: str = Field(..., pattern=PROJECT_ID_PATTERN)
    name: str = Field(..., min_length=1, max_length=80)
    base_url: Optional[str] = None
    project_type: Literal['ab_test', 'quasi_experiment'] = 'ab_test'


class Project(BaseModel):
    id: str
    name: str
    base_url: Optional[str] = None
    project_type: Literal['ab_test', 'quasi_experiment'] = 'ab_test'
    created_at: str


class ProjectWithKey(Project):
    api_key: str


class ProjectUpdate(BaseModel):
    base_url: Optional[str] = None


class ProjectSdkStatus(BaseModel):
    project_id: str
    status: str  # "connected" | "not_connected"

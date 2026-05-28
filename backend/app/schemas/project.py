from pydantic import BaseModel, Field
from typing import Optional

PROJECT_ID_PATTERN = r"^[a-z0-9][a-z0-9-]{1,39}$"


class ProjectCreate(BaseModel):
    id: str = Field(..., pattern=PROJECT_ID_PATTERN)
    name: str = Field(..., min_length=1, max_length=80)


class Project(BaseModel):
    id: str
    name: str
    created_at: str


class ProjectWithKey(Project):
    api_key: str

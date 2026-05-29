from typing import List, Optional

from pydantic import BaseModel


class Placement(BaseModel):
    key: str
    name: str
    description: Optional[str] = None
    project_id: Optional[str] = None
    status: str = "active"
    target_cohort: Optional[str] = None
    allowed_roles: Optional[List[str]] = None
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class PlacementCreate(BaseModel):
    key: str
    name: str
    description: Optional[str] = None
    project_id: Optional[str] = None
    status: str = "active"
    target_cohort: Optional[str] = None
    allowed_roles: Optional[List[str]] = None
    start_at: Optional[str] = None
    end_at: Optional[str] = None


class PlacementDecideResponse(BaseModel):
    key: str
    show: bool
    completed: bool = False
    reason: Optional[str] = None

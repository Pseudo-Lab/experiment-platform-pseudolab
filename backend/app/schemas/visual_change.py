from pydantic import BaseModel
from typing import Optional


class VisualChangeCreate(BaseModel):
    flag_key: Optional[str] = None
    variant: str
    selector: str
    property: str
    value: str


class VisualChange(BaseModel):
    id: str
    project_id: str
    flag_key: Optional[str] = None
    variant: str
    selector: str
    property: str
    value: str
    created_at: str

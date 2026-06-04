from typing import Any, Literal, Optional

from pydantic import BaseModel


class UnifiedDecideRequest(BaseModel):
    key: str
    user_id: str
    role: Optional[str] = None
    cohort: Optional[str] = None
    scenario: Optional[str] = None
    track: bool = True


class UnifiedDecideResponse(BaseModel):
    key: str
    type: Literal["flag", "placement"]
    show: bool
    variant: str
    payload: Optional[dict[str, Any]] = None

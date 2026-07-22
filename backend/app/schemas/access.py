from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

from app.schemas.feature_flag import FLAG_KEY_PATTERN


AccessMode = Literal["private", "committee", "public"]
AccessDecisionReason = Literal[
    "not_authenticated",
    "access_mode_private",
    "not_committee",
    "allowed_committee",
    "allowed_public",
    "evaluation_error",
]


class AccessDecisionRequest(BaseModel):
    user_id: Optional[str] = Field(default=None, max_length=255)
    flag_key: str = Field(..., pattern=FLAG_KEY_PATTERN)
    route: Optional[str] = Field(default=None, max_length=512)

    @field_validator("user_id", "route")
    @classmethod
    def strip_optional_strings(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class AccessDecisionResponse(BaseModel):
    allow: bool
    access_mode: AccessMode
    reason: AccessDecisionReason

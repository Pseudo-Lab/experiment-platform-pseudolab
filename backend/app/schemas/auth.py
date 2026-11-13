from typing import Annotated
from pydantic import BaseModel, Field, StringConstraints


EmailAddress = Annotated[str, StringConstraints(
    strip_whitespace=True, to_lower=True, min_length=3, max_length=254,
    pattern=r"^[^\s@<>\x00-\x1f\x7f]+@[^\s@<>\x00-\x1f\x7f]+\.[^\s@<>\x00-\x1f\x7f]+$",
)]


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class AuthUser(BaseModel):
    username: str
    account_id: str | None = None
    is_admin: bool = True
    display_name: str | None = None
    email: str | None = None


class AuthStatus(BaseModel):
    authenticated: bool
    user: AuthUser | None = None

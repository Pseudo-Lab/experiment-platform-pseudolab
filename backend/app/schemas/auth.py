from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class AuthUser(BaseModel):
    username: str
    is_admin: bool = True


class AuthStatus(BaseModel):
    authenticated: bool
    user: AuthUser | None = None

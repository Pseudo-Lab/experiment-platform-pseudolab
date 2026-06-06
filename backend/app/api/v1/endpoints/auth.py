from fastapi import APIRouter, HTTPException, Request, Response, status

from app.core.auth import (
    create_session_token,
    get_session_user_from_request,
    verify_password,
)
from app.core.config import settings
from app.schemas.auth import AuthStatus, AuthUser, LoginRequest

router = APIRouter()


def _cookie_samesite() -> str:
    value = settings.AUTH_COOKIE_SAMESITE.lower()
    return value if value in {"lax", "strict", "none"} else "lax"


@router.post("/login", response_model=AuthStatus)
async def login(data: LoginRequest, response: Response):
    if not settings.ADMIN_USERNAME or not settings.ADMIN_PASSWORD_HASH:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin authentication is not configured",
        )
    if data.username != settings.ADMIN_USERNAME or not verify_password(data.password, settings.ADMIN_PASSWORD_HASH):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    token = create_session_token(data.username)
    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=token,
        max_age=settings.AUTH_SESSION_TTL_SECONDS,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=_cookie_samesite(),
        path="/",
    )
    return AuthStatus(authenticated=True, user=AuthUser(username=data.username))


@router.post("/logout", response_model=AuthStatus)
async def logout(response: Response):
    response.delete_cookie(key=settings.AUTH_COOKIE_NAME, path="/", samesite=_cookie_samesite())
    return AuthStatus(authenticated=False, user=None)


@router.get("/me", response_model=AuthStatus)
async def me(request: Request):
    user = get_session_user_from_request(request)
    if user is None:
        return AuthStatus(authenticated=False, user=None)
    return AuthStatus(authenticated=True, user=AuthUser(username=user.username))

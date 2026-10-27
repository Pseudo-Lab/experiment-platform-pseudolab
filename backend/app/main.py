import re

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.api import api_router
from app.core.auth import auth_is_configured, get_session_user_from_request
from app.core.config import settings
from app.core.account_sessions import resolve_session
from app.core.authorization import authorize_member
from app.core.sdk_scope import enforce_sdk_scope
from app.core.upload import UploadBodyLimitMiddleware

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="실험 분배 및 관리 포털을 위한 통합 백엔드 API",
    version=settings.PROJECT_VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

app.include_router(api_router, prefix=settings.API_V1_STR)
# Added before the auth middleware so unauthenticated bodies are never consumed.
app.add_middleware(UploadBodyLimitMiddleware, path=f"{settings.API_V1_STR}/bug-reports/upload")


def _is_public_api_path(path: str, method: str) -> bool:
    # These routes retain their existing SDK/API-key/Bearer contracts.
    relative_path = path.removeprefix(settings.API_V1_STR).rstrip("/")
    public_routes = {
        "GET": {"/openapi.json", "/status", "/auth/me", "/auth/providers", "/auth/google/start", "/auth/google/callback", "/feature-flags/decide", "/experiments/assignment", "/reflections/check"},
        "POST": {"/auth/login", "/auth/logout", "/capture", "/identify", "/decide", "/events", "/ingest/events", "/access/decide", "/reflections"},
    }
    if relative_path in public_routes.get(method, set()):
        return True
    return method == "GET" and any(re.fullmatch(pattern, relative_path) for pattern in (
        r"/placements/[^/]+/decide",
        r"/experiments/[^/]+/placements/[^/]+/decide",
        r"/experiments/[^/]+/assign/[^/]+",
    ))


@app.middleware("http")
async def require_admin_session(request: Request, call_next):
    path = request.url.path
    is_api = path == settings.API_V1_STR or path.startswith(settings.API_V1_STR + "/")
    public = _is_public_api_path(path, request.method)
    auth_action = path.startswith(f"{settings.API_V1_STR}/auth/")
    if is_api and request.method != "OPTIONS" and (not public or auth_action):
        origin = request.headers.get("origin")
        allowed_origins = {str(request.base_url).rstrip("/"), *settings.BACKEND_CORS_ORIGINS} - {"*"}
        if origin is not None and origin not in allowed_origins:
            return JSONResponse(status_code=403, content={"detail": "Untrusted request origin"},
                                headers={"Cache-Control": "no-store"})
    if is_api:
        try:
            request.state.auth_user = await resolve_session(request)
        except HTTPException as exc:
            return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail}, headers={"Cache-Control": "no-store"})
    if is_api and request.method != "OPTIONS" and not public:
        if not auth_is_configured() and not (request.state.auth_user and not request.state.auth_user.is_admin):
            return JSONResponse(status_code=503, content={"detail": "Admin authentication is not configured"},
                                headers={"Cache-Control": "no-store"})
        if get_session_user_from_request(request) is None:
            return JSONResponse(status_code=401, content={"detail": "Authentication required"},
                                headers={"Cache-Control": "no-store"})
    if is_api and not public and request.state.auth_user and not request.state.auth_user.is_admin:
        try:
            await authorize_member(request)
        except HTTPException as exc:
            return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail},
                                headers={"Cache-Control": "no-store"})
    if is_api and public and request.method != "OPTIONS":
        try:
            await enforce_sdk_scope(request)
        except HTTPException as exc:
            return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail},
                                headers={"Cache-Control": "no-store"})
    response = await call_next(request)
    if is_api and (not public or path.startswith(f"{settings.API_V1_STR}/auth/")):
        response.headers["Cache-Control"] = "no-store"
    return response

# CORS 설정
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

@app.get("/")
async def root():
    return {"message": f"{settings.PROJECT_NAME} API 서버가 작동 중입니다."}

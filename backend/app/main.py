from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.api import api_router
from app.core.auth import auth_is_configured, get_session_user_from_request
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="실험 분배 및 관리 포털을 위한 통합 백엔드 API",
    version=settings.PROJECT_VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS 설정
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR)


def _is_public_api_path(path: str) -> bool:
    public_exact_paths = {
        f"{settings.API_V1_STR}/openapi.json",
        f"{settings.API_V1_STR}/status",
        f"{settings.API_V1_STR}/status/",
        f"{settings.API_V1_STR}/capture",
        f"{settings.API_V1_STR}/identify",
        f"{settings.API_V1_STR}/feature-flags/decide",
    }
    if path in public_exact_paths:
        return True
    if path.startswith(f"{settings.API_V1_STR}/auth/"):
        return True
    return path.startswith(f"{settings.API_V1_STR}/experiments/") and "/assign/" in path


@app.middleware("http")
async def require_admin_session(request: Request, call_next):
    path = request.url.path
    if path.startswith(settings.API_V1_STR) and auth_is_configured() and not _is_public_api_path(path):
        if get_session_user_from_request(request) is None:
            return JSONResponse(status_code=401, content={"detail": "Authentication required"})
    return await call_next(request)

@app.get("/")
async def root():
    return {"message": f"{settings.PROJECT_NAME} API 서버가 작동 중입니다."}

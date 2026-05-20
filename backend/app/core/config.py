from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "가짜연구소 실험 플랫폼"
    PROJECT_VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    TEAM_NAME: str = "이니셔티브 (Initiative)"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["*"] # 실제 운영 시 구체화 필요

    # Admin auth
    ADMIN_USERNAME: str | None = None
    ADMIN_PASSWORD_HASH: str | None = None
    AUTH_SESSION_SECRET: str | None = None
    AUTH_SESSION_TTL_SECONDS: int = 60 * 60 * 12
    AUTH_COOKIE_NAME: str = "experiment_platform_session"
    AUTH_COOKIE_SECURE: bool = False
    AUTH_COOKIE_SAMESITE: str = "lax"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

settings = Settings()

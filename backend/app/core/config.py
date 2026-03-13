from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "가짜연구소 실험 플랫폼"
    PROJECT_VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    TEAM_NAME: str = "이니셔티브 (Initiative)"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["*"] # 실제 운영 시 구체화 필요

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

settings = Settings()

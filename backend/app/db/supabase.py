from typing import Optional
from supabase import create_client, Client
from app.core.config import settings


def get_supabase() -> Optional[Client]:
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        return None
    try:
        return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    except Exception:
        return None


supabase: Optional[Client] = get_supabase()

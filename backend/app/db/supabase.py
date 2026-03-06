from supabase import create_client, Client
from app.core.config import settings

def get_supabase() -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

supabase: Client = get_supabase()

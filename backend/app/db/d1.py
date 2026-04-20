import os
import httpx
from typing import Any, Optional

_ASYNC_CLIENT: Optional[httpx.AsyncClient] = None
_CACHE: dict[str, tuple[str, str]] = {}


def _get_endpoint(database_id: Optional[str] = None) -> Optional[tuple[str, str]]:
    if database_id is None:
        database_id = os.getenv("D1_DATABASE_ID")
    
    if not database_id:
        return None
        
    if database_id in _CACHE:
        return _CACHE[database_id]

    account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID")
    api_token = os.getenv("CLOUDFLARE_API_TOKEN")

    if not account_id or not api_token:
        return None

    endpoint = (
        f"https://api.cloudflare.com/client/v4/accounts/"
        f"{account_id}/d1/database/{database_id}/query"
    )
    _CACHE[database_id] = (endpoint, api_token)
    return _CACHE[database_id]


async def get_client() -> httpx.AsyncClient:
    global _ASYNC_CLIENT
    if _ASYNC_CLIENT is None:
        _ASYNC_CLIENT = httpx.AsyncClient(
            timeout=20.0,
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
        )
    return _ASYNC_CLIENT


async def query(sql: str, params: list[Any] | None = None, database_id: Optional[str] = None) -> list[dict[str, Any]]:
    cfg = _get_endpoint(database_id)
    if cfg is None:
        print(f"D1 Config missing for DB {database_id}: CLOUDFLARE_ACCOUNT_ID, API_TOKEN, or database_id")
        return []

    endpoint, api_token = cfg
    body: dict[str, Any] = {"sql": sql}
    if params:
        body["params"] = params

    try:
        client = await get_client()
        resp = await client.post(
            endpoint,
            headers={
                "Authorization": f"Bearer {api_token}",
                "Content-Type": "application/json",
            },
            json=body,
        )
        resp.raise_for_status()
        payload = resp.json()
        if not payload.get("success"):
            print(f"D1 Query Error: {payload.get('errors')}")
            return []
        result = payload.get("result") or []
        if not result:
            return []
        return result[0].get("results") or []
    except Exception as e:
        print(f"D1 Exception: {e}")
        return []


async def execute(sql: str, params: list[Any] | None = None, database_id: Optional[str] = None) -> bool:
    cfg = _get_endpoint(database_id)
    if cfg is None:
        print(f"D1 Config missing for DB {database_id}: CLOUDFLARE_ACCOUNT_ID, API_TOKEN, or database_id")
        return False

    endpoint, api_token = cfg
    body: dict[str, Any] = {"sql": sql}
    if params:
        body["params"] = params

    try:
        client = await get_client()
        resp = await client.post(
            endpoint,
            headers={
                "Authorization": f"Bearer {api_token}",
                "Content-Type": "application/json",
            },
            json=body,
        )
        resp.raise_for_status()
        payload = resp.json()
        if not payload.get("success"):
            print(f"D1 Execute Error: {payload.get('errors')}")
        return bool(payload.get("success"))
    except Exception as e:
        print(f"D1 Exception: {e}")
        return False

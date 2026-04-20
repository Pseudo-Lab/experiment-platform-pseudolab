import os
import httpx
from typing import Any, Optional

_ASYNC_CLIENT: Optional[httpx.AsyncClient] = None
_CACHE: Optional[tuple[str, str]] = None


def _get_endpoint() -> Optional[tuple[str, str]]:
    global _CACHE
    if _CACHE is not None:
        return _CACHE

    account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID")
    api_token = os.getenv("CLOUDFLARE_API_TOKEN")
    database_id = os.getenv("D1_DATABASE_ID")

    if not account_id or not api_token or not database_id:
        return None

    endpoint = (
        f"https://api.cloudflare.com/client/v4/accounts/"
        f"{account_id}/d1/database/{database_id}/query"
    )
    _CACHE = (endpoint, api_token)
    return _CACHE


async def get_client() -> httpx.AsyncClient:
    global _ASYNC_CLIENT
    if _ASYNC_CLIENT is None:
        _ASYNC_CLIENT = httpx.AsyncClient(
            timeout=20.0,
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
        )
    return _ASYNC_CLIENT


async def query(sql: str, params: list[Any] | None = None) -> list[dict[str, Any]]:
    cfg = _get_endpoint()
    if cfg is None:
        print("D1 Config missing: CLOUDFLARE_ACCOUNT_ID, API_TOKEN, or D1_DATABASE_ID")
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


async def execute(sql: str, params: list[Any] | None = None) -> bool:
    cfg = _get_endpoint()
    if cfg is None:
        print("D1 Config missing: CLOUDFLARE_ACCOUNT_ID, API_TOKEN, or D1_DATABASE_ID")
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

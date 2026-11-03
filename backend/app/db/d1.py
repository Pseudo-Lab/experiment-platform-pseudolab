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
            print("D1 query failed")
            return []
        result = payload.get("result") or []
        if not result:
            return []
        return result[0].get("results") or []
    except Exception as e:
        print("D1 storage unavailable")
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
            print("D1 execution failed")
        return bool(payload.get("success"))
    except Exception as e:
        print("D1 storage unavailable")
        return False


async def security_query(sql: str, params: list[Any] | None = None) -> list[dict[str, Any]]:
    """Fail closed without logging SQL, credentials, parameters or provider errors."""
    from fastapi import HTTPException

    cfg = _get_endpoint()
    if cfg is None:
        raise HTTPException(status_code=503, detail="Credential storage unavailable")
    try:
        endpoint, api_token = cfg
        client = await get_client()
        response = await client.post(
            endpoint, headers={"Authorization": f"Bearer {api_token}"},
            json={"sql": sql, "params": params or []},
        )
        response.raise_for_status()
        payload = response.json()
        result = payload.get("result")
        if payload.get("success") is not True or not isinstance(result, list) or len(result) != 1:
            raise ValueError("Invalid credential storage response")
        if (not isinstance(result[0], dict)
                or result[0].get("success") is not True
                or not isinstance(result[0].get("results"), list)
                or not all(isinstance(row, dict) for row in result[0]["results"])):
            raise ValueError("Invalid credential storage result")
        return result[0]["results"]
    except Exception:
        raise HTTPException(status_code=503, detail="Credential storage unavailable") from None


async def security_execute(sql: str, params: list[Any] | None = None) -> bool:
    """Require a fully validated statement result, including for no-row writes."""
    await security_query(sql, params)
    return True

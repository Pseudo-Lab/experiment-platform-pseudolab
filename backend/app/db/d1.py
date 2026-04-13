import os
import httpx
from typing import Any

_CACHE: tuple[str, str] | None = None


def _get_endpoint() -> tuple[str, str] | None:
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


def query(sql: str, params: list[Any] | None = None) -> list[dict[str, Any]]:
    cfg = _get_endpoint()
    if cfg is None:
        return []

    endpoint, api_token = cfg
    body: dict[str, Any] = {"sql": sql}
    if params:
        body["params"] = params

    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(
                endpoint,
                headers={
                    "Authorization": f"Bearer {api_token}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
        payload = resp.json()
        if not payload.get("success"):
            return []
        result = payload.get("result") or []
        if not result:
            return []
        return result[0].get("results") or []
    except Exception:
        return []


def execute(sql: str, params: list[Any] | None = None) -> bool:
    cfg = _get_endpoint()
    if cfg is None:
        return False

    endpoint, api_token = cfg
    body: dict[str, Any] = {"sql": sql}
    if params:
        body["params"] = params

    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(
                endpoint,
                headers={
                    "Authorization": f"Bearer {api_token}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
        payload = resp.json()
        return bool(payload.get("success"))
    except Exception:
        return False

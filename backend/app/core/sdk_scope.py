"""Preserve legacy consumers while requiring project credentials for owned resources."""
import re
from fastapi import HTTPException, Request
from app.core.authorization import resource_project
from app.core.config import settings
from app.db import d1


async def enforce_sdk_scope(request: Request) -> None:
    path = request.url.path.removeprefix(settings.API_V1_STR).rstrip("/")
    if path.startswith("/auth/") or path in {"/status", "/openapi.json"}:
        return
    api_key = request.headers.get("x-api-key")
    project_id = None
    owned_key = False
    if api_key:
        keys = await d1.security_query("SELECT id FROM projects WHERE api_key = ?", [api_key])
        if not keys:
            raise HTTPException(401, "Invalid API key")
        project_id = keys[0]["id"]
        owned_key = bool(await d1.security_query("SELECT 1 FROM project_owner WHERE project_id = ?", [project_id]))
    server_key = False
    if path == "/access/decide" and request.headers.get("authorization"):
        from app.api.deps import require_project_from_bearer_token
        server_project = await require_project_from_bearer_token(request)
        project_id = server_project.id
        owned_key = bool(await d1.security_query("SELECT 1 FROM project_owner WHERE project_id = ?", [project_id]))
        server_key = True
    user = request.state.auth_user
    if user and not user.is_admin:
        if not owned_key or not await d1.security_query(
            "SELECT 1 FROM project_owner WHERE project_id = ? AND account_id = ?", [project_id, user.account_id]
        ):
            raise HTTPException(403, "Use a credential for your own project")
    allowed = server_key or path in {"/capture", "/ingest/events", "/events", "/decide", "/feature-flags/decide", "/experiments/assignment"}
    allowed = allowed or bool(re.fullmatch(r"/experiments/[^/]+/assign/[^/]+", path))
    if owned_key and not allowed:
        raise HTTPException(403, "SDK key cannot access this resource")
    request.state.sdk_owned_project = project_id if owned_key else None
    payload = {}
    if request.method == "POST":
        try:
            payload = await request.json()
        except ValueError:
            return  # endpoint validates malformed requests
        if not isinstance(payload, dict):
            return
    references = []
    experiment_id = request.query_params.get("experiment_id")
    match = re.match(r"/experiments/([^/]+)/(?:assign|placements)/", path)
    if match:
        experiment_id = match[1]
    if experiment_id:
        references.append(("experiments", "id", experiment_id))
    placement = re.fullmatch(r"/placements/([^/]+)/decide", path)
    if placement:
        references.append(("placements", "key", placement[1]))
    flag_key = request.query_params.get("flag_key")
    if flag_key:
        references.append(("feature_flag", "flag_key", flag_key))
    # Both typed and JSON-property experiment references are consumed by legacy analytics.
    events = payload.get("events", [payload])
    if not isinstance(events, list):
        events = []
    for event in events:
        if not isinstance(event, dict):
            continue
        for data in [event, event.get("properties", {})]:
            if not isinstance(data, dict):
                continue
            if data.get("experiment_id"):
                references.append(("experiments", "id", data["experiment_id"]))
            for name in ("flag_key", "key", "placement_key"):
                if data.get(name):
                    references.append(("feature_flag", "flag_key", data[name]))
                    references.append(("placements", "key", data[name]))
    if path == "/decide" and payload.get("key"):
        # New keys must resolve to a flag within this project; never legacy placement fallback.
        if owned_key:
            if await resource_project("feature_flag", "flag_key", payload["key"]) != project_id:
                raise HTTPException(404, "Resource not found")
    for table, key, value in references:
        if not isinstance(value, str):
            raise HTTPException(422, "Invalid resource reference")
        rows = await d1.security_query(f"SELECT project_id FROM {table} WHERE {key} = ?", [value])
        if not rows:
            if owned_key and table == "experiments":
                raise HTTPException(404, "Resource not found")
            continue
        target = rows[0]["project_id"]
        target_owned = bool(await d1.security_query("SELECT 1 FROM project_owner WHERE project_id = ?", [target]))
        if (owned_key or target_owned) and (not project_id or project_id != target):
            raise HTTPException(404, "Resource not found")
        if target_owned and table == "feature_flag":
            if await d1.security_query("SELECT 1 FROM feature_flag_rule WHERE flag_key = ? AND segment_id IS NOT NULL", [value]):
                raise HTTPException(403, "Shared segment rules are administrator-only")

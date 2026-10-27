"""Explicit allowlist for public-account management; new routes deny by default."""
import re
from fastapi import HTTPException, Request
from app.db import d1
from app.core.config import settings


async def require_owned_project(account_id: str, project_id: str | None) -> None:
    if not project_id or not await d1.security_query(
        "SELECT 1 FROM project_owner WHERE project_id = ? AND account_id = ?", [project_id, account_id]
    ):
        raise HTTPException(404, "Resource not found")


async def resource_project(table: str, key: str, value: str) -> str | None:
    # Table and column names come exclusively from the policy below.
    rows = await d1.security_query(f"SELECT project_id FROM {table} WHERE {key} = ?", [value])
    if not rows:
        raise HTTPException(404, "Resource not found")
    return rows[0]["project_id"]


async def authorize_member(request: Request) -> None:
    user = request.state.auth_user
    path = request.url.path.removeprefix(settings.API_V1_STR).rstrip("/")
    method = request.method
    if path == "/projects" and method in {"GET", "POST"}:
        return
    match = re.fullmatch(r"/projects/([^/]+)(?:/(api-key|sdk-status|server-key))?", path)
    if match:
        await require_owned_project(user.account_id, match[1])
        if (match[2] is None and method in {"GET", "PATCH", "DELETE"}
                or match[2] in {"api-key", "sdk-status"} and method == "GET"
                or match[2] == "server-key" and method in {"POST", "DELETE"}):
            return
    roots = {"experiments": ("experiments", "id"), "feature-flags": ("feature_flag", "flag_key")}
    parts = path.strip("/").split("/")
    if parts[0] not in roots:
        raise HTTPException(403, "This resource requires the installation administrator")
    table, key = roots[parts[0]]
    body = {}
    if method in {"POST", "PATCH"}:
        try:
            body = await request.json()
        except ValueError:
            raise HTTPException(422, "Invalid JSON")
        if not isinstance(body, dict):
            raise HTTPException(422, "Expected an object")
    if len(parts) == 1:
        if method == "GET":
            return  # list handlers enforce owner filtering in SQL
        if method != "POST":
            raise HTTPException(403, "Unsupported operation")
        project_id = body.get("project_id")
    else:
        project_id = await resource_project(table, key, parts[1])
        suffix = "/".join(parts[2:])
        allowed = ({"": {"GET", "PATCH", "DELETE"}, "adopt-winner": {"POST"},
                    "visual-changes": {"GET", "POST"}}
                   if table == "experiments" else
                   {"": {"PATCH"}, "archive": {"POST"}, "restore": {"POST"},
                    "exposures": {"GET"}, "exposure-summary": {"GET"}, "rules": {"GET", "POST"}})
        if method not in allowed.get(suffix, set()):
            raise HTTPException(403, "This resource requires the installation administrator")
        if "project_id" in body and body["project_id"] != project_id:
            raise HTTPException(403, "Project reassignment is not allowed")
    await require_owned_project(user.account_id, project_id)
    if body.get("flag_key") and table == "experiments":
        if await resource_project("feature_flag", "flag_key", body["flag_key"]) != project_id:
            raise HTTPException(404, "Resource not found")
    if table == "experiments" and len(parts) > 1:
        rows = await d1.security_query("SELECT flag_key FROM experiments WHERE id = ?", [parts[1]])
        if rows and rows[0]["flag_key"]:
            if await resource_project("feature_flag", "flag_key", rows[0]["flag_key"]) != project_id:
                raise HTTPException(403, "Cross-project flag linkage is unavailable")
    # Segments/person properties are installation-wide in the legacy schema.
    if body.get("segment_id"):
        raise HTTPException(403, "Shared segments are administrator-only")
    if table == "feature_flag" and len(parts) > 1:
        shared = await d1.security_query("SELECT 1 FROM feature_flag_rule WHERE flag_key = ? AND segment_id IS NOT NULL", [parts[1]])
        if shared:
            raise HTTPException(403, "Shared segment rules are administrator-only")

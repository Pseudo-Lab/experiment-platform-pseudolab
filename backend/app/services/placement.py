import json
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException

from app.db import d1
from app.schemas.placement import Placement, PlacementCreate, PlacementDecideRequest, PlacementDecideResponse


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _parse_allowed_roles(raw_roles: Optional[str]) -> set:
    if not raw_roles:
        return set()
    try:
        parsed = json.loads(raw_roles)
    except (json.JSONDecodeError, TypeError):
        return set()
    if not isinstance(parsed, list):
        return set()
    return {str(r) for r in parsed if r}


class PlacementService:
    def _to_placement(self, row: dict) -> Placement:
        roles = sorted(_parse_allowed_roles(row.get("allowed_roles")))
        return Placement(
            key=row["key"],
            name=row["name"],
            description=row.get("description"),
            project_id=row.get("project_id"),
            status=row["status"],
            target_cohort=row.get("target_cohort"),
            allowed_roles=roles if roles else None,
            start_at=row.get("start_at"),
            end_at=row.get("end_at"),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
        )

    async def list(self, project_id: Optional[str] = None) -> List[Placement]:
        if project_id:
            rows = await d1.query(
                "SELECT * FROM placements WHERE project_id = ? ORDER BY created_at DESC",
                [project_id],
            )
        else:
            rows = await d1.query("SELECT * FROM placements ORDER BY created_at DESC")
        return [self._to_placement(row) for row in rows]

    async def get(self, key: str) -> Placement:
        rows = await d1.query("SELECT * FROM placements WHERE key = ?", [key])
        if not rows:
            raise HTTPException(status_code=404, detail="Placement not found")
        return self._to_placement(rows[0])

    async def create(self, data: PlacementCreate) -> Placement:
        rows = await d1.query("SELECT 1 FROM placements WHERE key = ?", [data.key])
        if rows:
            raise HTTPException(status_code=409, detail="Placement with this key already exists")
        now = datetime.now(timezone.utc).isoformat()
        ok = await d1.execute(
            """INSERT INTO placements
               (key, name, description, project_id, status, target_cohort, allowed_roles, start_at, end_at, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [
                data.key,
                data.name,
                data.description,
                data.project_id,
                data.status,
                data.target_cohort,
                json.dumps(data.allowed_roles) if data.allowed_roles is not None else None,
                data.start_at,
                data.end_at,
                now,
                now,
            ],
        )
        if not ok:
            raise HTTPException(status_code=502, detail="Failed to create placement")
        return await self.get(data.key)

    async def delete(self, key: str) -> None:
        rows = await d1.query("SELECT 1 FROM placements WHERE key = ?", [key])
        if not rows:
            raise HTTPException(status_code=404, detail="Placement not found")
        ok = await d1.execute("DELETE FROM placements WHERE key = ?", [key])
        if not ok:
            raise HTTPException(status_code=502, detail="Failed to delete placement")

    async def decide(self, key: str, req: PlacementDecideRequest) -> PlacementDecideResponse:
        rows = await d1.query("SELECT * FROM placements WHERE key = ?", [key])
        if not rows:
            return PlacementDecideResponse(key=key, show=False, reason="not_found")

        row = rows[0]
        if row.get("status") != "active":
            return PlacementDecideResponse(key=key, show=False, reason="inactive")

        now = datetime.now(timezone.utc)
        start_at = _parse_datetime(row.get("start_at"))
        end_at = _parse_datetime(row.get("end_at"))
        if start_at and now < start_at:
            return PlacementDecideResponse(key=key, show=False, reason="outside_window")
        if end_at and now >= end_at:
            return PlacementDecideResponse(key=key, show=False, reason="outside_window")

        target_cohort = (row.get("target_cohort") or "").strip()
        if target_cohort and target_cohort != "*":
            if req.cohort != target_cohort:
                return PlacementDecideResponse(key=key, show=False, reason="wrong_cohort")

        allowed_roles = _parse_allowed_roles(row.get("allowed_roles"))
        if allowed_roles and req.role not in allowed_roles:
            return PlacementDecideResponse(key=key, show=False, reason="wrong_role")

        completed = await self._has_completed(req.user_id)
        return PlacementDecideResponse(key=key, show=True, completed=completed, reason="active")

    async def _has_completed(self, user_id: str) -> bool:
        rows = await d1.query(
            "SELECT 1 FROM event_log WHERE user_id = ? AND event_name = ? LIMIT 1",
            [user_id, "project_reflection_submitted"],
        )
        return bool(rows)


placement_service = PlacementService()

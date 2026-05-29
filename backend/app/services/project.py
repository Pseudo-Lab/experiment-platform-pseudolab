import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import HTTPException
from app.schemas.project import Project, ProjectCreate, ProjectUpdate, ProjectWithKey
from app.db import d1


class ProjectService:

    async def list(self) -> List[ProjectWithKey]:
        rows = await d1.query("SELECT * FROM projects ORDER BY created_at DESC")
        return [ProjectWithKey(**row) for row in rows]

    async def get(self, project_id: str) -> Optional[ProjectWithKey]:
        rows = await d1.query("SELECT * FROM projects WHERE id = ?", [project_id])
        if not rows:
            return None
        return ProjectWithKey(**rows[0])

    async def get_by_api_key(self, api_key: str) -> Optional[Project]:
        rows = await d1.query("SELECT * FROM projects WHERE api_key = ?", [api_key])
        if not rows:
            return None
        return Project(**rows[0])

    async def sdk_status(self, project_id: str) -> dict:
        existing = await d1.query("SELECT 1 FROM projects WHERE id = ?", [project_id])
        if not existing:
            raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        events = await d1.query(
            "SELECT 1 FROM event_log WHERE project_id = ? AND created_at >= ? LIMIT 1",
            [project_id, cutoff],
        )
        exposures = await d1.query(
            "SELECT 1 FROM feature_flag_exposure WHERE project_id = ? AND evaluated_at >= ? LIMIT 1",
            [project_id, cutoff],
        )
        connected = bool(events or exposures)
        return {"project_id": project_id, "status": "connected" if connected else "not_connected"}

    async def delete(self, project_id: str) -> None:
        existing = await d1.query("SELECT 1 FROM projects WHERE id = ?", [project_id])
        if not existing:
            raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

        exp_refs = await d1.query(
            "SELECT 1 FROM experiments WHERE project_id = ? LIMIT 1", [project_id]
        )
        if exp_refs:
            raise HTTPException(
                status_code=409,
                detail=f"Cannot delete project '{project_id}': referenced by one or more experiments",
            )

        flag_refs = await d1.query(
            "SELECT 1 FROM feature_flag WHERE project_id = ? LIMIT 1", [project_id]
        )
        if flag_refs:
            raise HTTPException(
                status_code=409,
                detail=f"Cannot delete project '{project_id}': referenced by one or more feature flags",
            )

        await d1.execute("DELETE FROM projects WHERE id = ?", [project_id])

    async def create(self, data: ProjectCreate) -> ProjectWithKey:
        existing = await d1.query("SELECT 1 FROM projects WHERE id = ?", [data.id])
        if existing:
            raise HTTPException(status_code=409, detail=f"Project '{data.id}' already exists")

        api_key = f"pk_live_{data.id}_{secrets.token_hex(8)}"
        ok = await d1.execute(
            "INSERT INTO projects (id, name, api_key, base_url) VALUES (?, ?, ?, ?)",
            [data.id, data.name, api_key, data.base_url],
        )
        if not ok:
            raise HTTPException(status_code=500, detail="Database error: project insert failed")
        result = await self.get(data.id)
        if not result:
            raise HTTPException(status_code=500, detail="Project creation failed")
        return result

    async def update(self, project_id: str, data: ProjectUpdate) -> ProjectWithKey:
        existing = await self.get(project_id)
        if not existing:
            raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
        await d1.execute(
            "UPDATE projects SET base_url = ? WHERE id = ?",
            [data.base_url, project_id],
        )
        result = await self.get(project_id)
        if not result:
            raise HTTPException(status_code=500, detail="Update failed")
        return result


project_service = ProjectService()

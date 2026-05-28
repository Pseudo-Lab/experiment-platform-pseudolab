import secrets
from typing import List, Optional
from fastapi import HTTPException
from app.schemas.project import Project, ProjectCreate, ProjectWithKey
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

    async def create(self, data: ProjectCreate) -> ProjectWithKey:
        existing = await d1.query("SELECT 1 FROM projects WHERE id = ?", [data.id])
        if existing:
            raise HTTPException(status_code=409, detail=f"Project '{data.id}' already exists")

        api_key = f"pk_live_{data.id}_{secrets.token_hex(8)}"
        await d1.execute(
            "INSERT INTO projects (id, name, api_key) VALUES (?, ?, ?)",
            [data.id, data.name, api_key],
        )
        result = await self.get(data.id)
        if not result:
            raise HTTPException(status_code=500, detail="Project creation failed")
        return result


project_service = ProjectService()

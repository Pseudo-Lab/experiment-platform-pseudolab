import uuid
from typing import List, Optional
from fastapi import HTTPException
from app.schemas.visual_change import VisualChange, VisualChangeCreate
from app.db import d1


class VisualChangeService:

    async def list(self, project_id: str, variant: Optional[str] = None) -> List[VisualChange]:
        if variant:
            rows = await d1.query(
                "SELECT * FROM visual_changes WHERE project_id = ? AND variant = ? ORDER BY created_at",
                [project_id, variant],
            )
        else:
            rows = await d1.query(
                "SELECT * FROM visual_changes WHERE project_id = ? ORDER BY created_at",
                [project_id],
            )
        return [VisualChange(**row) for row in rows]

    async def create(self, project_id: str, data: VisualChangeCreate) -> VisualChange:
        change_id = str(uuid.uuid4())
        ok = await d1.execute(
            """INSERT INTO visual_changes (id, project_id, flag_key, variant, selector, property, value)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            [change_id, project_id, data.flag_key, data.variant, data.selector, data.property, data.value],
        )
        if not ok:
            raise HTTPException(status_code=500, detail="Database error: visual change insert failed")
        rows = await d1.query("SELECT * FROM visual_changes WHERE id = ?", [change_id])
        if not rows:
            raise HTTPException(status_code=500, detail="Visual change save failed")
        return VisualChange(**rows[0])

    async def delete(self, project_id: str, change_id: str) -> None:
        existing = await d1.query(
            "SELECT 1 FROM visual_changes WHERE id = ? AND project_id = ?",
            [change_id, project_id],
        )
        if not existing:
            raise HTTPException(status_code=404, detail=f"Visual change '{change_id}' not found")
        await d1.execute("DELETE FROM visual_changes WHERE id = ?", [change_id])


visual_change_service = VisualChangeService()

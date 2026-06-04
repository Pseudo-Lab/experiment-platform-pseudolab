import uuid
from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from app.schemas.visual_change import VisualChange, VisualChangeCreate
from app.db import d1


class VisualChangeService:

    async def list(self, experiment_id: str, variation_key: Optional[str] = None) -> List[VisualChange]:
        if variation_key:
            rows = await d1.query(
                "SELECT * FROM visual_changes WHERE experiment_id = ? AND variation_key = ? ORDER BY created_at",
                [experiment_id, variation_key],
            )
        else:
            rows = await d1.query(
                "SELECT * FROM visual_changes WHERE experiment_id = ? ORDER BY created_at",
                [experiment_id],
            )
        return [VisualChange(**row) for row in rows]

    async def list_by_flag_key(self, flag_key: str, variation_key: str) -> List[Dict[str, Any]]:
        rows = await d1.query(
            """SELECT vc.selector, vc.type, vc.value
               FROM visual_changes vc
               JOIN experiments e ON e.id = vc.experiment_id
               WHERE e.flag_key = ? AND vc.variation_key = ?
               ORDER BY vc.created_at""",
            [flag_key, variation_key],
        )
        return rows

    async def create(self, experiment_id: str, data: VisualChangeCreate) -> VisualChange:
        exp_rows = await d1.query("SELECT id FROM experiments WHERE id = ?", [experiment_id])
        if not exp_rows:
            raise HTTPException(status_code=404, detail=f"Experiment '{experiment_id}' not found")
        change_id = uuid.uuid4().hex
        ok = await d1.execute(
            """INSERT INTO visual_changes (id, experiment_id, variation_key, selector, type, value)
               VALUES (?, ?, ?, ?, ?, ?)""",
            [change_id, experiment_id, data.variation_key, data.selector, data.type, data.value],
        )
        if not ok:
            raise HTTPException(status_code=500, detail="Database error: visual change insert failed")
        rows = await d1.query("SELECT * FROM visual_changes WHERE id = ?", [change_id])
        if not rows:
            raise HTTPException(status_code=500, detail="Visual change save failed")
        return VisualChange(**rows[0])

    async def delete(self, change_id: str) -> None:
        existing = await d1.query("SELECT 1 FROM visual_changes WHERE id = ?", [change_id])
        if not existing:
            raise HTTPException(status_code=404, detail=f"Visual change '{change_id}' not found")
        await d1.execute("DELETE FROM visual_changes WHERE id = ?", [change_id])


visual_change_service = VisualChangeService()

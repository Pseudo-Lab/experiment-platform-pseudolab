import json
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException
from app.schemas.reflection import (
    ReflectionCreate, Reflection,
    ReflectionCheckResponse, ReflectionSummary, ProjectTypeSummary,
    ReflectionWindowUpdate,
)
from app.db import d1


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ReflectionService:

    async def submit(self, data: ReflectionCreate) -> Reflection:
        exp = await d1.query("SELECT id FROM experiments WHERE id = ?", [data.experiment_id])
        if not exp:
            raise HTTPException(status_code=404, detail="Experiment not found")

        existing = await d1.query(
            "SELECT id FROM reflection WHERE user_id = ? AND experiment_id = ?",
            [data.user_id, data.experiment_id],
        )
        if existing:
            raise HTTPException(status_code=409, detail="이미 이 실험에 회고를 제출했습니다")

        ref_id = str(uuid.uuid4())
        now = _now()
        output_types = json.dumps(data.output_types) if data.output_types else None

        await d1.execute(
            """INSERT INTO reflection
               (id, experiment_id, user_id, project_id, project_type, output_types,
                response_good, response_blocked, response_goal, final_output_type,
                completed_at, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [
                ref_id, data.experiment_id, data.user_id, data.project_id,
                data.project_type.value, output_types,
                data.response_good, data.response_blocked, data.response_goal,
                data.final_output_type, now, now,
            ],
        )
        rows = await d1.query("SELECT * FROM reflection WHERE id = ?", [ref_id])
        return self._to_reflection(rows[0])

    async def check(self, user_id: str, experiment_id: str) -> ReflectionCheckResponse:
        rows = await d1.query(
            "SELECT completed_at FROM reflection WHERE user_id = ? AND experiment_id = ?",
            [user_id, experiment_id],
        )
        if rows:
            return ReflectionCheckResponse(submitted=True, completed_at=rows[0]["completed_at"])
        return ReflectionCheckResponse(submitted=False)

    async def summary(self, experiment_id: str) -> ReflectionSummary:
        total_rows = await d1.query(
            "SELECT COUNT(*) as cnt FROM reflection WHERE experiment_id = ?",
            [experiment_id],
        )
        total = int(total_rows[0]["cnt"]) if total_rows else 0

        type_rows = await d1.query(
            """SELECT project_type, COUNT(*) as cnt
               FROM reflection WHERE experiment_id = ?
               GROUP BY project_type ORDER BY cnt DESC""",
            [experiment_id],
        )
        by_type = [ProjectTypeSummary(type=r["project_type"], completed=int(r["cnt"])) for r in type_rows]
        return ReflectionSummary(total_completed=total, by_project_type=by_type)

    async def update_reflection_window(self, experiment_id: str, data: ReflectionWindowUpdate) -> bool:
        exp = await d1.query("SELECT id FROM experiments WHERE id = ?", [experiment_id])
        if not exp:
            raise HTTPException(status_code=404, detail="Experiment not found")

        start_date = data.reflection_start_date.isoformat() if data.reflection_start_date else None
        return await d1.execute(
            """UPDATE experiments
               SET reflection_start_date = ?, reflection_window_days = ?, updated_at = ?
               WHERE id = ?""",
            [start_date, data.reflection_window_days, _now(), experiment_id],
        )

    def _to_reflection(self, row: dict) -> Reflection:
        raw_types = row.get("output_types")
        output_types: Optional[List[str]] = None
        if raw_types:
            try:
                output_types = json.loads(raw_types) if isinstance(raw_types, str) else raw_types
            except Exception:
                output_types = None

        return Reflection(
            id=row["id"],
            experiment_id=row["experiment_id"],
            user_id=row["user_id"],
            project_id=row["project_id"],
            project_type=row["project_type"],
            output_types=output_types,
            response_good=row.get("response_good"),
            response_blocked=row.get("response_blocked"),
            response_goal=row.get("response_goal"),
            final_output_type=row.get("final_output_type"),
            completed_at=row["completed_at"],
            created_at=row["created_at"],
        )


reflection_service = ReflectionService()

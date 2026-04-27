import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import HTTPException
from app.schemas.decision import DecisionCreate, Decision, LearningNoteCreate, LearningNote
from app.db import d1


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class DecisionService:

    async def create_decision(self, data: DecisionCreate) -> Decision:
        exp = await d1.query("SELECT id FROM experiments WHERE id = ?", [data.experiment_id])
        if not exp:
            raise HTTPException(status_code=404, detail="Experiment not found")

        decision_id = str(uuid.uuid4())
        now = _now()
        await d1.execute(
            """INSERT INTO decision_log (id, experiment_id, decision, reason, decided_by, decided_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            [decision_id, data.experiment_id, data.decision.value, data.reason, data.decided_by, now],
        )
        rows = await d1.query("SELECT * FROM decision_log WHERE id = ?", [decision_id])
        return self._to_decision(rows[0])

    async def list_decisions(self, experiment_id: str) -> List[Decision]:
        rows = await d1.query(
            "SELECT * FROM decision_log WHERE experiment_id = ? ORDER BY decided_at DESC",
            [experiment_id],
        )
        return [self._to_decision(r) for r in rows]

    async def create_learning_note(self, data: LearningNoteCreate) -> LearningNote:
        exp = await d1.query("SELECT id FROM experiments WHERE id = ?", [data.experiment_id])
        if not exp:
            raise HTTPException(status_code=404, detail="Experiment not found")

        note_id = str(uuid.uuid4())
        now = _now()
        await d1.execute(
            """INSERT INTO learning_note (id, experiment_id, content, created_by, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            [note_id, data.experiment_id, data.content, data.created_by, now],
        )
        rows = await d1.query("SELECT * FROM learning_note WHERE id = ?", [note_id])
        return self._to_note(rows[0])

    async def list_learning_notes(self, experiment_id: str) -> List[LearningNote]:
        rows = await d1.query(
            "SELECT * FROM learning_note WHERE experiment_id = ? ORDER BY created_at DESC",
            [experiment_id],
        )
        return [self._to_note(r) for r in rows]

    def _to_decision(self, row: dict) -> Decision:
        return Decision(
            id=row["id"],
            experiment_id=row["experiment_id"],
            decision=row["decision"],
            reason=row["reason"],
            decided_by=row["decided_by"],
            decided_at=row["decided_at"],
        )

    def _to_note(self, row: dict) -> LearningNote:
        return LearningNote(
            id=row["id"],
            experiment_id=row["experiment_id"],
            content=row["content"],
            created_by=row.get("created_by"),
            created_at=row["created_at"],
        )


decision_service = DecisionService()

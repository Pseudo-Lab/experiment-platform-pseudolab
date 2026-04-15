import hashlib
import uuid
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import HTTPException
from app.schemas.experiment import (
    Experiment, ExperimentCreate, ExperimentUpdate,
    Variant, AssignmentResponse, VALID_TRANSITIONS
)
from app.db import d1


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ExperimentService:

    async def get_all(self, status: str | None = None) -> List[Experiment]:
        sql = """
            SELECT e.*,
                   v.id          AS v_id,
                   v.name        AS v_name,
                   v.traffic_ratio,
                   v.description AS v_description,
                   v.created_at  AS v_created_at
            FROM experiments e
            LEFT JOIN experiment_variants v ON v.experiment_id = e.id
            {where}
            ORDER BY e.created_at DESC
        """
        if status:
            rows = d1.query(sql.format(where="WHERE e.status = ?"), [status])
        else:
            rows = d1.query(sql.format(where=""))

        # JOIN 결과를 실험별로 그룹핑
        experiments: dict[str, dict] = {}
        for row in rows:
            exp_id = row["id"]
            if exp_id not in experiments:
                experiments[exp_id] = {**row, "experiment_variants": []}
            if row["v_id"]:
                experiments[exp_id]["experiment_variants"].append({
                    "id": row["v_id"],
                    "experiment_id": exp_id,
                    "name": row["v_name"],
                    "traffic_ratio": row["traffic_ratio"],
                    "description": row["v_description"],
                    "created_at": row["v_created_at"],
                })
        return [self._to_experiment(exp) for exp in experiments.values()]

    async def get(self, experiment_id: str) -> Optional[Experiment]:
        rows = d1.query("SELECT * FROM experiments WHERE id = ?", [experiment_id])
        if not rows:
            return None
        row = rows[0]
        row["experiment_variants"] = d1.query(
            "SELECT * FROM experiment_variants WHERE experiment_id = ?",
            [experiment_id]
        )
        return self._to_experiment(row)

    async def create(self, data: ExperimentCreate) -> Experiment:
        exp_id = str(uuid.uuid4())
        now = _now()
        d1.execute(
            """INSERT INTO experiments
               (id, name, hypothesis, status, owner_id, start_at, end_at, created_at, updated_at)
               VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?)""",
            [
                exp_id, data.name, data.hypothesis, data.owner_id,
                data.start_at.isoformat() if data.start_at else None,
                data.end_at.isoformat() if data.end_at else None,
                now, now,
            ]
        )
        for v in data.variants:
            v_id = str(uuid.uuid4())
            d1.execute(
                """INSERT INTO experiment_variants
                   (id, experiment_id, name, traffic_ratio, description, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                [v_id, exp_id, v.name, v.traffic_ratio, v.description, now]
            )
        return await self.get(exp_id)

    async def update(self, experiment_id: str, data: ExperimentUpdate) -> Optional[Experiment]:
        patch = {k: v for k, v in data.model_dump().items() if v is not None}
        if not patch:
            return await self.get(experiment_id)

        if "status" in patch:
            current = await self.get(experiment_id)
            if not current:
                return None
            allowed = VALID_TRANSITIONS.get(current.status, set())
            if patch["status"] not in allowed:
                raise HTTPException(
                    status_code=422,
                    detail=f"'{current.status}' → '{patch['status']}' 전환은 허용되지 않습니다."
                )

        patch["updated_at"] = _now()

        set_clause = ", ".join(f"{k} = ?" for k in patch)
        values = list(patch.values()) + [experiment_id]
        d1.execute(
            f"UPDATE experiments SET {set_clause} WHERE id = ?",
            values
        )
        return await self.get(experiment_id)

    async def delete(self, experiment_id: str) -> bool:
        return d1.execute("DELETE FROM experiments WHERE id = ?", [experiment_id])

    async def assign(self, experiment_id: str, user_id: str) -> Optional[AssignmentResponse]:
        # 이미 할당된 경우 기존 결과 반환
        existing = d1.query(
            """SELECT a.*, v.name as variant_name
               FROM experiment_assignments a
               JOIN experiment_variants v ON a.variant_id = v.id
               WHERE a.experiment_id = ? AND a.user_id = ?""",
            [experiment_id, user_id]
        )
        if existing:
            row = existing[0]
            return AssignmentResponse(
                experiment_id=experiment_id,
                variant_id=row["variant_id"],
                variant_name=row["variant_name"],
                user_id=user_id,
                assigned_at=row["assigned_at"],
            )

        variants = d1.query(
            "SELECT * FROM experiment_variants WHERE experiment_id = ?",
            [experiment_id]
        )
        if not variants:
            return None

        # 해시 기반 결정론적 배정
        bucket = int(hashlib.sha256(f"{experiment_id}:{user_id}".encode()).hexdigest(), 16) % 100

        cumulative = 0
        selected = variants[-1]
        for v in variants:
            cumulative += int(float(v["traffic_ratio"]) * 100)
            if bucket < cumulative:
                selected = v
                break

        now = _now()
        d1.execute(
            """INSERT INTO experiment_assignments
               (experiment_id, variant_id, user_id, assigned_at)
               VALUES (?, ?, ?, ?)""",
            [experiment_id, selected["id"], user_id, now]
        )

        return AssignmentResponse(
            experiment_id=experiment_id,
            variant_id=selected["id"],
            variant_name=selected["name"],
            user_id=user_id,
            assigned_at=now,
        )

    def _to_experiment(self, row: dict) -> Experiment:
        variants = [
            Variant(
                id=v["id"],
                experiment_id=v["experiment_id"],
                name=v["name"],
                traffic_ratio=float(v["traffic_ratio"]),
                description=v.get("description"),
                created_at=v["created_at"],
            )
            for v in (row.get("experiment_variants") or [])
        ]
        return Experiment(
            id=row["id"],
            name=row["name"],
            hypothesis=row.get("hypothesis"),
            status=row["status"],
            owner_id=row.get("owner_id"),
            start_at=row.get("start_at"),
            end_at=row.get("end_at"),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            variants=variants,
        )


experiment_service = ExperimentService()

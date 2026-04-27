import hashlib
import uuid
import numpy as np
from scipy.stats import chi2_contingency
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import HTTPException
from app.schemas.experiment import (
    Experiment, ExperimentCreate, ExperimentUpdate,
    Variant, AssignmentResponse, VALID_TRANSITIONS,
    ExperimentResult, VariantResult,
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
            rows = await d1.query(sql.format(where="WHERE e.status = ?"), [status])
        else:
            rows = await d1.query(sql.format(where=""))

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
        rows = await d1.query("SELECT * FROM experiments WHERE id = ?", [experiment_id])
        if not rows:
            return None
        row = rows[0]
        row["experiment_variants"] = await d1.query(
            "SELECT * FROM experiment_variants WHERE experiment_id = ?",
            [experiment_id]
        )
        return self._to_experiment(row)

    async def create(self, data: ExperimentCreate) -> Experiment:
        exp_id = str(uuid.uuid4())
        now = _now()
        ok = await d1.execute(
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
        if not ok:
            raise HTTPException(status_code=500, detail="실험 생성에 실패했습니다")
        for v in data.variants:
            v_id = str(uuid.uuid4())
            await d1.execute(
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
        await d1.execute(
            f"UPDATE experiments SET {set_clause} WHERE id = ?",
            values
        )
        return await self.get(experiment_id)

    async def delete(self, experiment_id: str) -> bool:
        return await d1.execute("DELETE FROM experiments WHERE id = ?", [experiment_id])

    async def assign(self, experiment_id: str, user_id: str) -> Optional[AssignmentResponse]:
        # 이미 할당된 경우 기존 결과 반환
        existing = await d1.query(
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

        variants = await d1.query(
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
        await d1.execute(
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

    async def get_result(self, experiment_id: str) -> ExperimentResult:
        exp = await self.get(experiment_id)
        if not exp:
            raise HTTPException(status_code=404, detail="Experiment not found")

        if not exp.primary_metric:
            return ExperimentResult(
                experiment_id=experiment_id,
                primary_metric=None,
                sample_size=0,
                message="primary_metric이 설정되지 않았습니다",
            )

        assignments = await d1.query(
            """SELECT a.user_id, v.name as variant_name
               FROM experiment_assignments a
               JOIN experiment_variants v ON a.variant_id = v.id
               WHERE a.experiment_id = ?""",
            [experiment_id],
        )
        if not assignments:
            return ExperimentResult(
                experiment_id=experiment_id,
                primary_metric=exp.primary_metric,
                sample_size=0,
                message="배정된 사용자가 없습니다",
            )

        # variant별 사용자 그룹핑 (control / treatment 우선, 없으면 첫 두 variant)
        variant_users: dict[str, set[str]] = {}
        for a in assignments:
            vname = a["variant_name"]
            variant_users.setdefault(vname, set()).add(a["user_id"])

        variant_names = list(variant_users.keys())
        control_name = "control" if "control" in variant_users else variant_names[0]
        treatment_name = "treatment" if "treatment" in variant_users else (
            variant_names[1] if len(variant_names) > 1 else variant_names[0]
        )

        all_user_ids = [a["user_id"] for a in assignments]
        placeholders = ",".join("?" * len(all_user_ids))
        metric_rows = await d1.query(
            f"SELECT DISTINCT user_id FROM event_log WHERE event_name = ? AND user_id IN ({placeholders})",
            [exp.primary_metric] + all_user_ids,
        )
        converted_users = {r["user_id"] for r in metric_rows}

        c_users = variant_users.get(control_name, set())
        t_users = variant_users.get(treatment_name, set())
        c_total, t_total = len(c_users), len(t_users)
        c_success = len(c_users & converted_users)
        t_success = len(t_users & converted_users)

        if c_total == 0 or t_total == 0:
            return ExperimentResult(
                experiment_id=experiment_id,
                primary_metric=exp.primary_metric,
                sample_size=c_total + t_total,
                message="control 또는 treatment 사용자가 없습니다",
            )

        t_samples = np.random.beta(t_success + 1, (t_total - t_success) + 1, 10_000)
        c_samples = np.random.beta(c_success + 1, (c_total - c_success) + 1, 10_000)
        prob = float((t_samples > c_samples).mean())

        _, p_value, _, _ = chi2_contingency(
            [[t_total, c_total], [t_total + c_total, t_total + c_total]]
        )
        srm_warning = bool(p_value < 0.01)

        c_rate = c_success / c_total
        t_rate = t_success / t_total

        return ExperimentResult(
            experiment_id=experiment_id,
            primary_metric=exp.primary_metric,
            treatment=VariantResult(
                variant_id="",
                variant_name=treatment_name,
                users=t_total,
                conversions=t_success,
                rate=round(t_rate, 4),
            ),
            control=VariantResult(
                variant_id="",
                variant_name=control_name,
                users=c_total,
                conversions=c_success,
                rate=round(c_rate, 4),
            ),
            uplift=round(t_rate - c_rate, 4),
            probability_treatment_wins=round(prob, 4),
            srm_warning=srm_warning,
            sample_size=c_total + t_total,
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
            expected_effect=row.get("expected_effect"),
            primary_metric=row.get("primary_metric"),
            cohort_id=row.get("cohort_id"),
            status=row["status"],
            owner_id=row.get("owner_id"),
            start_at=row.get("start_at"),
            end_at=row.get("end_at"),
            reflection_start_date=row.get("reflection_start_date"),
            reflection_window_days=int(row.get("reflection_window_days") or 7),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            variants=variants,
        )


experiment_service = ExperimentService()

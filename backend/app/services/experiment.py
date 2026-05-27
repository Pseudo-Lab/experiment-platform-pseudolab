import hashlib
import json
import uuid
import numpy as np
from scipy.stats import chi2_contingency
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import HTTPException
from app.schemas.experiment import (
    Experiment, ExperimentCreate, ExperimentUpdate,
    ExperimentStatus, ExperimentType,
    Variant, AssignmentResponse, VALID_TRANSITIONS,
    ExperimentResult, VariantResult,
)
from app.db import d1


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _serialize_datetime(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _parse_variant_names(value: Optional[str]) -> List[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
        return [str(v) for v in parsed] if isinstance(parsed, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


class ExperimentService:

    async def get_all(self, status: str | None = None) -> List[Experiment]:
        if status:
            rows = await d1.query(
                "SELECT * FROM experiments WHERE status = ? ORDER BY created_at DESC",
                [status],
            )
        else:
            rows = await d1.query("SELECT * FROM experiments ORDER BY created_at DESC")
        return [await self._to_experiment(row) for row in rows]

    async def get(self, experiment_id: str) -> Optional[Experiment]:
        rows = await d1.query("SELECT * FROM experiments WHERE id = ?", [experiment_id])
        if not rows:
            return None
        return await self._to_experiment(rows[0])

    async def create(self, data: ExperimentCreate) -> Experiment:
        exp_id = data.id or str(uuid.uuid4())
        if data.id and await self.get(exp_id):
            raise HTTPException(status_code=409, detail="Experiment id already exists")

        if data.flag_key:
            await self._require_flag(data.flag_key)

        # variants는 단순 이름 배열로 저장. linked 실험은 flag rules에서 derive되므로
        # variant_names_json는 unlinked 실험의 진실 공급원.
        variant_names = [v.name for v in data.variants]
        variant_names_json = json.dumps(variant_names) if variant_names else None

        now = _now()
        ok = await d1.execute(
            """INSERT INTO experiments
               (id, name, hypothesis, expected_effect, primary_metric, completion_event,
                experiment_type, cohort_id, flag_key, variant_names_json,
                status, owner_id, start_at, end_at, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)""",
            [
                exp_id,
                data.name,
                data.hypothesis,
                data.expected_effect,
                data.primary_metric,
                data.completion_event,
                data.experiment_type.value,
                data.cohort_id,
                data.flag_key,
                variant_names_json,
                data.owner_id,
                _serialize_datetime(data.start_at),
                _serialize_datetime(data.end_at),
                now, now,
            ]
        )
        if not ok:
            raise HTTPException(status_code=500, detail="실험 생성에 실패했습니다")
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
            self._validate_running_preconditions(current, patch)

        if patch.get("flag_key"):
            await self._require_flag(patch["flag_key"])

        for field in ("start_at", "end_at", "reflection_start_date"):
            if field in patch and isinstance(patch[field], datetime):
                patch[field] = patch[field].isoformat()
        if "experiment_type" in patch and hasattr(patch["experiment_type"], "value"):
            patch["experiment_type"] = patch["experiment_type"].value
        if "status" in patch and hasattr(patch["status"], "value"):
            patch["status"] = patch["status"].value

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
            """SELECT * FROM experiment_assignments
               WHERE experiment_id = ? AND user_id = ?""",
            [experiment_id, user_id]
        )
        if existing:
            row = existing[0]
            return AssignmentResponse(
                experiment_id=experiment_id,
                variant_name=row["variant_name"],
                user_id=user_id,
                assigned_at=row["assigned_at"],
            )

        # Flag-linked experiment → flag decide가 단일 진실 공급원.
        exp_meta = await d1.query(
            "SELECT flag_key, variant_names_json FROM experiments WHERE id = ?",
            [experiment_id],
        )
        if not exp_meta:
            return None
        exp_row = exp_meta[0]

        if exp_row.get("flag_key"):
            from app.services.feature_flag import feature_flag_service  # avoid circular import
            await feature_flag_service.decide(exp_row["flag_key"], user_id)
            assigned = await d1.query(
                """SELECT * FROM experiment_assignments
                   WHERE experiment_id = ? AND user_id = ?""",
                [experiment_id, user_id]
            )
            if assigned:
                row = assigned[0]
                return AssignmentResponse(
                    experiment_id=experiment_id,
                    variant_name=row["variant_name"],
                    user_id=user_id,
                    assigned_at=row["assigned_at"],
                )
            # variant 이름 매칭 실패 시 레거시 폴백 (보통 발생 안 함)

        # Unlinked 실험: variant_names_json 기준 SHA256 결정론적 배정.
        variant_names = _parse_variant_names(exp_row.get("variant_names_json"))
        if not variant_names:
            return None

        bucket = int(hashlib.sha256(f"{experiment_id}:{user_id}".encode()).hexdigest(), 16) % len(variant_names)
        selected_name = variant_names[bucket]

        now = _now()
        await d1.execute(
            """INSERT INTO experiment_assignments
               (experiment_id, variant_name, user_id, assigned_at)
               VALUES (?, ?, ?, ?)""",
            [experiment_id, selected_name, user_id, now]
        )
        return AssignmentResponse(
            experiment_id=experiment_id,
            variant_name=selected_name,
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
            "SELECT user_id, variant_name FROM experiment_assignments WHERE experiment_id = ?",
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
                variant_name=treatment_name,
                users=t_total,
                conversions=t_success,
                rate=round(t_rate, 4),
            ),
            control=VariantResult(
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

    async def _to_experiment(self, row: dict) -> Experiment:
        # variants는 단일 정의 모델에 따라 동적으로 구성:
        # - linked: feature_flag_rule.variant + implicit "control"
        # - unlinked: variant_names_json
        exp_id = row["id"]
        flag_key = row.get("flag_key")
        if flag_key:
            rule_rows = await d1.query(
                """SELECT DISTINCT variant FROM feature_flag_rule
                    WHERE flag_key = ? AND enabled = 1""",
                [flag_key],
            )
            names = [r["variant"] for r in rule_rows if r["variant"] != "control"]
            names = ["control"] + names
        else:
            names = _parse_variant_names(row.get("variant_names_json"))

        variants = [Variant(name=name, experiment_id=exp_id) for name in names]

        return Experiment(
            id=row["id"],
            name=row["name"],
            hypothesis=row.get("hypothesis"),
            expected_effect=row.get("expected_effect"),
            primary_metric=row.get("primary_metric"),
            completion_event=row.get("completion_event"),
            experiment_type=row.get("experiment_type") or "ab_test",
            cohort_id=row.get("cohort_id"),
            flag_key=row.get("flag_key"),
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

    def _validate_running_preconditions(self, current: Experiment, patch: dict) -> None:
        """draft/paused → running 전환 시 사전 조건 검증.
        - primary_metric: 모든 type 필수 (없으면 결과 계산 불가)
        - flag_key: ab_test 필수 (quasi_experiment/rollout은 placement 기반이므로 예외)
        """
        next_status = patch["status"]
        if hasattr(next_status, "value"):
            next_status = next_status.value
        if next_status != ExperimentStatus.RUNNING.value:
            return

        next_primary_metric = patch.get("primary_metric", current.primary_metric)
        if not next_primary_metric:
            raise HTTPException(
                status_code=422,
                detail="실험을 running으로 전환하려면 primary_metric을 먼저 설정해야 합니다.",
            )

        next_experiment_type = patch.get("experiment_type", current.experiment_type)
        if hasattr(next_experiment_type, "value"):
            next_experiment_type = next_experiment_type.value
        next_flag_key = patch.get("flag_key", current.flag_key)
        if next_experiment_type == ExperimentType.AB_TEST.value and not next_flag_key:
            raise HTTPException(
                status_code=422,
                detail="A/B 테스트를 running으로 전환하려면 Feature Flag 연결이 필요합니다.",
            )

    async def _require_flag(self, flag_key: str) -> None:
        rows = await d1.query(
            "SELECT 1 FROM feature_flag WHERE flag_key = ? AND archived_at IS NULL",
            [flag_key],
        )
        if not rows:
            raise HTTPException(
                status_code=404,
                detail=f"Feature flag '{flag_key}'을(를) 찾을 수 없거나 아카이브 상태입니다",
            )


experiment_service = ExperimentService()

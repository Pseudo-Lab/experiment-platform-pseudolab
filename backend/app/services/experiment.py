import hashlib
import json
import os
import uuid
import numpy as np
from scipy.stats import chi2_contingency, chisquare
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import HTTPException
import math

from app.schemas.experiment import (
    Experiment, ExperimentCreate, ExperimentUpdate,
    ExperimentStatus, ExperimentType,
    Variant, AssignmentResponse, VALID_TRANSITIONS,
    ExperimentResult, VariantResult, GuardrailMetricResult,
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
        guardrail_metrics_json = json.dumps(data.guardrail_metrics) if data.guardrail_metrics else None

        now = _now()
        ok = await d1.execute(
            """INSERT INTO experiments
               (id, name, hypothesis, expected_effect, primary_metric, completion_event,
                experiment_type, cohort_id, flag_key, variant_names_json, product, project_id,
                status, owner_id, start_at, end_at, guardrail_metrics, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)""",
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
                data.product,
                data.project_id,
                data.owner_id,
                _serialize_datetime(data.start_at),
                _serialize_datetime(data.end_at),
                guardrail_metrics_json,
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
            await self._validate_running_preconditions(current, patch)

        if patch.get("flag_key"):
            await self._require_flag(patch["flag_key"])

        for field in ("start_at", "end_at", "reflection_start_date"):
            if field in patch and isinstance(patch[field], datetime):
                patch[field] = patch[field].isoformat()
        if "experiment_type" in patch and hasattr(patch["experiment_type"], "value"):
            patch["experiment_type"] = patch["experiment_type"].value
        if "status" in patch and hasattr(patch["status"], "value"):
            patch["status"] = patch["status"].value
        if "guardrail_metrics" in patch:
            val = patch["guardrail_metrics"]
            patch["guardrail_metrics"] = json.dumps(val) if val else None

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

    async def adopt_winner(self, experiment_id: str, variant: str) -> Experiment:
        """실험 완료 후 winning variant를 채택한다.

        1. experiments.winning_variant = variant, status = completed
        2. 연결된 feature_flag.forced_variant = variant (이후 모든 사용자가 winning variant를 받음)
        """
        exp = await self.get(experiment_id)
        if not exp:
            raise HTTPException(status_code=404, detail="Experiment not found")
        if exp.status not in (ExperimentStatus.RUNNING, ExperimentStatus.PAUSED, ExperimentStatus.COMPLETED):
            raise HTTPException(
                status_code=422,
                detail=f"'{exp.status}' 상태에서는 winning variant를 채택할 수 없습니다.",
            )

        now = _now()
        # 1. 실험 상태 업데이트
        await d1.execute(
            "UPDATE experiments SET status = 'completed', winning_variant = ?, updated_at = ? WHERE id = ?",
            [variant, now, experiment_id],
        )

        # 2. 연결된 Feature Flag에 forced_variant 설정
        if exp.flag_key:
            await d1.execute(
                "UPDATE feature_flag SET forced_variant = ?, updated_at = ? WHERE flag_key = ?",
                [variant, now, exp.flag_key],
            )

        updated = await self.get(experiment_id)
        if not updated:
            raise HTTPException(status_code=502, detail="adopt_winner: experiment not found after update")
        return updated

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
            "SELECT flag_key, variant_names_json, kill_switch FROM experiments WHERE id = ?",
            [experiment_id],
        )
        if not exp_meta:
            return None
        exp_row = exp_meta[0]

        # kill_switch = 1 이면 무조건 control 반환 (긴급 차단)
        if exp_row.get("kill_switch"):
            return AssignmentResponse(
                experiment_id=experiment_id,
                variant_name="control",
                user_id=user_id,
                assigned_at=_now(),
            )

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

        # ── 준실험 전용 경로: event_log 노출 + dl_reflection 전환 기준 ──
        if exp.experiment_type == ExperimentType.QUASI_EXPERIMENT:
            return await self._get_quasi_result(exp, experiment_id)

        # ── 분모 결정: exp_exposure 이벤트 우선, 없으면 experiment_assignments 폴백 ──
        # 분모는 "배정"이 아닌 "실제 노출"이어야 정확한 CTR/전환율 계산 가능.
        # exp_exposure 이벤트에는 properties.variant 가 필수(control|treatment).
        exposure_rows = await d1.query(
            """SELECT user_id,
                      json_extract(properties, '$.variant') AS variant
                 FROM event_log
                WHERE event_name = 'exp_exposure'
                  AND json_extract(properties, '$.experiment_id') = ?
                GROUP BY user_id""",
            [experiment_id],
        )

        denominator_source: str
        variant_users: dict[str, set[str]] = {}

        if exposure_rows:
            # 노출 이벤트 기반 분모
            denominator_source = "exposure"
            for r in exposure_rows:
                v = (r.get("variant") or "unknown").strip()
                variant_users.setdefault(v, set()).add(r["user_id"])
        else:
            # exp_exposure 이벤트가 없으면 분석을 수행하지 않는다.
            # assignment 기반 폴백은 실제 노출을 반영하지 않아 SRM·CTR 수치가 왜곡됨.
            # luvp에서 exp_exposure 이벤트(properties: {experiment_id, variant}) 연동 후 분석 시작.
            return ExperimentResult(
                experiment_id=experiment_id,
                primary_metric=exp.primary_metric,
                sample_size=0,
                denominator_source="exposure",
                message="exp_exposure 이벤트 수집 전입니다. luvp에서 exp_exposure 이벤트 연동 후 분석이 시작됩니다.",
            )

        if not variant_users:
            return ExperimentResult(
                experiment_id=experiment_id,
                primary_metric=exp.primary_metric,
                sample_size=0,
                denominator_source=denominator_source,
                message="exp_exposure 이벤트에 유효한 variant 값이 없습니다. properties.variant(control|treatment) 확인이 필요합니다.",
            )

        variant_names = list(variant_users.keys())
        control_name = "control" if "control" in variant_users else variant_names[0]
        treatment_name = "treatment" if "treatment" in variant_users else (
            variant_names[1] if len(variant_names) > 1 else variant_names[0]
        )

        # ── 전환 유저 조회 (primary_metric 이벤트 발생 여부) ──
        all_user_ids = list({uid for uids in variant_users.values() for uid in uids})
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
                denominator_source=denominator_source,
                message="control 또는 treatment 사용자가 없습니다",
            )

        # ── Bayesian 확률 (Beta-Binomial) ──
        t_samples = np.random.beta(t_success + 1, (t_total - t_success) + 1, 10_000)
        c_samples = np.random.beta(c_success + 1, (c_total - c_success) + 1, 10_000)
        prob = float((t_samples > c_samples).mean())

        # ── SRM 검정: χ² goodness-of-fit (기대 50:50) — 임계값 p < 0.001 ──
        total = c_total + t_total
        expected_each = total / 2.0
        _, srm_p = chisquare([t_total, c_total], f_exp=[expected_each, expected_each])
        srm_warning = bool(srm_p < 0.001)

        c_rate = c_success / c_total
        t_rate = t_success / t_total
        uplift = round(t_rate - c_rate, 4)

        # ── 95% 신뢰구간 (정규 근사, Δ%p) ──────────────────────────────────────
        se = math.sqrt(
            (c_rate * (1 - c_rate) / c_total) +
            (t_rate * (1 - t_rate) / t_total)
        ) if c_total > 0 and t_total > 0 else 0.0
        ci_lo = round(uplift - 1.96 * se, 4)
        ci_hi = round(uplift + 1.96 * se, 4)

        # ── 가드레일 지표 계산 ──────────────────────────────────────────────────
        guardrail_results: list[GuardrailMetricResult] | None = None
        if exp.guardrail_metrics:
            guardrail_results = []
            for gm in exp.guardrail_metrics:
                gm_rows = await d1.query(
                    f"SELECT DISTINCT user_id FROM event_log WHERE event_name = ? AND user_id IN ({placeholders})",
                    [gm] + all_user_ids,
                )
                gm_converted = {r["user_id"] for r in gm_rows}
                gm_c_rate = len(c_users & gm_converted) / c_total if c_total > 0 else 0.0
                gm_t_rate = len(t_users & gm_converted) / t_total if t_total > 0 else 0.0
                gm_uplift = round(gm_t_rate - gm_c_rate, 4)
                # 가드레일 악화 판단: treatment 전환율이 control보다 유의미하게 낮음
                gm_deteriorating = gm_uplift < -0.02  # 절대적 2%p 이상 하락
                guardrail_results.append(GuardrailMetricResult(
                    metric=gm,
                    control_rate=round(gm_c_rate, 4),
                    treatment_rate=round(gm_t_rate, 4),
                    uplift=gm_uplift,
                    deteriorating=gm_deteriorating,
                ))

        # ── 4-state 판단 ────────────────────────────────────────────────────────
        MIN_SAMPLE = 100
        total_sample = c_total + t_total
        guardrail_alert = any(g.deteriorating for g in guardrail_results) if guardrail_results else False

        if total_sample < MIN_SAMPLE:
            judgment = "need_more_data"
        elif srm_warning or guardrail_alert:
            judgment = "hold"
        elif prob >= 0.95 and uplift > 0:
            judgment = "ship"
        elif prob <= 0.05 and uplift < 0:
            judgment = "rollback"
        else:
            judgment = "need_more_data" if total_sample < 500 else "hold"

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
            uplift=uplift,
            probability_treatment_wins=round(prob, 4),
            srm_warning=srm_warning,
            sample_size=c_total + t_total,
            denominator_source=denominator_source,
            confidence_interval=[ci_lo, ci_hi],
            judgment=judgment,
            guardrail_results=guardrail_results,
        )

    async def _get_quasi_result(self, exp, experiment_id: str) -> ExperimentResult:
        """준실험 전용 결과 계산.

        분모: event_log의 노출 이벤트 (primary_metric이 아닌 이벤트, smoke_test 제외)
        전환: dl_reflection 테이블 (제출 완료 기준 — ground truth)
        교차검증용 primary_metric 이벤트는 집계하지 않음.
        """
        SMOKE_FILTER = (
            "(json_extract(properties, '$.smoke_test') IS NULL "
            "OR json_extract(properties, '$.smoke_test') = 0)"
        )

        # ── 분모: 노출 유저 (event_log, primary_metric 이벤트 제외, smoke 제외) ──
        exposure_rows = await d1.query(
            f"""SELECT DISTINCT user_id
                FROM event_log
                WHERE event_name != ?
                  AND json_extract(properties, '$.experiment_id') = ?
                  AND {SMOKE_FILTER}""",
            [exp.primary_metric, experiment_id],
        )
        exposed_users = {r["user_id"] for r in exposure_rows}

        if not exposed_users:
            return ExperimentResult(
                experiment_id=experiment_id,
                primary_metric=exp.primary_metric,
                sample_size=0,
                denominator_source="exposure",
                message="노출된 사용자가 없습니다",
            )

        # ── 전환: dl_reflection 테이블 (ground truth) ──
        main_db_id = os.getenv("D1_MAIN_DATABASE_ID")
        placeholders = ",".join("?" * len(exposed_users))
        submitted_rows = await d1.query(
            f"""SELECT DISTINCT user_id
                FROM dl_reflection
                WHERE experiment_id = ?
                  AND user_id IN ({placeholders})""",
            [experiment_id] + list(exposed_users),
            database_id=main_db_id,
        )
        submitted_users = {r["user_id"] for r in submitted_rows}

        total = len(exposed_users)
        conversions = len(submitted_users)
        rate = round(conversions / total, 4) if total > 0 else 0.0

        return ExperimentResult(
            experiment_id=experiment_id,
            primary_metric=exp.primary_metric,
            control=VariantResult(
                variant_name="control",
                users=total,
                conversions=conversions,
                rate=rate,
            ),
            treatment=None,
            uplift=None,
            probability_treatment_wins=None,
            srm_warning=False,
            sample_size=total,
            denominator_source="exposure",
            message=None,
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

        # guardrail_metrics: DB에 JSON 문자열로 저장
        raw_guardrail = row.get("guardrail_metrics")
        try:
            guardrail_metrics = json.loads(raw_guardrail) if raw_guardrail else None
        except (json.JSONDecodeError, TypeError):
            guardrail_metrics = None

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
            product=row.get("product"),
            project_id=row.get("project_id"),
            status=row["status"],
            owner_id=row.get("owner_id"),
            winning_variant=row.get("winning_variant"),
            start_at=row.get("start_at"),
            end_at=row.get("end_at"),
            reflection_start_date=row.get("reflection_start_date"),
            reflection_window_days=int(row.get("reflection_window_days") or 7),
            kill_switch=bool(row.get("kill_switch")),
            srm_flagged=bool(row.get("srm_flagged")),
            guardrail_metrics=guardrail_metrics,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            variants=variants,
        )

    async def _validate_running_preconditions(self, current: Experiment, patch: dict) -> None:
        """draft → running 전환 시 사전 조건 검증.
        - primary_metric: 모든 type 필수 (없으면 결과 계산 불가)
        - ab_test 한정: flag_key 필수, non-control variant마다 placement 연결 필수
        - quasi_experiment/rollout: placement 기반 운영이므로 이하 검증 스킵
        paused → running(재개)은 이미 draft → running 시 검증을 통과한 상태이므로 재검증 생략.
        """
        next_status = patch["status"]
        if hasattr(next_status, "value"):
            next_status = next_status.value
        if next_status != ExperimentStatus.RUNNING.value:
            return
        # 재개(paused → running)는 최초 진입 시 이미 검증 완료
        if current.status == ExperimentStatus.PAUSED:
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
        if next_experiment_type != ExperimentType.AB_TEST.value:
            return

        next_flag_key = patch.get("flag_key", current.flag_key)
        if not next_flag_key:
            raise HTTPException(
                status_code=400,
                detail="Feature flag must be connected before starting",
            )

        placement_rows = await d1.query(
            "SELECT DISTINCT variant_key FROM experiment_placement_config WHERE experiment_id = ?",
            [current.id],
        )
        covered = {row["variant_key"] for row in placement_rows if row.get("variant_key")}
        for variant in current.variants:
            if variant.name != "control" and variant.name not in covered:
                raise HTTPException(
                    status_code=400,
                    detail="All non-control variants must have a placement",
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

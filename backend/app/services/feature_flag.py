import binascii
import json
import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional
from fastapi import HTTPException
from app.schemas.feature_flag import FeatureFlagCreate, FeatureFlagUpdate, FeatureFlag
from app.schemas.feature_flag_exposure import FeatureFlagExposure, FeatureFlagExposureSummary
from app.schemas.feature_flag_rule import FeatureFlagRule, FeatureFlagRuleCreate, FeatureFlagRuleUpdate
from app.db import d1


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _match_single(actual: Any, operator: str, expected: Any) -> bool:
    """Evaluate one targeting condition. Returns True if the condition passes."""
    if operator == "eq":
        return actual is not None and str(actual) == str(expected)
    if operator == "neq":
        return actual is None or str(actual) != str(expected)
    if operator == "in":
        return actual is not None and actual in (expected if isinstance(expected, list) else [expected])
    if operator == "not_in":
        return actual is None or actual not in (expected if isinstance(expected, list) else [expected])
    if operator == "gt":
        try:
            return float(actual) > float(expected)
        except (TypeError, ValueError):
            return False
    if operator == "lt":
        try:
            return float(actual) < float(expected)
        except (TypeError, ValueError):
            return False
    if operator == "contains":
        return actual is not None and str(expected) in str(actual)
    if operator == "not_contains":
        return actual is None or str(expected) not in str(actual)
    return False


def _evaluate_conditions(person: dict, conditions: List[dict]) -> bool:
    """All conditions must pass (AND logic)."""
    for cond in conditions:
        if not _match_single(person.get(cond.get("property")), cond.get("operator", "eq"), cond.get("value")):
            return False
    return True


def _hash_pct(*parts: str) -> int:
    return binascii.crc32(":".join(parts).encode()) % 100


def _decide_variant(user_id: str, flag_key: str, enabled: bool, rollout_pct: int) -> str:
    if not enabled:
        return "control"
    return "treatment" if _hash_pct(user_id, flag_key) < rollout_pct else "control"


def _to_iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


class FeatureFlagDecision:
    def __init__(self, variant: str, reason: str, context: Optional[dict[str, Any]] = None):
        self.variant = variant
        self.reason = reason
        self.context = context or {}


class FeatureFlagService:

    async def list(self, include_archived: bool = False) -> List[FeatureFlag]:
        if include_archived:
            rows = await d1.query("SELECT * FROM feature_flag ORDER BY created_at DESC")
        else:
            rows = await d1.query("SELECT * FROM feature_flag WHERE archived_at IS NULL ORDER BY created_at DESC")
        return [self._to_flag(r) for r in rows]

    async def get(self, flag_key: str, include_archived: bool = True) -> Optional[FeatureFlag]:
        if include_archived:
            rows = await d1.query("SELECT * FROM feature_flag WHERE flag_key = ?", [flag_key])
        else:
            rows = await d1.query("SELECT * FROM feature_flag WHERE flag_key = ? AND archived_at IS NULL", [flag_key])
        return self._to_flag(rows[0]) if rows else None

    async def create(self, data: FeatureFlagCreate) -> FeatureFlag:
        existing = await self.get(data.flag_key)
        if existing:
            raise HTTPException(status_code=409, detail=f"flag_key '{data.flag_key}' already exists")
        now = _now()
        payload_json = json.dumps(data.payload, ensure_ascii=False) if data.payload else None
        ok = await d1.execute(
            """INSERT INTO feature_flag (flag_key, description, rollout_pct, enabled, product, project_id, payload_json, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [data.flag_key, data.description, data.rollout_pct, int(data.enabled), data.product, data.project_id, payload_json, now, now],
        )
        if not ok:
            raise HTTPException(status_code=502, detail="Failed to create feature flag")
        created = await self.get(data.flag_key)
        if not created:
            raise HTTPException(status_code=502, detail="Feature flag create did not persist")
        return created

    async def update(self, flag_key: str, data: FeatureFlagUpdate) -> FeatureFlag:
        existing = await self.get(flag_key, include_archived=False)
        if not existing:
            raise HTTPException(status_code=404, detail="Feature flag not found")

        raw = data.model_dump()
        patch = {k: v for k, v in raw.items() if v is not None}
        if "payload" in raw:
            if raw["payload"] is not None:
                patch["payload_json"] = json.dumps(raw["payload"], ensure_ascii=False)
            patch.pop("payload", None)
        # forced_variant: sentinel "__unset__" = 변경 없음, None = 명시적 해제, str = 설정
        if "forced_variant" in raw:
            if raw["forced_variant"] == "__unset__":
                patch.pop("forced_variant", None)  # 변경 없음
            # None이면 patch에 그대로 남겨 NULL로 업데이트
        if not patch:
            return existing
        if "enabled" in patch:
            patch["enabled"] = int(patch["enabled"])
        patch["updated_at"] = _now()

        set_clause = ", ".join(f"{k} = ?" for k in patch)
        ok = await d1.execute(
            f"UPDATE feature_flag SET {set_clause} WHERE flag_key = ?",
            list(patch.values()) + [flag_key],
        )
        if not ok:
            raise HTTPException(status_code=502, detail="Failed to update feature flag")
        updated = await self.get(flag_key, include_archived=False)
        if not updated:
            raise HTTPException(status_code=502, detail="Feature flag update did not persist")
        return updated

    async def archive(self, flag_key: str) -> FeatureFlag:
        existing = await self.get(flag_key, include_archived=False)
        if not existing:
            raise HTTPException(status_code=404, detail="Feature flag not found")
        now = _now()
        ok = await d1.execute(
            "UPDATE feature_flag SET enabled = 0, archived_at = ?, updated_at = ? WHERE flag_key = ? AND archived_at IS NULL",
            [now, now, flag_key],
        )
        if not ok:
            raise HTTPException(status_code=502, detail="Failed to archive feature flag")
        archived = await self.get(flag_key, include_archived=True)
        if not archived or archived.archived_at is None:
            raise HTTPException(status_code=502, detail="Feature flag archive did not persist")
        return archived

    async def restore(self, flag_key: str) -> FeatureFlag:
        existing = await self.get(flag_key, include_archived=True)
        if not existing or existing.archived_at is None:
            raise HTTPException(status_code=404, detail="Archived feature flag not found")
        now = _now()
        ok = await d1.execute(
            "UPDATE feature_flag SET archived_at = NULL, updated_at = ? WHERE flag_key = ? AND archived_at IS NOT NULL",
            [now, flag_key],
        )
        if not ok:
            raise HTTPException(status_code=502, detail="Failed to restore feature flag")
        restored = await self.get(flag_key, include_archived=False)
        if not restored or restored.archived_at is not None:
            raise HTTPException(status_code=502, detail="Feature flag restore did not persist")
        return restored

    async def list_rules(self, flag_key: str) -> List[FeatureFlagRule]:
        await self._require_flag(flag_key)
        rows = await d1.query(
            """SELECT * FROM feature_flag_rule
                WHERE flag_key = ?
                ORDER BY priority ASC, created_at ASC""",
            [flag_key],
        )
        return [self._to_rule(r) for r in rows]

    async def create_rule(self, flag_key: str, data: FeatureFlagRuleCreate) -> FeatureFlagRule:
        await self._require_flag(flag_key)
        if data.segment_id:
            await self._require_segment(data.segment_id)
        rule_id = data.id or str(uuid.uuid4())
        existing = await d1.query("SELECT id FROM feature_flag_rule WHERE id = ?", [rule_id])
        if existing:
            raise HTTPException(status_code=409, detail=f"rule id '{rule_id}' already exists")
        now = _now()
        ok = await d1.execute(
            """INSERT INTO feature_flag_rule
               (id, flag_key, priority, segment_id, rollout_pct, variant, enabled, starts_at, ends_at, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [
                rule_id,
                flag_key,
                data.priority,
                data.segment_id,
                data.rollout_pct,
                data.variant,
                int(data.enabled),
                _to_iso(data.starts_at),
                _to_iso(data.ends_at),
                now,
                now,
            ],
        )
        if not ok:
            raise HTTPException(status_code=502, detail="Failed to create feature flag rule")
        created = await self._get_rule(rule_id)
        if not created:
            raise HTTPException(status_code=502, detail="Feature flag rule create did not persist")
        return created

    async def update_rule(self, flag_key: str, rule_id: str, data: FeatureFlagRuleUpdate) -> FeatureFlagRule:
        await self._require_flag(flag_key)
        existing = await self._get_rule(rule_id)
        if not existing or existing.flag_key != flag_key:
            raise HTTPException(status_code=404, detail="Feature flag rule not found")
        patch = {k: v for k, v in data.model_dump().items() if v is not None}
        if not patch:
            return existing
        if "segment_id" in patch and patch["segment_id"]:
            await self._require_segment(patch["segment_id"])
        if "enabled" in patch:
            patch["enabled"] = int(patch["enabled"])
        for key in ("starts_at", "ends_at"):
            if key in patch:
                patch[key] = _to_iso(patch[key])
        patch["updated_at"] = _now()
        set_clause = ", ".join(f"{k} = ?" for k in patch)
        ok = await d1.execute(
            f"UPDATE feature_flag_rule SET {set_clause} WHERE id = ? AND flag_key = ?",
            list(patch.values()) + [rule_id, flag_key],
        )
        if not ok:
            raise HTTPException(status_code=502, detail="Failed to update feature flag rule")
        updated = await self._get_rule(rule_id)
        if not updated:
            raise HTTPException(status_code=502, detail="Feature flag rule update did not persist")
        return updated

    async def decide(self, flag_key: str, user_id: str, track: bool = True, project_id: str | None = None) -> str:
        decision = await self._decide(flag_key, user_id)
        if track and decision.reason != "unknown_flag":
            await self._record_exposure(flag_key, user_id, decision, project_id=project_id)
            await self._record_experiment_assignments(flag_key, user_id, decision)
        return decision.variant

    async def list_exposures(
        self,
        flag_key: str,
        from_: Optional[datetime] = None,
        to: Optional[datetime] = None,
        limit: int = 100,
        first_only: bool = False,
    ) -> List[FeatureFlagExposure]:
        if not await self.get(flag_key, include_archived=True):
            raise HTTPException(status_code=404, detail="Feature flag not found")
        where = ["flag_key = ?"]
        params: list[Any] = [flag_key]
        if from_:
            where.append("evaluated_at >= ?")
            params.append(from_.isoformat())
        if to:
            where.append("evaluated_at <= ?")
            params.append(to.isoformat())
        where_clause = " AND ".join(where)
        rows = await d1.query(
            f"""SELECT * FROM feature_flag_exposure
                 WHERE {where_clause}
                 ORDER BY evaluated_at ASC""",
            params,
        )
        exposures = [self._to_exposure(r) for r in rows]
        if first_only:
            first_by_user: dict[str, FeatureFlagExposure] = {}
            for exposure in exposures:
                first_by_user.setdefault(exposure.user_id, exposure)
            exposures = sorted(first_by_user.values(), key=lambda item: item.evaluated_at, reverse=True)
        else:
            exposures = sorted(exposures, key=lambda item: item.evaluated_at, reverse=True)
        return exposures[:limit]

    async def exposure_summary(
        self,
        flag_key: str,
        from_: Optional[datetime] = None,
        to: Optional[datetime] = None,
    ) -> FeatureFlagExposureSummary:
        exposures = await self.list_exposures(flag_key, from_, to, limit=10000, first_only=False)
        first_by_user: dict[str, FeatureFlagExposure] = {}
        for exposure in sorted(exposures, key=lambda item: item.evaluated_at):
            first_by_user.setdefault(exposure.user_id, exposure)
        variant_counts: dict[str, int] = {}
        for exposure in first_by_user.values():
            variant_counts[exposure.variant] = variant_counts.get(exposure.variant, 0) + 1
        return FeatureFlagExposureSummary(
            flag_key=flag_key,
            **{"from": from_},
            to=to,
            total_exposures=len(exposures),
            unique_users=len({e.user_id for e in exposures}),
            first_exposure_users=len(first_by_user),
            variant_counts=variant_counts,
        )

    async def _decide(self, flag_key: str, user_id: str) -> FeatureFlagDecision:
        rows = await d1.query("SELECT * FROM feature_flag WHERE flag_key = ?", [flag_key])
        if not rows:
            return FeatureFlagDecision("control", "unknown_flag")
        flag = rows[0]
        enabled = int(flag["enabled"]) == 1
        rollout_pct = int(flag["rollout_pct"])
        if flag.get("archived_at"):
            return FeatureFlagDecision("control", "archived")
        if not enabled:
            return FeatureFlagDecision("control", "disabled")

        # forced_variant: 실험 완료 후 winning variant가 설정된 경우
        # rollout_pct와 무관하게 해당 variant를 모든 사용자에게 반환.
        if flag.get("forced_variant"):
            return FeatureFlagDecision(
                flag["forced_variant"],
                "forced",
                {"forced_variant": flag["forced_variant"]},
            )

        rules = await d1.query(
            """SELECT * FROM feature_flag_rule
                WHERE flag_key = ? AND enabled = 1
                ORDER BY priority ASC, created_at ASC""",
            [flag_key],
        )
        now = datetime.now(timezone.utc)
        for rule in rules:
            if not self._rule_in_window(rule, now):
                continue
            if not await self._rule_matches_user(rule, user_id):
                continue
            in_rollout = _hash_pct(user_id, flag_key, rule["id"]) < int(rule["rollout_pct"])
            return FeatureFlagDecision(
                rule["variant"] if in_rollout else "control",
                f"rule:{rule['id']}" if in_rollout else f"rule:{rule['id']}:rollout_miss",
                {
                    "rule_id": rule["id"],
                    "segment_id": rule.get("segment_id"),
                    "rollout_pct": int(rule["rollout_pct"]),
                    "priority": int(rule["priority"]),
                },
            )

        variant = _decide_variant(user_id, flag_key, enabled, rollout_pct)
        return FeatureFlagDecision(
            variant,
            "fallback_rollout" if variant != "control" else "fallback_rollout_miss",
            {"rollout_pct": rollout_pct},
        )

    async def _record_exposure(
        self, flag_key: str, user_id: str, decision: FeatureFlagDecision, project_id: str | None = None
    ) -> None:
        now = _now()
        ok = await d1.execute(
            """INSERT INTO feature_flag_exposure
               (id, flag_key, user_id, variant, reason, evaluated_at, context_json, project_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(user_id, flag_key) DO UPDATE SET
                   variant      = excluded.variant,
                   reason       = excluded.reason,
                   evaluated_at = excluded.evaluated_at,
                   context_json = excluded.context_json,
                   project_id   = COALESCE(excluded.project_id, project_id)""",
            [
                str(uuid.uuid4()),
                flag_key,
                user_id,
                decision.variant,
                decision.reason,
                now,
                json.dumps(decision.context, ensure_ascii=False) if decision.context else None,
                project_id,
            ],
        )
        if not ok:
            # Decide must stay available even if exposure logging has a transient failure.
            print(f"Feature flag exposure logging failed: flag_key={flag_key}, user_id={user_id}")

    async def _record_experiment_assignments(
        self, flag_key: str, user_id: str, decision: FeatureFlagDecision
    ) -> None:
        # flag_key로 연결된 running/paused 실험에 variant_name으로 sticky assignment 기록.
        # paused 상태도 포함: 재개 시 사용자들이 기록 없이 결과에서 누락되는 문제 방지.
        # PK가 (experiment_id, user_id)이라 INSERT OR IGNORE로 반복 호출 안전(sticky).
        rows = await d1.query(
            "SELECT id AS experiment_id FROM experiments WHERE flag_key = ? AND status IN ('running', 'paused')",
            [flag_key],
        )
        if not rows:
            return
        now = _now()
        for row in rows:
            ok = await d1.execute(
                """INSERT OR IGNORE INTO experiment_assignments
                   (experiment_id, variant_name, user_id, assigned_at)
                   VALUES (?, ?, ?, ?)""",
                [row["experiment_id"], decision.variant, user_id, now],
            )
            if not ok:
                print(
                    f"Experiment assignment write failed: experiment_id={row['experiment_id']}, "
                    f"user_id={user_id}, flag_key={flag_key}, variant={decision.variant}"
                )

    async def _require_flag(self, flag_key: str) -> FeatureFlag:
        flag = await self.get(flag_key, include_archived=False)
        if not flag:
            raise HTTPException(status_code=404, detail="Feature flag not found")
        return flag

    async def _require_segment(self, segment_id: str) -> None:
        rows = await d1.query("SELECT id, enabled FROM feature_segment WHERE id = ?", [segment_id])
        if not rows:
            raise HTTPException(status_code=404, detail="Segment not found")
        if int(rows[0]["enabled"]) != 1:
            raise HTTPException(status_code=400, detail="Segment is disabled")

    async def _get_rule(self, rule_id: str) -> Optional[FeatureFlagRule]:
        rows = await d1.query("SELECT * FROM feature_flag_rule WHERE id = ?", [rule_id])
        return self._to_rule(rows[0]) if rows else None

    def _rule_in_window(self, rule: dict, now: datetime) -> bool:
        starts_at = rule.get("starts_at")
        ends_at = rule.get("ends_at")
        if starts_at and self._parse_rule_time(starts_at) > now:
            return False
        if ends_at and self._parse_rule_time(ends_at) <= now:
            return False
        return True

    def _parse_rule_time(self, value: str) -> datetime:
        parsed = datetime.fromisoformat(value)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)

    async def _rule_matches_user(self, rule: dict, user_id: str) -> bool:
        segment_id = rule.get("segment_id")
        if not segment_id:
            return True

        seg_rows = await d1.query(
            "SELECT id, enabled, rules_json FROM feature_segment WHERE id = ?",
            [segment_id],
        )
        if not seg_rows or int(seg_rows[0]["enabled"]) != 1:
            return False
        seg = seg_rows[0]

        rules_json_str = seg.get("rules_json")
        if rules_json_str:
            try:
                conditions = json.loads(rules_json_str)
                if conditions:
                    person_props = await self._get_person_props(user_id)
                    if _evaluate_conditions(person_props, conditions):
                        return True
            except Exception:
                pass

        # Fall back to explicit membership
        rows = await d1.query(
            "SELECT 1 AS matched FROM feature_segment_member WHERE segment_id = ? AND user_id = ? LIMIT 1",
            [segment_id, user_id],
        )
        return bool(rows)

    async def _get_person_props(self, user_id: str) -> dict:
        rows = await d1.query(
            "SELECT cohort_id, cohort_name, team_name, role, properties_json FROM person WHERE user_id = ?",
            [user_id],
        )
        if not rows:
            return {}
        p = rows[0]
        props: dict = {
            k: p[k] for k in ("cohort_id", "cohort_name", "team_name", "role") if p.get(k) is not None
        }
        if p.get("properties_json"):
            try:
                props.update(json.loads(p["properties_json"]))
            except Exception:
                pass
        return props

    def _to_rule(self, row: dict) -> FeatureFlagRule:
        return FeatureFlagRule(
            id=row["id"],
            flag_key=row["flag_key"],
            priority=int(row["priority"]),
            segment_id=row.get("segment_id"),
            rollout_pct=int(row["rollout_pct"]),
            variant=row["variant"],
            enabled=int(row["enabled"]) == 1,
            starts_at=row.get("starts_at"),
            ends_at=row.get("ends_at"),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def _to_exposure(self, row: dict) -> FeatureFlagExposure:
        return FeatureFlagExposure(
            id=row["id"],
            flag_key=row["flag_key"],
            user_id=row["user_id"],
            variant=row["variant"],
            reason=row.get("reason"),
            evaluated_at=row["evaluated_at"],
            context_json=row.get("context_json"),
        )

    def _to_flag(self, row: dict) -> FeatureFlag:
        payload_raw = row.get("payload_json")
        payload = None
        if payload_raw:
            try:
                payload = json.loads(payload_raw)
            except Exception:
                pass
        return FeatureFlag(
            flag_key=row["flag_key"],
            description=row.get("description"),
            rollout_pct=int(row["rollout_pct"]),
            enabled=int(row["enabled"]) == 1,
            product=row.get("product"),
            project_id=row.get("project_id"),
            payload=payload,
            forced_variant=row.get("forced_variant"),
            archived_at=row.get("archived_at"),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )


feature_flag_service = FeatureFlagService()

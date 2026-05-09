import binascii
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException
from app.schemas.feature_flag import FeatureFlagCreate, FeatureFlagUpdate, FeatureFlag
from app.schemas.feature_flag_rule import FeatureFlagRule, FeatureFlagRuleCreate, FeatureFlagRuleUpdate
from app.db import d1


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash_pct(*parts: str) -> int:
    return binascii.crc32(":".join(parts).encode()) % 100


def _decide_variant(user_id: str, flag_key: str, enabled: bool, rollout_pct: int) -> str:
    if not enabled:
        return "control"
    return "treatment" if _hash_pct(user_id, flag_key) < rollout_pct else "control"


def _to_iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


class FeatureFlagService:

    async def list(self) -> List[FeatureFlag]:
        rows = await d1.query("SELECT * FROM feature_flag ORDER BY created_at DESC")
        return [self._to_flag(r) for r in rows]

    async def get(self, flag_key: str) -> Optional[FeatureFlag]:
        rows = await d1.query("SELECT * FROM feature_flag WHERE flag_key = ?", [flag_key])
        return self._to_flag(rows[0]) if rows else None

    async def create(self, data: FeatureFlagCreate) -> FeatureFlag:
        existing = await self.get(data.flag_key)
        if existing:
            raise HTTPException(status_code=409, detail=f"flag_key '{data.flag_key}' already exists")
        now = _now()
        ok = await d1.execute(
            """INSERT INTO feature_flag (flag_key, description, rollout_pct, enabled, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            [data.flag_key, data.description, data.rollout_pct, int(data.enabled), now, now],
        )
        if not ok:
            raise HTTPException(status_code=502, detail="Failed to create feature flag")
        created = await self.get(data.flag_key)
        if not created:
            raise HTTPException(status_code=502, detail="Feature flag create did not persist")
        return created

    async def update(self, flag_key: str, data: FeatureFlagUpdate) -> FeatureFlag:
        existing = await self.get(flag_key)
        if not existing:
            raise HTTPException(status_code=404, detail="Feature flag not found")

        patch = {k: v for k, v in data.model_dump().items() if v is not None}
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
        updated = await self.get(flag_key)
        if not updated:
            raise HTTPException(status_code=502, detail="Feature flag update did not persist")
        return updated

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

    async def decide(self, flag_key: str, user_id: str) -> str:
        rows = await d1.query("SELECT * FROM feature_flag WHERE flag_key = ?", [flag_key])
        if not rows:
            return "control"
        flag = rows[0]
        enabled = int(flag["enabled"]) == 1
        rollout_pct = int(flag["rollout_pct"])
        if not enabled:
            return "control"

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
            return rule["variant"] if _hash_pct(user_id, flag_key, rule["id"]) < int(rule["rollout_pct"]) else "control"

        return _decide_variant(user_id, flag_key, enabled, rollout_pct)

    async def _require_flag(self, flag_key: str) -> FeatureFlag:
        flag = await self.get(flag_key)
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
        rows = await d1.query(
            """SELECT 1 AS matched
                 FROM feature_segment_member m
                 JOIN feature_segment s ON s.id = m.segment_id
                WHERE m.segment_id = ? AND m.user_id = ? AND s.enabled = 1
                LIMIT 1""",
            [segment_id, user_id],
        )
        return bool(rows)

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

    def _to_flag(self, row: dict) -> FeatureFlag:
        return FeatureFlag(
            flag_key=row["flag_key"],
            description=row.get("description"),
            rollout_pct=int(row["rollout_pct"]),
            enabled=int(row["enabled"]) == 1,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )


feature_flag_service = FeatureFlagService()

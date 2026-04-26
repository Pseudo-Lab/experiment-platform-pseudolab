import binascii
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException
from app.schemas.feature_flag import FeatureFlagCreate, FeatureFlagUpdate, FeatureFlag
from app.db import d1


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _decide_variant(user_id: str, flag_key: str, enabled: bool, rollout_pct: int) -> str:
    if not enabled:
        return "control"
    hash_val = binascii.crc32(f"{user_id}:{flag_key}".encode()) % 100
    return "treatment" if hash_val < rollout_pct else "control"


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
        await d1.execute(
            """INSERT INTO feature_flag (flag_key, description, rollout_pct, enabled, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            [data.flag_key, data.description, data.rollout_pct, int(data.enabled), now, now],
        )
        return await self.get(data.flag_key)

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
        await d1.execute(
            f"UPDATE feature_flag SET {set_clause} WHERE flag_key = ?",
            list(patch.values()) + [flag_key],
        )
        return await self.get(flag_key)

    async def decide(self, flag_key: str, user_id: str) -> str:
        rows = await d1.query("SELECT * FROM feature_flag WHERE flag_key = ?", [flag_key])
        if not rows:
            return "control"
        flag = rows[0]
        return _decide_variant(user_id, flag_key, bool(flag["enabled"]), int(flag["rollout_pct"]))

    def _to_flag(self, row: dict) -> FeatureFlag:
        return FeatureFlag(
            flag_key=row["flag_key"],
            description=row.get("description"),
            rollout_pct=int(row["rollout_pct"]),
            enabled=bool(row["enabled"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )


feature_flag_service = FeatureFlagService()

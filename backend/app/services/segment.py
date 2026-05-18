import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException

from app.db import d1
from app.schemas.segment import (
    Segment,
    SegmentCreate,
    SegmentMember,
    SegmentQueryTemplate,
    SegmentRefreshRequest,
    SegmentRefreshResponse,
)


@dataclass(frozen=True)
class QuerySegmentTemplate:
    sql: str
    description: str
    user_id_column: str = "user_id"
    params: tuple = ()
    rules_schema: dict | None = None


SUPPORTED_QUERY_SEGMENTS: dict[str, QuerySegmentTemplate] = {
    "project_members": QuerySegmentTemplate(
        description="Distinct users with at least one synced project membership.",
        sql="""
            SELECT DISTINCT user_id
              FROM dl_project_members
             WHERE user_id IS NOT NULL AND user_id != ''
        """
    ),
    "discord_active_users": QuerySegmentTemplate(
        description="Distinct Discord authors active within the configured day window.",
        sql="""
            SELECT DISTINCT author_id AS user_id
              FROM discord_messages
             WHERE author_id IS NOT NULL AND author_id != ''
               AND created_at >= datetime('now', ?)
        """,
        params=("-30 days",),
        rules_schema={
            "active_days": {
                "type": "integer",
                "default": 30,
                "minimum": 1,
                "maximum": 365,
            }
        },
    ),
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class SegmentService:
    def query_templates(self) -> List[SegmentQueryTemplate]:
        return [
            SegmentQueryTemplate(
                query_name=query_name,
                description=template.description,
                rules_schema=template.rules_schema or {},
            )
            for query_name, template in sorted(SUPPORTED_QUERY_SEGMENTS.items())
        ]

    async def list(self) -> List[Segment]:
        rows = await d1.query(
            """
            SELECT s.*, COUNT(m.user_id) AS member_count
              FROM feature_segment s
              LEFT JOIN feature_segment_member m ON m.segment_id = s.id
             GROUP BY s.id
             ORDER BY s.created_at DESC
            """
        )
        return [self._to_segment(r) for r in rows]

    async def get(self, segment_id: str) -> Optional[Segment]:
        rows = await d1.query(
            """
            SELECT s.*, COUNT(m.user_id) AS member_count
              FROM feature_segment s
              LEFT JOIN feature_segment_member m ON m.segment_id = s.id
             WHERE s.id = ?
             GROUP BY s.id
            """,
            [segment_id],
        )
        return self._to_segment(rows[0]) if rows else None

    async def create(self, data: SegmentCreate) -> Segment:
        existing = await self.get(data.id)
        if existing:
            raise HTTPException(status_code=409, detail=f"segment id '{data.id}' already exists")
        if data.source == "query":
            if not data.query_name:
                raise HTTPException(status_code=400, detail="query_name is required for query-backed segments")
            if data.user_ids:
                raise HTTPException(status_code=400, detail="query-backed segments must not set user_ids")
            if data.query_name not in SUPPORTED_QUERY_SEGMENTS:
                raise HTTPException(status_code=501, detail=f"segment query '{data.query_name}' is not supported yet")
            self._build_query_template(data.query_name, self._parse_rules_json(data.rules_json))
        if data.source == "manual" and data.query_name:
            raise HTTPException(status_code=400, detail="manual segments must not set query_name")

        now = _now()
        ok = await d1.execute(
            """INSERT INTO feature_segment
               (id, name, description, source, query_name, rules_json, enabled, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [data.id, data.name, data.description, data.source, data.query_name, data.rules_json, int(data.enabled), now, now],
        )
        if not ok:
            raise HTTPException(status_code=502, detail="Failed to create segment")
        if data.user_ids:
            await self._replace_members(data.id, data.user_ids, "manual", now)
        created = await self.get(data.id)
        if not created:
            raise HTTPException(status_code=502, detail="Segment create did not persist")
        return created

    async def refresh(self, segment_id: str, data: SegmentRefreshRequest) -> SegmentRefreshResponse:
        segment = await self.get(segment_id)
        if not segment:
            raise HTTPException(status_code=404, detail="Segment not found")
        if not segment.enabled:
            raise HTTPException(status_code=400, detail="Segment is disabled")

        now = _now()
        if segment.source == "manual":
            user_ids = data.user_ids
            if user_ids is None:
                rows = await d1.query("SELECT user_id FROM feature_segment_member WHERE segment_id = ?", [segment_id])
                user_ids = [r["user_id"] for r in rows]
            count = await self._replace_members(segment_id, user_ids, data.reason or "manual", now)
            await d1.execute("UPDATE feature_segment SET updated_at = ? WHERE id = ?", [now, segment_id])
            return SegmentRefreshResponse(segment_id=segment_id, refreshed_count=count, source=segment.source)

        if segment.query_name not in SUPPORTED_QUERY_SEGMENTS:
            raise HTTPException(status_code=501, detail=f"segment query '{segment.query_name}' is not supported yet")
        user_ids = await self._query_segment_user_ids(segment.query_name, segment.rules_json)
        count = await self._replace_members(segment_id, user_ids, f"query:{segment.query_name}", now)
        await d1.execute("UPDATE feature_segment SET updated_at = ? WHERE id = ?", [now, segment_id])
        return SegmentRefreshResponse(segment_id=segment_id, refreshed_count=count, source=segment.source)

    async def members(self, segment_id: str, limit: int = 100) -> List[SegmentMember]:
        segment = await self.get(segment_id)
        if not segment:
            raise HTTPException(status_code=404, detail="Segment not found")
        rows = await d1.query(
            """SELECT segment_id, user_id, reason, refreshed_at
                 FROM feature_segment_member
                WHERE segment_id = ?
                ORDER BY refreshed_at DESC, user_id ASC
                LIMIT ?""",
            [segment_id, limit],
        )
        return [self._to_member(r) for r in rows]

    async def is_member(self, segment_id: str, user_id: str) -> bool:
        rows = await d1.query(
            "SELECT 1 AS matched FROM feature_segment_member WHERE segment_id = ? AND user_id = ? LIMIT 1",
            [segment_id, user_id],
        )
        return bool(rows)

    async def _replace_members(self, segment_id: str, user_ids: List[str], reason: str, refreshed_at: str) -> int:
        unique_user_ids = sorted({u for u in user_ids if u})
        delete_ok = await d1.execute("DELETE FROM feature_segment_member WHERE segment_id = ?", [segment_id])
        if not delete_ok:
            raise HTTPException(status_code=502, detail="Failed to refresh segment members")
        for user_id in unique_user_ids:
            ok = await d1.execute(
                """INSERT INTO feature_segment_member (segment_id, user_id, reason, refreshed_at)
                   VALUES (?, ?, ?, ?)""",
                [segment_id, user_id, reason, refreshed_at],
            )
            if not ok:
                raise HTTPException(status_code=502, detail="Failed to refresh segment members")
        return len(unique_user_ids)

    async def _query_segment_user_ids(self, query_name: Optional[str], rules_json: Optional[str]) -> List[str]:
        if not query_name or query_name not in SUPPORTED_QUERY_SEGMENTS:
            raise HTTPException(status_code=501, detail=f"segment query '{query_name}' is not supported yet")
        rules = self._parse_rules_json(rules_json)
        template = self._build_query_template(query_name, rules)
        main_database_id = os.getenv("D1_MAIN_DATABASE_ID")
        if not main_database_id:
            raise HTTPException(status_code=503, detail="D1_MAIN_DATABASE_ID is required for query-backed segment refresh")
        rows = await d1.query(
            template.sql,
            list(template.params),
            database_id=main_database_id,
        )
        return [str(row[template.user_id_column]) for row in rows if row.get(template.user_id_column)]

    def _parse_rules_json(self, rules_json: Optional[str]) -> dict:
        if not rules_json:
            return {}
        try:
            parsed = json.loads(rules_json)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="rules_json must be valid JSON")
        if not isinstance(parsed, dict):
            raise HTTPException(status_code=400, detail="rules_json must be a JSON object")
        return parsed

    def _build_query_template(self, query_name: str, rules: dict) -> QuerySegmentTemplate:
        if query_name == "discord_active_users":
            try:
                active_days = int(rules.get("active_days", 30))
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="active_days must be an integer")
            if active_days < 1 or active_days > 365:
                raise HTTPException(status_code=400, detail="active_days must be between 1 and 365")
            base_template = SUPPORTED_QUERY_SEGMENTS[query_name]
            return QuerySegmentTemplate(
                sql=base_template.sql,
                description=base_template.description,
                params=(f"-{active_days} days",),
                rules_schema=base_template.rules_schema,
            )
        if rules:
            raise HTTPException(status_code=400, detail=f"segment query '{query_name}' does not accept rules_json")
        return SUPPORTED_QUERY_SEGMENTS[query_name]

    def _to_segment(self, row: dict) -> Segment:
        return Segment(
            id=row["id"],
            name=row["name"],
            description=row.get("description"),
            source=row["source"],
            query_name=row.get("query_name"),
            rules_json=row.get("rules_json"),
            enabled=int(row["enabled"]) == 1,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            member_count=int(row.get("member_count") or 0),
        )

    def _to_member(self, row: dict) -> SegmentMember:
        return SegmentMember(
            segment_id=row["segment_id"],
            user_id=row["user_id"],
            reason=row.get("reason"),
            refreshed_at=row["refreshed_at"],
        )


segment_service = SegmentService()

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException

from app.db import d1
from app.schemas.segment import Segment, SegmentCreate, SegmentMember, SegmentRefreshRequest, SegmentRefreshResponse

SUPPORTED_QUERY_SEGMENTS: dict[str, str] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class SegmentService:
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
            if data.query_name not in SUPPORTED_QUERY_SEGMENTS:
                raise HTTPException(status_code=501, detail=f"segment query '{data.query_name}' is not supported yet")
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
        raise HTTPException(status_code=501, detail="query-backed segment refresh is not implemented yet")

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

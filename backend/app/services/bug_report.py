import uuid
import json
from datetime import datetime, timezone
from typing import List, Optional
from app.schemas.bug_report import (
    BugReport, BugReportCreate, BugReportUpdate,
    Attachment, BugStatus, Comment, CommentCreate,
)
from app.db import d1
from app.db import r2


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class BugReportService:

    def _to_comment(self, row: dict) -> Comment:
        return Comment(
            id=row["id"],
            report_id=row["report_id"],
            author=row.get("author"),
            content=row["content"],
            created_at=row["created_at"],
        )

    def _to_bug_report(self, row: dict, with_comments: bool = False) -> BugReport:
        raw = json.loads(row.get("attachments") or "[]")
        attachments = [
            Attachment(name=a["name"], key=a["key"], type=a["type"], url=r2.presigned_url(a["key"]))
            for a in raw
        ]
        comments = []
        if with_comments:
            rows = d1.query(
                "SELECT * FROM bug_report_comments WHERE report_id = ? ORDER BY created_at ASC",
                [row["id"]]
            )
            comments = [self._to_comment(r) for r in rows]

        return BugReport(
            id=row["id"],
            title=row["title"],
            category=row["category"],
            severity=row.get("severity", "minor"),
            description=row.get("description"),
            status=row["status"],
            attachments=attachments,
            comments=comments,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    async def get_all(self, status: Optional[BugStatus] = None) -> List[BugReport]:
        if status:
            rows = d1.query(
                "SELECT * FROM bug_reports WHERE status = ? ORDER BY created_at DESC", [status]
            )
        else:
            rows = d1.query("SELECT * FROM bug_reports ORDER BY created_at DESC")
        return [self._to_bug_report(r) for r in rows]

    async def get(self, report_id: str) -> Optional[BugReport]:
        rows = d1.query("SELECT * FROM bug_reports WHERE id = ?", [report_id])
        if not rows:
            return None
        return self._to_bug_report(rows[0], with_comments=True)

    async def create(self, data: BugReportCreate) -> BugReport:
        report_id = str(uuid.uuid4())
        now = _now()
        attachments_json = json.dumps([
            {"name": a.name, "key": a.key, "type": a.type} for a in data.attachment_keys
        ])
        d1.execute(
            """INSERT INTO bug_reports
               (id, title, category, severity, description, status, attachments, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 'reported', ?, ?, ?)""",
            [report_id, data.title, data.category, data.severity, data.description, attachments_json, now, now]
        )
        return await self.get(report_id)

    async def update(self, report_id: str, data: BugReportUpdate) -> Optional[BugReport]:
        patch = {k: v for k, v in data.model_dump().items() if v is not None}
        if not patch:
            return await self.get(report_id)
        patch["updated_at"] = _now()
        set_clause = ", ".join(f"{k} = ?" for k in patch)
        values = list(patch.values()) + [report_id]
        d1.execute(f"UPDATE bug_reports SET {set_clause} WHERE id = ?", values)
        return await self.get(report_id)

    async def delete(self, report_id: str) -> bool:
        rows = d1.query("SELECT id FROM bug_reports WHERE id = ?", [report_id])
        if not rows:
            return False
        d1.execute("DELETE FROM bug_reports WHERE id = ?", [report_id])
        return True

    async def add_comment(self, report_id: str, data: CommentCreate) -> Optional[BugReport]:
        rows = d1.query("SELECT id FROM bug_reports WHERE id = ?", [report_id])
        if not rows:
            return None
        comment_id = str(uuid.uuid4())
        d1.execute(
            "INSERT INTO bug_report_comments (id, report_id, author, content, created_at) VALUES (?, ?, ?, ?, ?)",
            [comment_id, report_id, data.author, data.content, _now()]
        )
        return await self.get(report_id)


bug_report_service = BugReportService()

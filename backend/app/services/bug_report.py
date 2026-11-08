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
from fastapi import HTTPException
from app.core.config import settings


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

    async def _to_bug_report(self, row: dict, with_comments: bool = False, with_urls: bool = False) -> BugReport:
        raw = json.loads(row.get("attachments") or "[]")
        attachments = [
            Attachment(
                name=a["name"], 
                key=a["key"], 
                type=a["type"], 
                url=(f"{settings.API_V1_STR}/bug-reports/attachments/{a['key'].split('/')[-1]}"
                     if row.get("shared") else f"{settings.API_V1_STR}/bug-reports/{row['id']}/legacy-attachments/{index}") if with_urls else None
            )
            for index, a in enumerate(raw)
        ]
        comments = []
        if with_comments:
            rows = await d1.security_query(
                "SELECT * FROM bug_report_comments WHERE report_id = ? ORDER BY created_at ASC",
                [row["id"]]
            )
            comments = [self._to_comment(r) for r in rows]

        return BugReport(
            id=row["id"],
            title=row["title"],
            category="feature_request" if row.get("feedback_kind") == "suggestion" else row["category"],
            severity=row.get("severity", "minor"),
            description=row.get("description"),
            status=row["status"],
            attachments=attachments,
            comments=comments,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    async def get_all(self, status: Optional[BugStatus] = None, include_private: bool = True) -> List[BugReport]:
        filters = [] if include_private else ["shared = 1"]
        params = []
        if status:
            filters.append("status = ?")
            params.append(status)
        where = " WHERE " + " AND ".join(filters) if filters else ""
        rows = await d1.security_query("SELECT * FROM bug_reports" + where + " ORDER BY created_at DESC", params)
        return [await self._to_bug_report(r) for r in rows]

    async def get(self, report_id: str, include_private: bool = True) -> Optional[BugReport]:
        rows = await d1.security_query("SELECT * FROM bug_reports WHERE id = ?" + ("" if include_private else " AND shared = 1"), [report_id])
        if not rows:
            return None
        return await self._to_bug_report(rows[0], with_comments=True, with_urls=True)

    async def create(self, data: BugReportCreate, owner_id: str) -> BugReport:
        report_id, now = str(uuid.uuid4()), _now()
        attachments = []
        keys = [a.key for a in data.attachment_keys]
        if len(set(keys)) != len(keys):
            raise HTTPException(422, "Duplicate attachment")
        for key in keys:
            rows = await d1.security_query(
                "SELECT * FROM bug_report_uploads WHERE key = ? AND owner_id = ? AND report_id IS NULL",
                [key, owner_id],
            )
            if not rows:
                raise HTTPException(422, "Invalid feedback attachment")
            upload = rows[0]
            attachments.append({"key": key, "name": upload['name'], "type": upload['content_type']})
        # The trigger checks and claims uploads atomically with this insertion.
        await d1.security_execute(
            """INSERT INTO bug_reports
               (id, title, category, severity, description, status, attachments, created_at, updated_at,
                shared, author_account_id, feedback_kind)
               VALUES (?, ?, ?, ?, ?, 'reported', ?, ?, ?, 1, ?, ?)""",
            [report_id, data.title, "other" if data.category == "feature_request" else data.category,
             data.severity, data.description, json.dumps(attachments), now, now, owner_id,
             "suggestion" if data.category == "feature_request" else "bug"],
        )
        return await self.get(report_id)

    async def update(self, report_id: str, data: BugReportUpdate) -> Optional[BugReport]:
        patch = {k: v for k, v in data.model_dump().items() if v is not None}
        if not patch:
            return await self.get(report_id)
        patch["updated_at"] = _now()
        set_clause = ", ".join(f"{k} = ?" for k in patch)
        values = list(patch.values()) + [report_id]
        await d1.security_execute(f"UPDATE bug_reports SET {set_clause} WHERE id = ?", values)
        return await self.get(report_id)

    async def delete(self, report_id: str) -> bool:
        report = await self.get(report_id)
        if not report:
            return False
        
        # 1. R2에서 첨부 파일 삭제
        for attachment in report.attachments:
            r2.delete(attachment.key)
            
        # 2. DB에서 리포트 삭제 (댓글은 CASCADE DELETE로 자동 삭제됨)
        await d1.security_execute("DELETE FROM bug_reports WHERE id = ?", [report_id])
        return True

    async def add_comment(self, report_id: str, data: CommentCreate) -> Optional[BugReport]:
        rows = await d1.security_query("SELECT id FROM bug_reports WHERE id = ?", [report_id])
        if not rows:
            return None
        comment_id = str(uuid.uuid4())
        await d1.security_execute(
            "INSERT INTO bug_report_comments (id, report_id, author, content, created_at) VALUES (?, ?, ?, ?, ?)",
            [comment_id, report_id, data.author, data.content, _now()]
        )
        return await self.get(report_id)


bug_report_service = BugReportService()

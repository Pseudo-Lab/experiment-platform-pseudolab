import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Response
from starlette.concurrency import run_in_threadpool
from typing import List, Optional
from app.core.auth import AuthenticatedUser, require_authenticated_user
from app.schemas.bug_report import (
    BugReport, BugReportCreate, BugReportUpdate,
    BugStatus, BugSeverity, AttachmentUploadResponse, CommentCreate,
)
from app.services.bug_report import bug_report_service
from app.db import d1, r2
from app.core.config import settings

router = APIRouter()


def _owner(user: AuthenticatedUser) -> str:
    return user.account_id or f"admin:{user.username}"


def _require_admin(user: AuthenticatedUser) -> None:
    if not user.is_admin:
        raise HTTPException(403, "Administrator required")


@router.get("/", response_model=List[BugReport])
async def list_bug_reports(status: Optional[BugStatus] = Query(None), user=Depends(require_authenticated_user)):
    return await bug_report_service.get_all(status=status, include_private=user.is_admin)


@router.post("/", response_model=BugReport, status_code=201)
async def create_bug_report(data: BugReportCreate, user=Depends(require_authenticated_user)):
    if not user.is_admin:
        data = data.model_copy(update={"severity": BugSeverity.MINOR})
    return await bug_report_service.create(data, owner_id=_owner(user))


@router.post("/upload", response_model=AttachmentUploadResponse)
async def upload_attachment(file: UploadFile = File(..., json_schema_extra={"format": "binary"}), user=Depends(require_authenticated_user)):
    # The existing middleware caps the entire authenticated multipart request at 1 MiB.
    content = await file.read()
    if not content:
        raise HTTPException(422, "Empty attachment")
    png = content.startswith(b'\x89PNG\r\n\x1a\n') and len(content) >= 33 and content[12:16] == b'IHDR'
    jpeg = content.startswith(b'\xff\xd8\xff') and content.endswith(b'\xff\xd9')
    if png and file.content_type == "image/png":
        ext, content_type = "png", "image/png"
    elif jpeg and file.content_type == "image/jpeg":
        ext, content_type = "jpg", "image/jpeg"
    else:
        raise HTTPException(415, "Only PNG and JPEG screenshots are supported")
    key = f"bug-reports/{uuid.uuid4()}.{ext}"
    if not await run_in_threadpool(r2.upload, key, content, content_type):
        raise HTTPException(503, "Attachment storage unavailable")
    # Store canonical metadata; the report creation request cannot supply another owner's key.
    name = (file.filename or f"screenshot.{ext}").replace('\\', '/').split('/')[-1][:160]
    try:
        await d1.security_execute(
            "INSERT INTO bug_report_uploads (key, owner_id, name, content_type, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
            [key, _owner(user), name, content_type],
        )
    except Exception:
        await run_in_threadpool(r2.delete, key)
        raise
    return AttachmentUploadResponse(name=name, key=key, type=content_type,
                                    url=f"{settings.API_V1_STR}/bug-reports/attachments/{key.split('/')[-1]}")


@router.get("/attachments/{filename}")
async def get_attachment(filename: str, user=Depends(require_authenticated_user)):
    key = f"bug-reports/{filename}"
    rows = await d1.security_query("SELECT * FROM bug_report_uploads WHERE key = ?", [key])
    if not rows:
        raise HTTPException(404, "Attachment not found")
    upload = rows[0]
    if upload['report_id']:
        report = await bug_report_service.get(upload['report_id'], include_private=user.is_admin)
        if not report:
            raise HTTPException(404, "Attachment not found")
    elif upload['owner_id'] != _owner(user):
        raise HTTPException(404, "Attachment not found")
    content = await run_in_threadpool(r2.download, key, 1024 * 1024)
    if content is None:
        raise HTTPException(503, "Attachment storage unavailable")
    return Response(content, media_type=upload['content_type'], headers={
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
    })


@router.get("/{report_id}/legacy-attachments/{index}")
async def legacy_attachment(report_id: str, index: int, user=Depends(require_authenticated_user)):
    _require_admin(user)
    report = await bug_report_service.get(report_id)
    if not report or index < 0 or index >= len(report.attachments):
        raise HTTPException(404, "Attachment not found")
    content = await run_in_threadpool(r2.download, report.attachments[index].key, 1024 * 1024)
    if content is None:
        raise HTTPException(503, "Attachment storage unavailable")
    # Legacy objects may be HTML/SVG or arbitrary files; never render them inline.
    return Response(content, media_type="application/octet-stream", headers={
        "Content-Disposition": 'attachment; filename="attachment"',
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
    })


@router.get("/{report_id}", response_model=BugReport)
async def get_bug_report(report_id: str, user=Depends(require_authenticated_user)):
    report = await bug_report_service.get(report_id, include_private=user.is_admin)
    if not report:
        raise HTTPException(404, "Bug report not found")
    return report


@router.delete("/{report_id}", status_code=204)
async def delete_bug_report(report_id: str, user=Depends(require_authenticated_user)):
    _require_admin(user)
    deleted = await bug_report_service.delete(report_id)
    if not deleted:
        raise HTTPException(404, "Bug report not found")


@router.patch("/{report_id}", response_model=BugReport)
async def update_bug_report(report_id: str, data: BugReportUpdate, user=Depends(require_authenticated_user)):
    _require_admin(user)
    report = await bug_report_service.update(report_id, data)
    if not report:
        raise HTTPException(404, "Bug report not found")
    return report


@router.post("/{report_id}/comments", response_model=BugReport)
async def add_comment(report_id: str, data: CommentCreate, user=Depends(require_authenticated_user)):
    if not await bug_report_service.get(report_id, include_private=user.is_admin):
        raise HTTPException(404, "Bug report not found")
    # Never trust a caller-supplied name or disclose Google/internal account identifiers.
    verified = data.model_copy(update={"author": "Administrator" if user.is_admin else "Member"})
    report = await bug_report_service.add_comment(report_id, verified)
    if not report:
        raise HTTPException(404, "Bug report not found")
    return report

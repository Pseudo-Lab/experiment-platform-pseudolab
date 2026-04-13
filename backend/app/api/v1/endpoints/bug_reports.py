import uuid
from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from typing import List, Optional
from app.schemas.bug_report import (
    BugReport, BugReportCreate, BugReportUpdate,
    BugStatus, AttachmentUploadResponse, CommentCreate,
)
from app.services.bug_report import bug_report_service
from app.db import r2

router = APIRouter()


@router.get("/", response_model=List[BugReport])
async def list_bug_reports(status: Optional[BugStatus] = Query(None)):
    return await bug_report_service.get_all(status=status)


@router.post("/", response_model=BugReport, status_code=201)
async def create_bug_report(data: BugReportCreate):
    return await bug_report_service.create(data)


@router.get("/{report_id}", response_model=BugReport)
async def get_bug_report(report_id: str):
    report = await bug_report_service.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Bug report not found")
    return report


@router.delete("/{report_id}", status_code=204)
async def delete_bug_report(report_id: str):
    deleted = await bug_report_service.delete(report_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Bug report not found")


@router.patch("/{report_id}", response_model=BugReport)
async def update_bug_report(report_id: str, data: BugReportUpdate):
    report = await bug_report_service.update(report_id, data)
    if not report:
        raise HTTPException(status_code=404, detail="Bug report not found")
    return report


@router.post("/{report_id}/comments", response_model=BugReport)
async def add_comment(report_id: str, data: CommentCreate):
    report = await bug_report_service.add_comment(report_id, data)
    if not report:
        raise HTTPException(status_code=404, detail="Bug report not found")
    return report


@router.post("/upload", response_model=AttachmentUploadResponse)
async def upload_attachment(file: UploadFile = File(...)):
    content = await file.read()
    key = f"bug-reports/{uuid.uuid4()}/{file.filename}"
    success = r2.upload(key, content, file.content_type or "application/octet-stream")
    if not success:
        raise HTTPException(status_code=500, detail="File upload failed")
    return AttachmentUploadResponse(
        name=file.filename,
        key=key,
        type=file.content_type or "application/octet-stream",
    )

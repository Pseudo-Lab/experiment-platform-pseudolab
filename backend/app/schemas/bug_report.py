from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from enum import Enum


class BugCategory(str, Enum):
    UI = "ui"
    FUNCTIONAL = "functional"
    PERFORMANCE = "performance"
    FEATURE_REQUEST = "feature_request"
    OTHER = "other"


class BugStatus(str, Enum):
    REPORTED = "reported"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"


class BugSeverity(str, Enum):
    MINOR = "minor"
    MAJOR = "major"
    CRITICAL = "critical"


class Attachment(BaseModel):
    name: str
    key: str
    type: str
    url: Optional[str] = None


class CommentCreate(BaseModel):
    # TODO: OAuth 연동 시 author 필드 제거 — 토큰에서 사용자 정보 추출
    author: Optional[str] = None
    content: str


class Comment(BaseModel):
    id: str
    report_id: str
    # TODO: OAuth 연동 시 author 필드 제거 — 토큰에서 사용자 정보 추출
    author: Optional[str] = None
    content: str
    created_at: datetime


class BugReportCreate(BaseModel):
    title: str
    category: BugCategory
    severity: BugSeverity = BugSeverity.MINOR
    description: Optional[str] = None
    attachment_keys: List[Attachment] = []


class BugReportUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[BugStatus] = None
    severity: Optional[BugSeverity] = None
    description: Optional[str] = None


class BugReport(BaseModel):
    id: str
    title: str
    category: BugCategory
    severity: BugSeverity
    description: Optional[str] = None
    status: BugStatus
    attachments: List[Attachment] = []
    comments: List[Comment] = []
    created_at: datetime
    updated_at: datetime


class AttachmentUploadResponse(BaseModel):
    name: str
    key: str
    type: str

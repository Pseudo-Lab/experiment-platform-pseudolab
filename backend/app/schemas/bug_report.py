from pydantic import BaseModel, Field, StringConstraints
from datetime import datetime
from typing import Optional, List, Annotated
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


NonemptyText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class CommentCreate(BaseModel):
    author: Optional[str] = None
    content: NonemptyText = Field(max_length=5000)


class Comment(BaseModel):
    id: str
    report_id: str
    author: Optional[str] = None
    content: str
    created_at: datetime


class BugReportCreate(BaseModel):
    title: NonemptyText = Field(max_length=160)
    category: BugCategory
    severity: BugSeverity = BugSeverity.MINOR
    description: Optional[str] = Field(default=None, max_length=10000)
    attachment_keys: List[Attachment] = Field(default_factory=list, max_length=3)


class BugReportUpdate(BaseModel):
    title: Optional[NonemptyText] = Field(default=None, max_length=160)
    status: Optional[BugStatus] = None
    severity: Optional[BugSeverity] = None
    description: Optional[str] = Field(default=None, max_length=10000)


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
    url: Optional[str] = None

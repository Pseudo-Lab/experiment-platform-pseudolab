from pydantic import BaseModel, Field
from typing import Literal, Optional
from uuid import uuid4

PROJECT_ID_PATTERN = r"^[a-z0-9][a-z0-9-]{1,39}$"


class ProjectCreate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()), pattern=PROJECT_ID_PATTERN)
    name: str = Field(..., min_length=1, max_length=80)
    base_url: Optional[str] = None
    project_type: Literal['ab_test', 'quasi_experiment'] = 'ab_test'


class Project(BaseModel):
    access_role: Literal["owner", "editor", "viewer"] = "owner"
    id: str
    name: str
    base_url: Optional[str] = None
    project_type: Literal['ab_test', 'quasi_experiment'] = 'ab_test'
    created_at: str


class ProjectWithKey(Project):
    api_key: str


class ProjectUpdate(BaseModel):
    base_url: Optional[str] = None


class ProjectSdkStatus(BaseModel):
    project_id: str
    status: str  # "connected" | "not_connected"


class ProjectApiKey(BaseModel):
    api_key: str


class ProjectMember(BaseModel):
    account_id: str
    role: Literal["owner", "editor", "viewer"]


class ProjectMemberUpdate(BaseModel):
    role: Literal["editor", "viewer"]


class ProjectInvitationCreate(ProjectMemberUpdate):
    pass


class ProjectInvitation(BaseModel):
    id: str
    project_id: str
    role: Literal["editor", "viewer"]
    expires_at: int
    revoked_at: Optional[int] = None
    accepted_by: Optional[str] = None


class ProjectInvitationCreated(ProjectInvitation):
    token: str


class ProjectInvitationAccept(BaseModel):
    token: str = Field(min_length=43, max_length=100, pattern=r"^[A-Za-z0-9_-]+$")

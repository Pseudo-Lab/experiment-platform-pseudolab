from fastapi import APIRouter, Depends, HTTPException, Response, Request
from typing import List
from app.schemas.project import Project, ProjectCreate, ProjectUpdate, ProjectApiKey, ProjectSdkStatus
from app.services.project import project_service
from app.core.auth import require_authenticated_user

from app.schemas.project import (ProjectMember, ProjectMemberUpdate, ProjectInvitationCreate,
                                 ProjectInvitation, ProjectInvitationCreated, ProjectInvitationAccept)
from app.services import project_sharing
from app.db import d1
from app.core.account_sessions import token_hash

router = APIRouter()


@router.get("/", response_model=List[Project])
async def list_projects(request: Request):
    return await project_service.list(account_id=None if request.state.auth_user.is_admin else request.state.auth_user.account_id)


@router.post("/", response_model=Project, status_code=201)
async def create_project(data: ProjectCreate, request: Request):
    return await project_service.create(data, account_id=request.state.auth_user.account_id)


@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str, request: Request):
    p = await project_service.get(project_id)
    if not p:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
    if not request.state.auth_user.is_admin:
        roles = await d1.security_query("SELECT role FROM project_access WHERE project_id=? AND account_id=?", [project_id, request.state.auth_user.account_id])
        if not roles:
            raise HTTPException(404, "Project not found")
        p.access_role = roles[0]["role"]
    return p


@router.get("/{project_id}/sdk-status", response_model=ProjectSdkStatus)
async def get_sdk_status(project_id: str):
    return await project_service.sdk_status(project_id)


@router.patch("/{project_id}", response_model=Project)
async def update_project(project_id: str, data: ProjectUpdate):
    return await project_service.update(project_id, data)


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str):
    await project_service.delete(project_id)


@router.get("/{project_id}/api-key", response_model=ProjectApiKey,
            dependencies=[Depends(require_authenticated_user)])
async def get_project_api_key(project_id: str, response: Response):
    project = await project_service.get(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    response.headers["Cache-Control"] = "no-store"
    return ProjectApiKey(api_key=project.api_key)


@router.post("/{project_id}/server-key")
async def rotate_server_key(project_id: str, response: Response):
    token = await project_service.rotate_server_key(project_id)
    response.headers["Cache-Control"] = "no-store"
    return {"server_key": token}


@router.delete("/{project_id}/server-key", status_code=204)
async def revoke_server_key(project_id: str):
    await project_service.revoke_server_key(project_id)


@router.get("/{project_id}/members", response_model=List[ProjectMember])
async def list_members(project_id: str):
    return await project_sharing.members(project_id)


@router.patch("/{project_id}/members/{account_id}", status_code=204)
async def update_member(project_id: str, account_id: str, data: ProjectMemberUpdate):
    await project_sharing.change_member(project_id, account_id, data.role)


@router.delete("/{project_id}/members/{account_id}", status_code=204)
async def remove_member(project_id: str, account_id: str):
    await project_sharing.change_member(project_id, account_id, None)


@router.get("/{project_id}/invitations", response_model=List[ProjectInvitation])
async def list_invitations(project_id: str):
    return await project_sharing.invitations(project_id)


@router.post("/{project_id}/invitations", response_model=ProjectInvitationCreated, status_code=201)
async def create_invitation(project_id: str, data: ProjectInvitationCreate):
    if not await project_service.get(project_id):
        raise HTTPException(404, "Project not found")
    return await project_sharing.create_invitation(project_id, data.role)


@router.delete("/{project_id}/invitations/{invitation_id}", status_code=204)
async def revoke_invitation(project_id: str, invitation_id: str):
    await project_sharing.revoke_invitation(project_id, invitation_id)


@router.post("/invitations/accept", response_model=Project)
async def accept_invitation(data: ProjectInvitationAccept, request: Request):
    if not request.state.auth_user.account_id:
        raise HTTPException(403, "Sign in with a Google account to accept invitations")
    return await project_sharing.accept_invitation(data.token, request.state.auth_user.account_id)


@router.post("/invitations/preview")
async def preview_invitation(data: ProjectInvitationAccept):
    rows = await d1.security_query(
        "SELECT p.name, i.role, i.expires_at FROM project_invitation i JOIN projects p ON p.id=i.project_id "
        "WHERE i.token_hash=? AND i.revoked_at IS NULL AND i.accepted_by IS NULL AND i.expires_at>unixepoch()", [token_hash(data.token)])
    if not rows:
        raise HTTPException(410, "Invitation expired or unavailable")
    return rows[0]

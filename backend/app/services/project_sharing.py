"""Project membership and single-use links. Only token hashes persist."""
import hashlib
import secrets
import time
from uuid import uuid4
from fastapi import HTTPException
from app.db import d1


async def members(project_id: str):
    return await d1.security_query("SELECT account_id, role FROM project_access WHERE project_id=? ORDER BY role, account_id", [project_id])


async def change_member(project_id: str, account_id: str, role: str | None):
    if await d1.security_query("SELECT 1 FROM project_owner WHERE project_id=? AND account_id=?", [project_id, account_id]):
        raise HTTPException(409, "Project owner cannot be changed here")
    rows = await d1.security_query(
        "UPDATE project_member SET role=? WHERE project_id=? AND account_id=? RETURNING account_id"
        if role else "DELETE FROM project_member WHERE project_id=? AND account_id=? RETURNING account_id",
        [role, project_id, account_id] if role else [project_id, account_id])
    if not rows:
        raise HTTPException(404, "Member not found")


async def invitations(project_id: str):
    return await d1.security_query(
        "SELECT id, project_id, role, expires_at, revoked_at, accepted_by FROM project_invitation WHERE project_id=? ORDER BY expires_at DESC", [project_id])


async def create_invitation(project_id: str, role: str):
    token = secrets.token_urlsafe(32)
    data = {"id": str(uuid4()), "project_id": project_id, "role": role, "expires_at": int(time.time()) + 7 * 86400}
    rows = await d1.security_query(
        "INSERT INTO project_invitation (id, project_id, token_hash, role, expires_at) VALUES (?, ?, ?, ?, ?) RETURNING id",
        [data['id'], project_id, hashlib.sha256(token.encode()).hexdigest(), role, data['expires_at']])
    if not rows:
        raise HTTPException(503, "Invitation storage unavailable")
    return {**data, "token": token}


async def revoke_invitation(project_id: str, invitation_id: str):
    rows = await d1.security_query("UPDATE project_invitation SET revoked_at=unixepoch() WHERE id=? AND project_id=? RETURNING id", [invitation_id, project_id])
    if not rows:
        raise HTTPException(404, "Invitation not found")


async def accept_invitation(token: str, account_id: str):
    digest = hashlib.sha256(token.encode()).hexdigest()
    rows = await d1.security_query("SELECT * FROM project_invitation WHERE token_hash=?", [digest])
    if not rows or rows[0]['revoked_at'] is not None or rows[0]['expires_at'] <= int(time.time()):
        raise HTTPException(410, "Invitation expired or unavailable")
    invitation = rows[0]
    if invitation['accepted_by'] is not None:
        # Safe retry; a removed member cannot regain access using a consumed link.
        if invitation['accepted_by'] != account_id or not await d1.security_query(
                "SELECT 1 FROM project_access WHERE project_id=? AND account_id=?", [invitation['project_id'], account_id]):
            raise HTTPException(410, "Invitation already used")
    else:
        await d1.security_query("INSERT INTO project_invitation_acceptance (token_hash, account_id) VALUES (?, ?)", [digest, account_id])
    access = await d1.security_query(
        "SELECT p.*, a.role AS access_role FROM projects p JOIN project_access a ON a.project_id=p.id WHERE p.id=? AND a.account_id=?", [invitation['project_id'], account_id])
    if not access:
        raise HTTPException(409, "Invitation acceptance changed concurrently")
    return access[0]

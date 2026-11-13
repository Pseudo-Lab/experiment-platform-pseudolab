"""Project membership and single-use links. Only token hashes persist."""
import hashlib
import secrets
import time
from uuid import uuid4
from fastapi import HTTPException
from app.db import d1

INVITATION_TTL_SECONDS = 7 * 86400


async def members(project_id: str):
    return await d1.security_query(
        "SELECT a.account_id, a.role, p.display_name, p.email FROM project_access a "
        "LEFT JOIN platform_account_profile p ON p.account_id=a.account_id "
        "WHERE a.project_id=? ORDER BY a.role, a.account_id", [project_id])


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
        "SELECT i.id, i.project_id, i.role, i.expires_at, i.revoked_at, i.accepted_by, i.accepted_at, "
        "r.email AS recipient_email, p.display_name AS accepted_display_name, p.email AS accepted_email, "
        # All invitations use a fixed seven-day TTL; recover the original issue time without a schema change.
        f"i.expires_at - {INVITATION_TTL_SECONDS} AS created_at, "
        "CASE WHEN i.accepted_by IS NOT NULL THEN 'accepted' WHEN i.revoked_at IS NOT NULL THEN 'revoked' "
        "WHEN i.expires_at <= unixepoch() THEN 'expired' ELSE 'pending' END AS status "
        "FROM project_invitation i LEFT JOIN project_invitation_recipient r ON r.invitation_id=i.id "
        "LEFT JOIN platform_account_profile p ON p.account_id=i.accepted_by "
        "WHERE i.project_id=? ORDER BY i.expires_at DESC, i.id DESC", [project_id])


async def create_invitation(project_id: str, role: str, email: str | None = None):
    token = secrets.token_urlsafe(32)
    created_at = int(time.time())
    data = {"id": str(uuid4()), "project_id": project_id, "role": role,
            "created_at": created_at, "expires_at": created_at + INVITATION_TTL_SECONDS, "status": "pending",
            "recipient_email": email}
    rows = await d1.security_query(
        "INSERT INTO project_invitation_creation (id, project_id, token_hash, role, expires_at, email) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        [data['id'], project_id, hashlib.sha256(token.encode()).hexdigest(), role, data['expires_at'], email])
    if not rows:
        raise HTTPException(503, "Invitation storage unavailable")
    return {**data, "token": token}


async def revoke_invitation(project_id: str, invitation_id: str):
    rows = await d1.security_query("UPDATE project_invitation SET revoked_at=COALESCE(revoked_at, unixepoch()) WHERE id=? AND project_id=? RETURNING id", [invitation_id, project_id])
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
        recipients = await d1.security_query(
            "SELECT email FROM project_invitation_recipient WHERE invitation_id=?", [invitation['id']])
        if recipients:
            profiles = await d1.security_query(
                "SELECT 1 FROM platform_account_profile WHERE account_id=? AND email_authoritative=1 AND lower(email)=lower(?)",
                [account_id, recipients[0]['email']])
            if not profiles:
                raise HTTPException(403, "Sign in with the invited Google email account; email ownership verification may be required")
        await d1.security_query("INSERT INTO project_invitation_acceptance (token_hash, account_id) VALUES (?, ?)", [digest, account_id])
    access = await d1.security_query(
        "SELECT p.*, a.role AS access_role FROM projects p JOIN project_access a ON a.project_id=p.id WHERE p.id=? AND a.account_id=?", [invitation['project_id'], account_id])
    if not access:
        raise HTTPException(409, "Invitation acceptance changed concurrently")
    return access[0]

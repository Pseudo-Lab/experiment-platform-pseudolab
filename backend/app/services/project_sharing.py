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
        "i.declined_at, i.invited_by, "
        "r.email AS recipient_email, p.display_name AS accepted_display_name, p.email AS accepted_email, "
        # All invitations use a fixed seven-day TTL; recover the original issue time without a schema change.
        f"i.expires_at - {INVITATION_TTL_SECONDS} AS created_at, "
        "CASE WHEN i.accepted_by IS NOT NULL THEN 'accepted' WHEN i.revoked_at IS NOT NULL THEN 'revoked' "
        "WHEN i.declined_at IS NOT NULL THEN 'declined' WHEN i.expires_at <= unixepoch() THEN 'expired' ELSE 'pending' END AS status "
        "FROM project_invitation i LEFT JOIN project_invitation_recipient r ON r.invitation_id=i.id "
        "LEFT JOIN platform_account_profile p ON p.account_id=i.accepted_by "
        "WHERE i.project_id=? ORDER BY i.expires_at DESC, i.id DESC", [project_id])


async def create_invitation(project_id: str, role: str, email: str | None = None, invited_by: str | None = None):
    token = secrets.token_urlsafe(32)
    created_at = int(time.time())
    data = {"id": str(uuid4()), "project_id": project_id, "role": role,
            "created_at": created_at, "expires_at": created_at + INVITATION_TTL_SECONDS, "status": "pending",
            "recipient_email": email, "declined_at": None}
    rows = await d1.security_query(
        "INSERT INTO project_invitation_creation (id, project_id, token_hash, role, expires_at, email, invited_by) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id",
        [data['id'], project_id, hashlib.sha256(token.encode()).hexdigest(), role, data['expires_at'], email, invited_by])
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
    if not rows or rows[0]['revoked_at'] is not None or rows[0].get('declined_at') is not None or rows[0]['expires_at'] <= int(time.time()):
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


async def pending_invitations(account_id: str):
    return await d1.security_query(
        "SELECT i.id, i.project_id, p.name AS project_name, i.role, "
        f"i.expires_at - {INVITATION_TTL_SECONDS} AS created_at, i.expires_at, "
        "COALESCE(NULLIF(trim(inviter.display_name), ''), inviter.email) AS inviter_name "
        "FROM project_invitation i JOIN project_invitation_recipient r ON r.invitation_id=i.id "
        "JOIN projects p ON p.id=i.project_id "
        "JOIN platform_account_profile recipient ON recipient.account_id=? "
        "LEFT JOIN platform_account_profile inviter ON inviter.account_id=i.invited_by "
        "WHERE recipient.email_authoritative=1 AND recipient.email IS NOT NULL "
        "AND lower(recipient.email)=lower(r.email) AND i.accepted_by IS NULL AND i.revoked_at IS NULL "
        "AND i.declined_at IS NULL AND i.expires_at>unixepoch() "
        "ORDER BY i.expires_at DESC, i.id DESC", [account_id])


async def _email_invitation(invitation_id: str, account_id: str):
    rows = await d1.security_query(
        "SELECT i.*, r.email AS recipient_email FROM project_invitation i "
        "JOIN project_invitation_recipient r ON r.invitation_id=i.id "
        "JOIN platform_account_profile p ON p.account_id=? AND p.email_authoritative=1 "
        "AND p.email IS NOT NULL AND lower(p.email)=lower(r.email) WHERE i.id=?", [account_id, invitation_id])
    if not rows:
        raise HTTPException(404, "Invitation not found")
    return rows[0]


async def accept_email_invitation(invitation_id: str, account_id: str):
    rows = await d1.security_query(
        "SELECT i.*, r.email AS recipient_email FROM project_invitation i "
        "JOIN project_invitation_recipient r ON r.invitation_id=i.id WHERE i.id=?", [invitation_id])
    if not rows:
        raise HTTPException(404, "Invitation not found")
    invitation = rows[0]
    if invitation['accepted_by'] is not None:
        access = await d1.security_query(
            "SELECT p.*, a.role AS access_role FROM projects p JOIN project_access a "
            "ON a.project_id=p.id WHERE p.id=? AND a.account_id=?",
            [invitation['project_id'], account_id]) if invitation['accepted_by'] == account_id else []
        if not access:
            # A different account still receives 404 unless its current verified email is the recipient.
            if invitation['accepted_by'] != account_id:
                await _email_invitation(invitation_id, account_id)
            raise HTTPException(410, "Invitation already used")
        return access[0]
    else:
        await _email_invitation(invitation_id, account_id)
        if invitation['revoked_at'] is not None or invitation['declined_at'] is not None or invitation['expires_at'] <= int(time.time()):
            raise HTTPException(410, "Invitation expired or unavailable")
        # The database trigger repeats the current profile proof atomically with membership creation.
        try:
            await d1.security_query("INSERT INTO project_invitation_acceptance (token_hash, account_id) VALUES (?, ?)",
                                    [invitation['token_hash'], account_id])
        except HTTPException as error:
            if error.status_code != 503:
                raise
            # The write may have committed before its response was lost. Inspect state; never replay it.
            try:
                current_rows = await d1.security_query(
                    "SELECT i.*, r.email AS recipient_email FROM project_invitation i "
                    "JOIN project_invitation_recipient r ON r.invitation_id=i.id WHERE i.id=?", [invitation_id])
                if not current_rows:
                    raise error
                current = current_rows[0]
                access = await d1.security_query(
                    "SELECT p.*, a.role AS access_role FROM projects p JOIN project_access a "
                    "ON a.project_id=p.id WHERE p.id=? AND a.account_id=?",
                    [current['project_id'], account_id]) if current['accepted_by'] == account_id else []
                if current['accepted_by'] == account_id:
                    if access:
                        return access[0]
                    raise HTTPException(410, "Invitation already used")

                rightful = await d1.security_query(
                    "SELECT 1 FROM platform_account_profile WHERE account_id=? AND email_authoritative=1 "
                    "AND email IS NOT NULL AND lower(email)=lower(?)", [account_id, current['recipient_email']])
                if not rightful:
                    raise error
                if (current['accepted_by'] is not None or current['revoked_at'] is not None
                        or current['declined_at'] is not None or current['expires_at'] <= int(time.time())):
                    raise HTTPException(410, "Invitation expired or unavailable")
            except HTTPException as reconciliation_error:
                if reconciliation_error.status_code == 410:
                    raise
                raise error
            except Exception:
                raise error
            raise error
    access = await d1.security_query(
        "SELECT p.*, a.role AS access_role FROM projects p JOIN project_access a ON a.project_id=p.id "
        "WHERE p.id=? AND a.account_id=?", [invitation['project_id'], account_id])
    if not access:
        raise HTTPException(410, "Project access is no longer available")
    return access[0]


async def decline_email_invitation(invitation_id: str, account_id: str):
    invitation = await _email_invitation(invitation_id, account_id)
    if invitation['declined_at'] is not None:
        return
    if invitation['accepted_by'] is not None or invitation['revoked_at'] is not None or invitation['expires_at'] <= int(time.time()):
        raise HTTPException(410, "Invitation expired or unavailable")
    rows = await d1.security_query(
        "UPDATE project_invitation SET declined_at=unixepoch() WHERE id=? AND accepted_by IS NULL "
        "AND revoked_at IS NULL AND declined_at IS NULL AND expires_at>unixepoch() "
        "AND EXISTS (SELECT 1 FROM project_invitation_recipient r "
        "JOIN platform_account_profile p ON p.account_id=? AND p.email_authoritative=1 "
        "AND p.email IS NOT NULL AND lower(p.email)=lower(r.email) WHERE r.invitation_id=project_invitation.id) "
        "RETURNING id", [invitation_id, account_id])
    if rows:
        return
    # Re-read after a lost race. A decline retry is idempotent; other terminal states are gone.
    current = await _email_invitation(invitation_id, account_id)
    if current['declined_at'] is not None:
        return
    raise HTTPException(410, "Invitation expired or unavailable")

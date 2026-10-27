"""Revocable public-account sessions; no email-based linking or administrator promotion."""
import hashlib
import secrets
import time

from fastapi import HTTPException, Request
from app.core.auth import AuthenticatedUser, verify_session_token
from app.core.config import settings
from app.db import d1


def token_hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


async def resolve_session(request: Request) -> AuthenticatedUser | None:
    token = request.cookies.get(settings.AUTH_COOKIE_NAME)
    if not token or not settings.AUTH_SESSION_SECRET:
        return None
    if token.startswith("usr_"):
        rows = await d1.security_query(
            "SELECT account_id FROM platform_session WHERE token_hash = ? AND expires_at > ?",
            [token_hash(token), int(time.time())],
        )
        if rows:
            account = rows[0]["account_id"]
            return AuthenticatedUser(username=f"user-{account[:8]}", account_id=account, is_admin=False)
        return None
    user = verify_session_token(token)
    if user and not await d1.security_query("SELECT 1 FROM revoked_admin_session WHERE token_hash = ?", [token_hash(token)]):
        return user
    return None


async def create_account_session(account_id: str) -> str:
    token = "usr_" + secrets.token_urlsafe(32)
    if not await d1.execute(
        "INSERT INTO platform_session (token_hash, account_id, expires_at) VALUES (?, ?, ?)",
        [token_hash(token), account_id, int(time.time()) + settings.AUTH_SESSION_TTL_SECONDS],
    ):
        raise HTTPException(503, "Session storage unavailable")
    return token


async def revoke_session(request: Request) -> None:
    token = request.cookies.get(settings.AUTH_COOKIE_NAME)
    if not token:
        return
    if token.startswith("usr_"):
        ok = await d1.execute("DELETE FROM platform_session WHERE token_hash = ?", [token_hash(token)])
    else:
        if not verify_session_token(token):
            return
        ok = await d1.execute(
            "INSERT OR IGNORE INTO revoked_admin_session (token_hash, expires_at) VALUES (?, ?)",
            [token_hash(token), int(time.time()) + settings.AUTH_SESSION_TTL_SECONDS],
        )
    if not ok:
        raise HTTPException(503, "Session revocation unavailable")

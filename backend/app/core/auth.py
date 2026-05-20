from __future__ import annotations

import base64
import hashlib
import hmac
import os
import time
from dataclasses import dataclass

from fastapi import HTTPException, Request, status

from app.core.config import settings


HASH_ALGORITHM = "pbkdf2_sha256"
DEFAULT_HASH_ITERATIONS = 260_000


@dataclass(frozen=True)
class AuthenticatedUser:
    username: str


def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def hash_password(password: str, *, iterations: int = DEFAULT_HASH_ITERATIONS) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return f"{HASH_ALGORITHM}${iterations}${_b64encode(salt)}${_b64encode(digest)}"


def verify_password(password: str, stored_hash: str | None) -> bool:
    if not stored_hash:
        return False
    try:
        algorithm, iterations_raw, salt_raw, digest_raw = stored_hash.split("$", 3)
        if algorithm != HASH_ALGORITHM:
            return False
        iterations = int(iterations_raw)
        salt = _b64decode(salt_raw)
        expected = _b64decode(digest_raw)
    except (ValueError, TypeError):
        return False

    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(actual, expected)


def auth_is_configured() -> bool:
    return bool(settings.ADMIN_USERNAME and settings.ADMIN_PASSWORD_HASH and settings.AUTH_SESSION_SECRET)


def _require_auth_config() -> None:
    if not auth_is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin authentication is not configured",
        )


def create_session_token(username: str, *, now: int | None = None) -> str:
    _require_auth_config()
    issued_at = now or int(time.time())
    expires_at = issued_at + settings.AUTH_SESSION_TTL_SECONDS
    nonce = _b64encode(os.urandom(16))
    payload = f"{username}|{issued_at}|{expires_at}|{nonce}"
    signature = hmac.new(
        settings.AUTH_SESSION_SECRET.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{_b64encode(payload.encode('utf-8'))}.{signature}"


def verify_session_token(token: str | None, *, now: int | None = None) -> AuthenticatedUser | None:
    if not token or not auth_is_configured():
        return None
    try:
        payload_raw, signature = token.split(".", 1)
        payload = _b64decode(payload_raw).decode("utf-8")
    except (ValueError, UnicodeDecodeError):
        return None

    expected_signature = hmac.new(
        settings.AUTH_SESSION_SECRET.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(signature, expected_signature):
        return None

    try:
        username, _issued_at, expires_at_raw, _nonce = payload.split("|", 3)
        expires_at = int(expires_at_raw)
    except ValueError:
        return None

    if username != settings.ADMIN_USERNAME:
        return None
    if expires_at <= (now or int(time.time())):
        return None
    return AuthenticatedUser(username=username)


def get_session_user_from_request(request: Request) -> AuthenticatedUser | None:
    token = request.cookies.get(settings.AUTH_COOKIE_NAME)
    return verify_session_token(token)


def require_authenticated_user(request: Request) -> AuthenticatedUser:
    user = get_session_user_from_request(request)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return user

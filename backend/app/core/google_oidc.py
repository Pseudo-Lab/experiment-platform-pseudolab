"""Google authorization-code flow. Provider endpoints are fixed, never supplied by a caller."""
import base64
import hashlib
import hmac
import secrets
import time
import uuid
from urllib.parse import urlencode, urlsplit

import httpx
import jwt
from fastapi import HTTPException, Request
from fastapi.responses import RedirectResponse

from app.core.account_sessions import create_account_session, token_hash
from app.core.config import settings
from app.db import d1

AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
ATTEMPT_COOKIE = "experiment_platform_oauth"


def configured() -> bool:
    callback = urlsplit(settings.GOOGLE_OAUTH_REDIRECT_URI or "")
    return bool(settings.GOOGLE_OAUTH_CLIENT_ID and settings.GOOGLE_OAUTH_CLIENT_SECRET
                and settings.AUTH_SESSION_SECRET and settings.AUTH_COOKIE_SECURE
                and callback.scheme == "https" and callback.hostname
                and not callback.username and not callback.password
                and not callback.query and not callback.fragment
                and callback.path == settings.API_V1_STR + "/auth/google/callback")


def require_configured() -> None:
    if not configured():
        raise HTTPException(503, "Google sign in is not configured")


async def begin() -> RedirectResponse:
    require_configured()
    state, browser, nonce, verifier = [secrets.token_urlsafe(32) for _ in range(4)]
    now = int(time.time())
    await d1.execute("DELETE FROM oauth_attempt WHERE expires_at <= ?", [now])
    if not await d1.execute(
        "INSERT INTO oauth_attempt (state_hash, browser_hash, nonce, verifier, expires_at) VALUES (?, ?, ?, ?, ?)",
        [token_hash(state), token_hash(browser), nonce, verifier, now + 600],
    ):
        raise HTTPException(503, "Sign in storage unavailable")
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    response = RedirectResponse(AUTHORIZE_URL + "?" + urlencode({
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "response_type": "code", "scope": "openid", "state": state,
        "nonce": nonce, "code_challenge": challenge, "code_challenge_method": "S256",
    }), status_code=303)
    response.set_cookie(ATTEMPT_COOKIE, browser, max_age=600, secure=True,
                        httponly=True, samesite="lax", path=settings.API_V1_STR + "/auth/google")
    return response


async def verify_id_token(encoded: str, nonce: str, client: httpx.AsyncClient) -> dict:
    header = jwt.get_unverified_header(encoded)
    if header.get("alg") != "RS256" or not isinstance(header.get("kid"), str):
        raise ValueError("Invalid signing algorithm")
    response = await client.get(JWKS_URL)
    response.raise_for_status()
    keys = response.json()["keys"]
    matches = [key for key in keys if key.get("kid") == header["kid"] and key.get("kty") == "RSA"
               and key.get("use", "sig") == "sig" and key.get("alg", "RS256") == "RS256"]
    if len(matches) != 1:
        raise ValueError("Unknown signing key")
    key = jwt.PyJWK.from_dict(matches[0], algorithm="RS256").key
    claims = jwt.decode(encoded, key, algorithms=["RS256"], audience=settings.GOOGLE_OAUTH_CLIENT_ID,
                        issuer=["https://accounts.google.com", "accounts.google.com"],
                        options={"require": ["iss", "aud", "exp", "iat", "sub", "nonce"]})
    if claims.get("azp", settings.GOOGLE_OAUTH_CLIENT_ID) != settings.GOOGLE_OAUTH_CLIENT_ID:
        raise ValueError("Invalid authorized party")
    if isinstance(claims["aud"], list) and len(claims["aud"]) > 1 and "azp" not in claims:
        raise ValueError("Missing authorized party")
    if not isinstance(claims["sub"], str) or not 1 <= len(claims["sub"]) <= 255:
        raise ValueError("Invalid subject")
    if not isinstance(claims["nonce"], str) or not hmac.compare_digest(claims["nonce"].encode(), nonce.encode()):
        raise ValueError("Invalid nonce")
    return claims


async def finish(request: Request) -> RedirectResponse:
    require_configured()
    # A fixed same-origin destination prevents open redirects and token leakage.
    response = RedirectResponse("/login?oauth=failed", status_code=303)
    response.delete_cookie(ATTEMPT_COOKIE, path=settings.API_V1_STR + "/auth/google",
                           secure=True, httponly=True, samesite="lax")
    state = request.query_params.get("state", "")
    browser = request.cookies.get(ATTEMPT_COOKIE, "")
    if not state or not browser or len(state) > 256 or len(browser) > 256:
        return response
    # Atomic consumption: replay/concurrent callbacks cannot redeem the same attempt.
    rows = await d1.security_query(
        "DELETE FROM oauth_attempt WHERE state_hash = ? AND browser_hash = ? AND expires_at > ? RETURNING nonce, verifier",
        [token_hash(state), token_hash(browser), int(time.time())],
    )
    if not rows or request.query_params.get("error") or not request.query_params.get("code"):
        return response
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
            result = await client.post(TOKEN_URL, data={
                "grant_type": "authorization_code", "code": request.query_params["code"],
                "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
                "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
                "code_verifier": rows[0]["verifier"],
            })
            result.raise_for_status()
            claims = await verify_id_token(result.json()["id_token"], rows[0]["nonce"], client)
        # No email/profile storage, no account linking, no admin role from provider claims.
        account_id = str(uuid.uuid4())
        ok = await d1.execute(
            "INSERT INTO platform_account (id, google_sub, created_at) VALUES (?, ?, ?) ON CONFLICT(google_sub) DO NOTHING",
            [account_id, claims["sub"], int(time.time())],
        )
        if not ok:
            return response
        accounts = await d1.security_query("SELECT id FROM platform_account WHERE google_sub = ?", [claims["sub"]])
        if not accounts:
            return response
        token = await create_account_session(accounts[0]["id"])
    except (httpx.HTTPError, jwt.PyJWTError, ValueError, KeyError, TypeError, HTTPException):
        return response
    response.headers["location"] = "/projects"
    response.set_cookie(settings.AUTH_COOKIE_NAME, token, max_age=settings.AUTH_SESSION_TTL_SECONDS,
                        secure=True, httponly=True, samesite="lax", path="/")
    return response

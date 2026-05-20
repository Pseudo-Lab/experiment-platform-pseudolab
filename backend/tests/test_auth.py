from fastapi.testclient import TestClient

from app.core.auth import hash_password, verify_password
from app.core.config import settings
from app.main import app

client = TestClient(app)


def _configure_auth(monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_USERNAME", "admin")
    monkeypatch.setattr(settings, "ADMIN_PASSWORD_HASH", hash_password("secret"))
    monkeypatch.setattr(settings, "AUTH_SESSION_SECRET", "test-session-secret-that-is-long-enough")
    monkeypatch.setattr(settings, "AUTH_COOKIE_SECURE", False)


def test_password_hash_verification():
    stored = hash_password("secret")

    assert verify_password("secret", stored) is True
    assert verify_password("wrong", stored) is False
    assert verify_password("secret", "not-a-supported-hash") is False


def test_login_me_and_logout(monkeypatch):
    _configure_auth(monkeypatch)

    login = client.post("/api/v1/auth/login", json={"username": "admin", "password": "secret"})
    assert login.status_code == 200
    assert login.json() == {"authenticated": True, "user": {"username": "admin"}}

    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json() == {"authenticated": True, "user": {"username": "admin"}}

    logout = client.post("/api/v1/auth/logout")
    assert logout.status_code == 200
    assert logout.json() == {"authenticated": False, "user": None}

    me_after_logout = client.get("/api/v1/auth/me")
    assert me_after_logout.status_code == 200
    assert me_after_logout.json() == {"authenticated": False, "user": None}


def test_invalid_login_returns_401(monkeypatch):
    _configure_auth(monkeypatch)

    response = client.post("/api/v1/auth/login", json={"username": "admin", "password": "wrong"})

    assert response.status_code == 401


def test_configured_auth_protects_management_api(monkeypatch):
    _configure_auth(monkeypatch)
    client.cookies.clear()

    protected = client.get("/api/v1/experiments/")
    assert protected.status_code == 401

    status_response = client.get("/api/v1/status")
    assert status_response.status_code == 200

    login = client.post("/api/v1/auth/login", json={"username": "admin", "password": "secret"})
    assert login.status_code == 200

    authenticated = client.get("/api/v1/experiments/")
    assert authenticated.status_code == 200

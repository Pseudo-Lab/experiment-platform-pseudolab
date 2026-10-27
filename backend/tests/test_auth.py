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
    monkeypatch.setattr(settings, "BACKEND_CORS_ORIGINS", ["http://localhost:8081"])


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


def test_configured_auth_keeps_placement_decide_public(monkeypatch):
    _configure_auth(monkeypatch)
    client.cookies.clear()

    unified_decide = client.post(
        "/api/v1/decide",
        json={"key": "missing-placement", "user_id": "user-runner"},
    )
    placement_only = client.get(
        "/api/v1/placements/missing-placement/decide",
        params={"user_id": "user-runner", "project_id": "project-s12"},
    )
    explicit_experiment = client.get(
        "/api/v1/experiments/missing-experiment/placements/missing-placement/decide",
        params={"user_id": "user-runner", "project_id": "project-s12"},
    )
    protected_config = client.get("/api/v1/experiments/missing-experiment/placements")

    assert unified_decide.status_code == 200
    assert unified_decide.json()["payload"]["reason"] == "not_found"
    assert placement_only.status_code == 200
    assert placement_only.json()["reason"] == "not_found"
    assert explicit_experiment.status_code == 200
    assert explicit_experiment.json()["reason"] == "experiment_not_found"
    assert protected_config.status_code == 401


def test_all_management_routes_require_session(monkeypatch):

    _configure_auth(monkeypatch)
    client.cookies.clear()
    # Independent contract inventory: a newly added management route is protected
    # unless it is explicitly reviewed as an SDK/external-service endpoint here.
    public = {
        'GET': {'/api/v1/sdk/demo-config', '/api/v1/status/', '/api/v1/auth/me', '/api/v1/feature-flags/decide',
                '/api/v1/experiments/assignment', '/api/v1/experiments/{experiment_id}/assign/{user_id}',
                '/api/v1/placements/{key}/decide',
                '/api/v1/experiments/{experiment_id}/placements/{placement_key}/decide',
                '/api/v1/reflections/check'},
        'POST': {'/api/v1/auth/login', '/api/v1/auth/logout', '/api/v1/capture',
                 '/api/v1/identify', '/api/v1/decide', '/api/v1/events',
                 '/api/v1/ingest/events', '/api/v1/access/decide', '/api/v1/reflections/'},
    }
    checked = 0
    for path, operations in app.openapi()['paths'].items():
        if not path.startswith('/api/v1/'):
            continue
        for operation in operations:
            method = operation.upper()
            if method not in {'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'}:
                continue
            if path in public.get(method, set()):
                continue
            response = client.request(method, path)
            assert response.status_code == 401, (method, path, response.text)
            checked += 1
    assert checked > 50


def test_public_paths_do_not_allow_other_methods_or_nested_management(monkeypatch):
    _configure_auth(monkeypatch)
    client.cookies.clear()
    for method, path in [
        ('POST', '/api/v1/feature-flags/decide'),
        ('PATCH', '/api/v1/experiments/e/assign/u'),
        ('GET', '/api/v1/experiments/e/assign/u/result'),
        ('POST', '/api/v1/placements/p/decide'),
        ('GET', '/api/v1/experiments/e/placements'),
    ]:
        assert client.request(method, path).status_code == 401


def test_sdk_contracts_without_admin_session(monkeypatch, mock_d1):
    from app.services.experiment import experiment_service

    _configure_auth(monkeypatch)
    client.cookies.clear()
    mock_d1.execute("INSERT INTO projects (id, name, api_key) VALUES ('p', 'project', 'sdk-test-key')")
    mock_d1.commit()

    async def assign(experiment_id, user_id):
        assert (experiment_id, user_id) == ('e', 'u')
        return {'experiment_id': 'e', 'variant_name': 'control', 'user_id': 'u', 'assigned_at': '2026-10-22T00:00:00Z'}

    monkeypatch.setattr(experiment_service, 'assign', assign)
    assignment = client.get('/api/v1/experiments/assignment?experiment_id=e&uid=u')
    assert assignment.status_code == 200
    assert client.post('/api/v1/events', json={'type': 'impression', 'key': 'missing', 'user_id': 'u'}).status_code == 202
    assert client.post('/api/v1/ingest/events', json={'events': []}, headers={'X-API-Key': 'sdk-test-key'}).status_code == 202
    invalid_key = client.post('/api/v1/decide', json={'key': 'missing', 'user_id': 'u'}, headers={'X-API-Key': 'invalid'})
    assert invalid_key.status_code == 401
    assert invalid_key.json()['detail'] == 'Invalid API key'
    assert client.get('/api/v1/reflections/check?user_id=u&experiment_id=e').status_code == 200
    assert client.post('/api/v1/reflections/', json={}).status_code == 422
    assert client.get('/api/v1/reflections/summary?experiment_id=e').status_code == 401
    access = client.post('/api/v1/access/decide', json={})
    assert access.status_code == 401
    assert access.headers['www-authenticate'] == 'Bearer'
    # Public SDK keys cannot authenticate server requests.
    authorized = client.post('/api/v1/access/decide', json={}, headers={'Authorization': 'Bearer sdk-test-key'})
    assert authorized.status_code == 401
    assert client.get('/api/v1/projects/', headers={'Authorization': 'Bearer sdk-test-key'}).status_code == 401


def test_missing_and_partial_auth_configuration(monkeypatch):
    for name in ('ADMIN_USERNAME', 'ADMIN_PASSWORD_HASH', 'AUTH_SESSION_SECRET'):
        monkeypatch.setattr(settings, name, None)
    client.cookies.clear()
    assert client.get('/api/v1/experiments/').status_code == 503
    assert client.get('/api/v1/auth/me').json()['authenticated'] is False
    assert client.post('/api/v1/auth/login', json={'username': 'admin', 'password': 'secret'}).status_code == 503
    monkeypatch.setattr(settings, 'ADMIN_USERNAME', 'admin')
    assert client.get('/api/v1/experiments/').status_code == 503
    assert client.get('/api/v1/status').status_code == 200


def test_expired_tampered_and_malformed_sessions(monkeypatch):
    from app.core.auth import create_session_token, verify_session_token

    _configure_auth(monkeypatch)
    token = create_session_token('admin', now=0)
    assert verify_session_token(token, now=1) is not None
    assert verify_session_token(token, now=settings.AUTH_SESSION_TTL_SECONDS) is None
    for value in (token, token + 'tampered', 'bad.서명', 'invalid'):
        client.cookies.clear()
        client.cookies.set(settings.AUTH_COOKIE_NAME, value if value.isascii() else 'invalid')
        assert client.get('/api/v1/experiments/').status_code == 401
        assert client.get('/api/v1/auth/me').json()['authenticated'] is False
        if value != token:
            assert verify_session_token(value) is None
    client.cookies.clear()
    assert verify_password('secret', 'pbkdf2_sha256$0$c2FsdA$ZGlnZXN0') is False


def test_https_cookie_and_preflight(monkeypatch):
    _configure_auth(monkeypatch)
    monkeypatch.setattr(settings, 'AUTH_COOKIE_SECURE', True)
    with TestClient(app, base_url='https://testserver') as https:
        response = https.post('/api/v1/auth/login', json={'username': 'admin', 'password': 'secret'})
        cookie = response.headers['set-cookie']
        for attribute in ('HttpOnly', 'Secure', 'SameSite=lax', 'Max-Age=43200', 'Path=/'):
            assert attribute in cookie
        assert https.get('/api/v1/experiments/').status_code == 200
        logout = https.post('/api/v1/auth/logout')
        assert 'Max-Age=0' in logout.headers['set-cookie']
        assert 'Secure' in logout.headers['set-cookie']
        assert https.get('/api/v1/experiments/').status_code == 401
    preflight = client.options('/api/v1/experiments/', headers={'Origin': 'http://localhost:8081', 'Access-Control-Request-Method': 'GET'})
    assert preflight.status_code == 200
    denied = client.get('/api/v1/experiments/', headers={'Origin': 'http://localhost:8081'})
    assert denied.status_code == 401
    assert 'access-control-allow-origin' in denied.headers


def test_project_keys_only_in_authenticated_key_endpoint(monkeypatch):
    _configure_auth(monkeypatch)
    with TestClient(app) as browser:
        for path in ("/api/v1/projects/", "/api/v1/projects/security-test", "/api/v1/projects/security-test/api-key"):
            assert browser.get(path).status_code == 401
        assert browser.post('/api/v1/auth/login', json={'username': 'admin', 'password': 'secret'}).status_code == 200
        created = browser.post('/api/v1/projects/', json={'id': 'security-test', 'name': 'Security test'})
        assert created.status_code == 201
        assert 'api_key' not in created.json()
        for response in [browser.get('/api/v1/projects/security-test'),
                         browser.patch('/api/v1/projects/security-test', json={'base_url': 'https://example.test'})]:
            assert response.status_code == 200
            assert 'api_key' not in response.json()
        listed = browser.get('/api/v1/projects/')
        assert all('api_key' not in p for p in listed.json())
        key_response = browser.get('/api/v1/projects/security-test/api-key')
        assert key_response.status_code == 200
        assert key_response.json()['api_key']
        assert key_response.headers['cache-control'] == 'no-store'
        assert browser.get('/api/v1/projects/missing/api-key').status_code == 404


def test_missing_config_blocks_all_management_routes(monkeypatch):
    for name in ('ADMIN_USERNAME', 'ADMIN_PASSWORD_HASH', 'AUTH_SESSION_SECRET'):
        monkeypatch.setattr(settings, name, None)
    # Routes verified as protected by the configured-auth inventory must also
    # fail closed without settings. Exercise every actual write/read endpoint.
    _configure_auth(monkeypatch)
    with TestClient(app) as browser:
        protected = [(method.upper(), path) for path, operations in app.openapi()['paths'].items()
                     for method in operations if method in {'get', 'post', 'put', 'patch', 'delete'}
                     if browser.request(method, path).status_code == 401
                     and path != '/api/v1/access/decide']
        for name in ('ADMIN_USERNAME', 'ADMIN_PASSWORD_HASH', 'AUTH_SESSION_SECRET'):
            monkeypatch.setattr(settings, name, None)
        for method, path in protected:
            assert browser.request(method, path).status_code == 503, (method, path)
        assert len(protected) > 50


def test_untrusted_origins_cannot_login_logout_or_write(monkeypatch):
    _configure_auth(monkeypatch)
    monkeypatch.setattr(settings, 'BACKEND_CORS_ORIGINS', ['*', 'https://trusted.test'])
    with TestClient(app) as browser:
        credentials = {'username': 'admin', 'password': 'secret'}
        assert browser.post('/api/v1/auth/login', json=credentials, headers={'Origin': 'https://attacker.test'}).status_code == 403
        assert browser.post('/api/v1/auth/login', json=credentials, headers={'Origin': 'https://trusted.test'}).status_code == 200
        for method, path in [('GET', '/api/v1/projects/'), ('GET', '/api/v1/auth/me'), ('POST', '/api/v1/projects/'), ('DELETE', '/api/v1/projects/p'), ('POST', '/api/v1/auth/logout')]:
            assert browser.request(method, path, headers={'Origin': 'https://attacker.test'}).status_code == 403
        assert browser.get('/api/v1/auth/me').json()['authenticated'] is True
        assert browser.post('/api/v1/auth/logout', headers={'Origin': 'http://testserver'}).status_code == 200


def test_removed_project_key_cannot_use_bearer_access(monkeypatch, mock_d1):
    _configure_auth(monkeypatch)
    mock_d1.execute("INSERT INTO projects (id, name, api_key) VALUES ('p', 'P', 'old-test-key')")
    mock_d1.commit()
    body = {'flag_key': 'missing', 'user_id': 'u'}
    with TestClient(app) as sdk:
        assert sdk.post('/api/v1/access/decide', json=body, headers={'Authorization': 'Bearer old-test-key'}).status_code == 401
        mock_d1.execute("UPDATE projects SET api_key = 'replacement-test-key' WHERE id = 'p'")
        mock_d1.commit()
        assert sdk.post('/api/v1/access/decide', json=body, headers={'Authorization': 'Bearer old-test-key'}).status_code == 401
        assert sdk.post('/api/v1/access/decide', json=body, headers={'Authorization': 'Bearer replacement-test-key'}).status_code == 401
        assert sdk.post('/api/v1/capture', json={'event': 'test', 'user_id': 'u'}, headers={'X-API-Key': 'old-test-key'}).status_code == 401


def test_auth_rejections_are_never_cacheable(monkeypatch):
    _configure_auth(monkeypatch)
    with TestClient(app) as browser:
        denied = browser.get('/api/v1/projects/')
        assert denied.status_code == 401
        assert denied.headers.get('cache-control') == 'no-store'
        forbidden = browser.post('/api/v1/auth/login', json={}, headers={'Origin': 'https://attacker.test'})
        assert forbidden.status_code == 403
        assert forbidden.headers.get('cache-control') == 'no-store'
        monkeypatch.setattr(settings, 'AUTH_SESSION_SECRET', None)
        unavailable = browser.get('/api/v1/projects/')
        assert unavailable.status_code == 503
        assert unavailable.headers.get('cache-control') == 'no-store'

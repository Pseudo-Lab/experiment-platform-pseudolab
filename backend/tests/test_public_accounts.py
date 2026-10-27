import asyncio
import json
import time
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app.core.auth import hash_password
from app.core.account_sessions import create_account_session
from app.core.config import settings
from app.core import google_oidc
from app.main import app


@pytest.fixture
def clients(monkeypatch, mock_d1):
    monkeypatch.setattr(settings, "ADMIN_USERNAME", "admin")
    monkeypatch.setattr(settings, "ADMIN_PASSWORD_HASH", hash_password("synthetic", iterations=1000))
    monkeypatch.setattr(settings, "AUTH_SESSION_SECRET", "synthetic-session-secret")
    monkeypatch.setattr(settings, "AUTH_COOKIE_SECURE", True)
    monkeypatch.setattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "test-client")
    monkeypatch.setattr(settings, "GOOGLE_OAUTH_CLIENT_SECRET", "synthetic-secret")
    monkeypatch.setattr(settings, "GOOGLE_OAUTH_REDIRECT_URI", "https://testserver/api/v1/auth/google/callback")
    out = []
    for name in ['a', 'b']:
        mock_d1.execute("INSERT INTO platform_account VALUES (?, ?, ?)", [name, 'google-' + name, int(time.time())])
        token = asyncio.run(create_account_session(name))
        c = TestClient(app, base_url="https://testserver")
        c.cookies.set(settings.AUTH_COOKIE_NAME, token)
        out.append(c)
    admin = TestClient(app, base_url="https://testserver")
    assert admin.post('/api/v1/auth/login', json={'username': 'admin', 'password': 'synthetic'}).status_code == 200
    return *out, admin


def project(client, name):
    r = client.post('/api/v1/projects/', json={'id': name, 'name': name})
    assert r.status_code == 201, r.text
    return client.get(f'/api/v1/projects/{name}/api-key').json()['api_key']


def test_accounts_projects_and_revocation(clients, mock_d1):
    a, b, admin = clients
    project(admin, 'legacy')
    project(a, 'project-a')
    project(b, 'project-b')
    assert [p['id'] for p in a.get('/api/v1/projects/').json()] == ['project-a']
    for path in ['legacy', 'project-b', 'project-b/api-key', 'project-b/sdk-status']:
        assert a.get('/api/v1/projects/' + path).status_code == 404
    assert a.patch('/api/v1/projects/project-b', json={'base_url': 'https://example.com'}).status_code == 404
    assert a.delete('/api/v1/projects/project-b').status_code == 404
    assert len(admin.get('/api/v1/projects/').json()) == 3
    token = a.cookies.get(settings.AUTH_COOKIE_NAME)
    assert a.post('/api/v1/auth/logout').status_code == 200
    assert a.get('/api/v1/projects/', headers={'Cookie': f'{settings.AUTH_COOKIE_NAME}={token}'}).status_code == 401
    admin_token = admin.cookies.get(settings.AUTH_COOKIE_NAME)
    assert admin.post('/api/v1/auth/logout').status_code == 200
    assert admin.get('/api/v1/projects/', headers={'Cookie': f'{settings.AUTH_COOKIE_NAME}={admin_token}'}).status_code == 401


def test_resource_payloads_sdk_and_server_keys(clients):
    a, b, admin = clients
    ka, kb = project(a, 'project-a'), project(b, 'project-b')
    for c, name in [(a, 'a'), (b, 'b')]:
        r = c.post('/api/v1/feature-flags/', json={'flag_key': 'flag-' + name, 'project_id': 'project-' + name, 'enabled': True})
        assert r.status_code == 201, r.text
        r = c.post('/api/v1/experiments/', json={'id': 'exp-' + name, 'name': name, 'project_id': 'project-' + name, 'flag_key': 'flag-' + name})
        assert r.status_code == 201, r.text
    assert [f['flag_key'] for f in a.get('/api/v1/feature-flags/').json()] == ['flag-a']
    assert [e['id'] for e in a.get('/api/v1/experiments/').json()] == ['exp-a']
    for path in ['/experiments/exp-b', '/experiments/exp-b/visual-changes', '/feature-flags/flag-b/rules', '/feature-flags/flag-b/exposures']:
        assert a.get('/api/v1' + path).status_code == 404
    assert a.patch('/api/v1/experiments/exp-a', json={'project_id': 'project-b'}).status_code == 403
    assert a.patch('/api/v1/experiments/exp-a', json={'flag_key': 'flag-b'}).status_code == 404
    assert a.post('/api/v1/feature-flags/flag-a/rules', json={'segment_id': 'internal'}).status_code == 403
    for path in ['/dashboard/summary', '/segments/', '/analytics/events', '/admin/srm-check', '/visual-changes/id', '/reflections/summary']:
        assert a.get('/api/v1' + path).status_code == 403
    sdk = TestClient(app, base_url='https://testserver')
    for key in [None, kb]:
        headers = {'X-API-Key': key} if key else {}
        assert sdk.post('/api/v1/decide', json={'key': 'flag-a', 'user_id': 'visitor'}, headers=headers).status_code == 404
        assert sdk.get('/api/v1/experiments/assignment?experiment_id=exp-a&uid=visitor', headers=headers).status_code == 404
    assert sdk.post('/api/v1/decide', json={'key': 'flag-a', 'user_id': 'visitor'}, headers={'X-API-Key': ka}).status_code == 200
    for payload in [{'experiment_id': 'exp-b'}, {'properties': {'experiment_id': 'exp-b'}}]:
        assert sdk.post('/api/v1/capture', json={'event_name': 'click', 'user_id': 'visitor', **payload}, headers={'X-API-Key': ka}).status_code == 404
    assert sdk.post('/api/v1/capture', json={'event_name': 'click', 'user_id': 'visitor'}, headers={'X-API-Key': ka}).status_code == 202
    assert sdk.post('/api/v1/identify', json={'user_id': 'internal'}, headers={'X-API-Key': ka}).status_code == 403
    assert sdk.post('/api/v1/access/decide', json={}, headers={'Authorization': 'Bearer ' + ka}).status_code == 401
    server = a.post('/api/v1/projects/project-a/server-key').json()['server_key']
    assert sdk.post('/api/v1/access/decide', json={}, headers={'Authorization': 'Bearer ' + server}).status_code == 422
    assert sdk.post('/api/v1/capture', json={}, headers={'X-API-Key': server}).status_code == 401
    assert a.delete('/api/v1/projects/project-a/server-key').status_code == 204
    assert sdk.post('/api/v1/access/decide', json={}, headers={'Authorization': 'Bearer ' + server}).status_code == 401


@pytest.fixture
def provider(monkeypatch):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()))
    public.update(kid='test-key', alg='RS256', use='sig')
    state = {'nonce': '', 'claims': {}, 'exchange_count': 0}
    def handle(request):
        if str(request.url) == google_oidc.JWKS_URL:
            return httpx.Response(200, json={'keys': [public]})
        assert str(request.url) == google_oidc.TOKEN_URL
        body = parse_qs(request.content.decode())
        assert body['code_verifier'] and body['client_secret'] == ['synthetic-secret']
        state['exchange_count'] += 1
        claims = {'iss': 'https://accounts.google.com', 'aud': 'test-client', 'sub': 'new-google-sub',
                  'exp': int(time.time()) + 300, 'iat': int(time.time()), 'nonce': state['nonce'], **state['claims']}
        return httpx.Response(200, json={'id_token': jwt.encode(claims, key, algorithm='RS256', headers={'kid': 'test-key'})})
    original = httpx.AsyncClient
    monkeypatch.setattr(google_oidc.httpx, 'AsyncClient', lambda **kwargs: original(transport=httpx.MockTransport(handle), **kwargs))
    return state


def start(client, provider):
    r = client.get('/api/v1/auth/google/start', follow_redirects=False)
    assert r.status_code == 303
    assert r.headers['cache-control'] == 'no-store'
    assert 'HttpOnly' in r.headers['set-cookie'] and 'Secure' in r.headers['set-cookie']
    query = parse_qs(urlsplit(r.headers['location']).query)
    assert query['code_challenge_method'] == ['S256'] and query['scope'] == ['openid']
    provider['nonce'] = query['nonce'][0]
    return query['state'][0]


def test_oidc_success_replay_sub_identity(clients, provider, mock_d1):
    client = TestClient(app, base_url='https://testserver')
    state = start(client, provider)
    callback = f'/api/v1/auth/google/callback?state={state}&code=synthetic'
    r = client.get(callback, follow_redirects=False)
    assert r.headers['location'] == '/projects'
    assert client.get('/api/v1/auth/me').json()['user']['is_admin'] is False
    assert client.get('/api/v1/projects/').json() == []
    assert client.get(callback, follow_redirects=False).headers['location'] == '/login?oauth=failed'
    assert provider['exchange_count'] == 1
    assert mock_d1.execute("SELECT count(*) FROM platform_account WHERE google_sub='new-google-sub'").fetchone()[0] == 1


@pytest.mark.parametrize('claims', [
    {'iss': 'https://evil.example'}, {'aud': 'another-client'}, {'exp': 1},
    {'nonce': 'wrong'}, {'sub': ''}, {'azp': 'evil-client'}, {'iat': int(time.time()) + 3600},
])
def test_oidc_rejects_claims(clients, provider, claims):
    provider['claims'] = claims
    c = TestClient(app, base_url='https://testserver')
    state = start(c, provider)
    r = c.get(f'/api/v1/auth/google/callback?state={state}&code=synthetic', follow_redirects=False)
    assert r.headers['location'] == '/login?oauth=failed'
    assert c.get('/api/v1/auth/me').json()['authenticated'] is False


def test_oidc_state_refusal_missing_config(clients, provider, monkeypatch):
    c = TestClient(app, base_url='https://testserver')
    state = start(c, provider)
    other = TestClient(app, base_url='https://testserver')
    assert other.get(f'/api/v1/auth/google/callback?state={state}&code=x', follow_redirects=False).headers['location'].endswith('failed')
    assert c.get(f'/api/v1/auth/google/callback?state={state}&error=access_denied', follow_redirects=False).headers['location'].endswith('failed')
    assert provider['exchange_count'] == 0
    assert c.get('/api/v1/auth/google/start', headers={'Origin': 'https://evil.example'}, follow_redirects=False).status_code == 403
    monkeypatch.setattr(settings, 'GOOGLE_OAUTH_CLIENT_SECRET', None)
    assert c.get('/api/v1/auth/providers').json() == {'google': False}
    assert c.get('/api/v1/auth/google/start').status_code == 503


def test_migration_replay_preservation_constraints(clients, mock_d1):
    a, b, admin = clients
    project(admin, 'legacy')
    project(a, 'project-a')
    before = list(mock_d1.execute('SELECT * FROM projects'))
    migration = (Path(__file__).parents[1] / 'migrations/034_public_accounts.sql').read_text()
    mock_d1.commit()
    mock_d1.executescript(migration)
    mock_d1.executescript(migration)
    assert list(mock_d1.execute('SELECT * FROM projects')) == before
    assert mock_d1.execute("SELECT 1 FROM project_owner WHERE project_id='legacy'").fetchone() is None
    assert list(mock_d1.execute('PRAGMA foreign_key_check')) == []
    assert mock_d1.execute("SELECT 1 FROM sqlite_master WHERE name='idx_project_owner_account'").fetchone()
    with pytest.raises(Exception):
        mock_d1.execute("INSERT INTO project_owner VALUES ('missing', 'a')")


def test_server_key_cannot_probe_internal_segment(clients, mock_d1):
    a, _, _ = clients
    project(a, 'project-a')
    assert a.post('/api/v1/feature-flags/', json={'flag_key': 'access-a', 'project_id': 'project-a', 'enabled': True,
        'payload': {'access_mode': 'committee', 'committee_segment_id': 'internal'}}).status_code == 201
    server = a.post('/api/v1/projects/project-a/server-key').json()['server_key']
    c = TestClient(app, base_url='https://testserver')
    r = c.post('/api/v1/access/decide', headers={'Authorization': 'Bearer ' + server}, json={'user_id': 'internal-user', 'flag_key': 'access-a'})
    assert r.status_code == 200, r.text
    assert r.json()['allow'] is False


def test_signature_and_unknown_key_rejected(clients):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    wrong = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()))
    public['kid'] = 'trusted'
    async def verify():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, json={'keys': [public]}))) as c:
            claims = {'iss': 'https://accounts.google.com', 'aud': 'test-client', 'exp': int(time.time()) + 300,
                      'iat': int(time.time()), 'sub': 's', 'nonce': 'n'}
            for signing_key, kid in [(wrong, 'trusted'), (key, 'unknown')]:
                encoded = jwt.encode(claims, signing_key, algorithm='RS256', headers={'kid': kid})
                with pytest.raises((jwt.PyJWTError, ValueError)):
                    await google_oidc.verify_id_token(encoded, 'n', c)
            forged = jwt.encode(claims, 'attacker-secret', algorithm='HS256', headers={'kid': 'trusted'})
            with pytest.raises(ValueError):
                await google_oidc.verify_id_token(forged, 'n', c)
    asyncio.run(verify())


def test_security_storage_failure_blocks_admin(clients, monkeypatch):
    _, _, admin = clients
    from fastapi import HTTPException
    from app.db import d1
    async def unavailable(*args, **kwargs):
        raise HTTPException(503, 'Security storage unavailable')
    monkeypatch.setattr(d1, 'security_query', unavailable)
    r = admin.get('/api/v1/projects/')
    assert r.status_code == 503 and r.headers['cache-control'] == 'no-store'

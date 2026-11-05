import asyncio
import base64
import hashlib
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


def test_automatic_project_id_keeps_ownership_and_sdk_scope(clients, mock_d1):
    a, b, _ = clients
    response = a.post('/api/v1/projects/', json={'name': 'Automatic'})
    assert response.status_code == 201
    project_id = response.json()['id']
    assert mock_d1.execute("SELECT account_id FROM project_owner WHERE project_id=?", [project_id]).fetchone()[0] == 'a'
    assert a.get('/api/v1/projects/' + project_id).status_code == 200
    assert b.get('/api/v1/projects/' + project_id).status_code == 404
    assert b.get('/api/v1/projects/' + project_id + '/api-key').status_code == 404
    assert b.get('/api/v1/projects/').json() == []
    key = a.get('/api/v1/projects/' + project_id + '/api-key').json()['api_key']
    sdk = TestClient(app, base_url='https://testserver')
    assert sdk.post('/api/v1/capture', json={'event_name': 'click', 'user_id': 'visitor'}, headers={'X-API-Key': key}).status_code == 202
    assert mock_d1.execute("SELECT project_id FROM event_log WHERE user_id='visitor'").fetchone()[0] == project_id


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
        assert sdk.post('/api/v1/decide', json={'key': 'flag-a', 'user_id': 'visitor'}, headers=headers).status_code == (401 if key is None else 404)
        assert sdk.get('/api/v1/experiments/assignment?experiment_id=exp-a&uid=visitor', headers=headers).status_code == (401 if key is None else 404)
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
        challenge = base64.urlsafe_b64encode(hashlib.sha256(body['code_verifier'][0].encode()).digest()).decode().rstrip('=')
        assert challenge == state['challenge']
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
    provider['challenge'] = query['code_challenge'][0]
    return query['state'][0]


def test_oidc_success_replay_sub_identity(clients, provider, mock_d1):
    client = TestClient(app, base_url='https://testserver')
    state = start(client, provider)
    callback = f'/api/v1/auth/google/callback?state={state}&code=synthetic'
    r = client.get(callback, follow_redirects=False)
    assert r.headers['location'] == '/login?oauth=success'
    assert client.get('/api/v1/auth/me').json()['user']['is_admin'] is False
    assert client.get('/api/v1/projects/').json() == []
    assert client.get(callback, follow_redirects=False).headers['location'] == '/login?oauth=failed'
    assert provider['exchange_count'] == 1
    assert mock_d1.execute("SELECT count(*) FROM platform_account WHERE google_sub='new-google-sub'").fetchone()[0] == 1


@pytest.mark.parametrize('claims', [
    {'iss': 'https://evil.example'}, {'aud': 'another-client'}, {'exp': 1},
    {'aud': ['test-client', 'other']}, {'nonce': 'wrong'}, {'sub': ''}, {'azp': 'evil-client'}, {'iat': int(time.time()) + 3600},
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


def test_invalid_logout_does_not_create_revocation(clients, mock_d1):
    from app.core.auth import create_session_token
    c = TestClient(app, base_url='https://testserver')
    for token in [None, 'forged', 'a.b', create_session_token('admin', now=1)]:
        headers = {'Cookie': f'{settings.AUTH_COOKIE_NAME}={token}'} if token else {}
        response = c.post('/api/v1/auth/logout', headers=headers)
        assert response.status_code == 200
        assert 'Max-Age=0' in response.headers['set-cookie']
    assert mock_d1.execute('SELECT count(*) FROM revoked_admin_session').fetchone()[0] == 0


def test_capture_owner_lookup_failure_never_reads_person(clients, monkeypatch):
    from app.db import d1
    from app.services.event import event_service
    from app.schemas.event import EventCapture
    from fastapi import HTTPException
    async def unavailable(*args, **kwargs):
        raise HTTPException(503, 'unavailable')
    async def forbidden(*args, **kwargs):
        pytest.fail('Legacy lookup or write after security lookup failure')
    monkeypatch.setattr(d1, 'security_query', unavailable)
    monkeypatch.setattr(d1, 'query', forbidden)
    monkeypatch.setattr(d1, 'execute', forbidden)
    with pytest.raises(HTTPException) as error:
        asyncio.run(event_service.capture(EventCapture(event_name='click', user_id='u'), project_id='project-a'))
    assert error.value.status_code == 503


def test_owned_sdk_events_results_and_future_key_isolation(clients, mock_d1):
    a, b, admin = clients
    ka, kb = project(a, 'project-a'), project(b, 'project-b')
    sdk = TestClient(app, base_url='https://testserver')
    def track(key, event, headers):
        return sdk.post('/api/v1/events', json={'type': event, 'key': key, 'user_id': 'visitor', 'variant': 'control'}, headers=headers)
    assert track('future-b', 'impression', {'X-API-Key': ka}).status_code == 202
    for client, name in [(a, 'a'), (b, 'b')]:
        flag = 'flag-a' if name == 'a' else 'future-b'
        assert client.post('/api/v1/feature-flags/', json={'flag_key': flag, 'project_id': 'project-' + name, 'enabled': True}).status_code == 201
        assert client.post('/api/v1/experiments/', json={'id': 'exp-' + name, 'name': name, 'project_id': 'project-' + name, 'flag_key': flag, 'experiment_type': 'ab_test'}).status_code == 201
    assert b.get('/api/v1/experiments/exp-b/analytics').json()['impressions']['total'] == 0
    assert track('future-b', 'conversion', {'X-API-Key': ka}).status_code == 404
    assert a.get('/api/v1/experiments/exp-b/analytics').status_code == 404
    for event in ['impression', 'conversion']:
        assert track('flag-a', event, {'X-API-Key': ka}).status_code == 202
    assert sdk.post('/api/v1/decide', json={'key': 'flag-a', 'user_id': 'visitor'}, headers={'X-API-Key': ka}).status_code == 200
    result = a.get('/api/v1/experiments/exp-a/analytics')
    assert result.status_code == 200, result.text
    assert result.json()['impressions']['total'] == 1
    assert result.json()['conversions']['total'] == 1
    assert a.get('/api/v1/experiments/exp-a/available-events').json()['total_events'] == 2
    assert mock_d1.execute('SELECT count(*) FROM experiment_event').fetchone()[0] == 0
    assert mock_d1.execute('SELECT count(*) FROM project_experiment_event').fetchone()[0] == 3
    legacy_key = project(admin, 'legacy-sdk')
    assert track('legacy-custom', 'conversion', {'X-API-Key': legacy_key}).status_code == 202
    assert mock_d1.execute('SELECT count(*) FROM experiment_event').fetchone()[0] == 1
    for kind in ['quasi_experiment', 'rollout']:
        assert a.patch('/api/v1/experiments/exp-a', json={'experiment_type': kind}).status_code == 403
    migration = (Path(__file__).parents[1] / 'migrations/035_project_experiment_events.sql').read_text()
    mock_d1.executescript(migration)
    mock_d1.executescript(migration)
    assert mock_d1.execute('SELECT count(*) FROM project_experiment_event').fetchone()[0] == 3
    assert list(mock_d1.execute('PRAGMA foreign_key_check')) == []


from app.db.d1 import security_query as real_d1_query

@pytest.mark.parametrize('payload,fail', [
    ({'success': True, 'result': [{'success': True, 'results': []}]}, False),
    ({'success': True, 'result': []}, True),
    ({'success': True, 'result': {}}, True),
    ({'success': True, 'result': [{'success': True, 'results': []}] * 2}, True),
    ({'success': True, 'result': [None]}, True),
    ({'success': True, 'result': [{'results': []}]}, True),
    ({'success': True, 'result': [{'success': True, 'results': [None]}]}, True),
    ({'success': False, 'result': []}, True),
    ({'success': True, 'result': [{'success': False, 'results': []}]}, True),
    ({'success': True, 'result': [{'success': True}]}, True),
])
def test_real_security_transport_distinguishes_empty_and_failure(monkeypatch, payload, fail):
    from app.db import d1
    from fastapi import HTTPException
    monkeypatch.setattr(d1, '_get_endpoint', lambda *args: ('https://synthetic.invalid', 'synthetic'))
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, json=payload))) as client:
            async def get_client(): return client
            monkeypatch.setattr(d1, 'get_client', get_client)
            if fail:
                with pytest.raises(HTTPException) as error:
                    await real_d1_query('SELECT 1')
                assert error.value.status_code == 503
            else:
                assert await real_d1_query('SELECT 1') == []
    asyncio.run(run())


@pytest.mark.parametrize('failure', ['network', 'http', 'missing'])
def test_security_transport_failures_closed(monkeypatch, failure):
    from app.db import d1
    from fastapi import HTTPException
    monkeypatch.setattr(d1, '_get_endpoint', lambda *args: None if failure == 'missing' else ('https://synthetic.invalid', 'synthetic'))
    def handle(request):
        if failure == 'network': raise httpx.ConnectError('offline')
        return httpx.Response(500)
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            async def get_client(): return client
            monkeypatch.setattr(d1, 'get_client', get_client)
            with pytest.raises(HTTPException) as error:
                await real_d1_query('SELECT 1')
            assert error.value.status_code == 503
    asyncio.run(run())


def test_sdk_owner_storage_failure_does_not_fall_back_to_legacy(clients, monkeypatch):
    from app.db import d1
    from fastapi import HTTPException
    a, _, _ = clients
    key = project(a, 'project-a')
    original = d1.security_query
    async def query(sql, params=None):
        if 'project_owner' in sql: raise HTTPException(503, 'unavailable')
        return await original(sql, params)
    monkeypatch.setattr(d1, 'security_query', query)
    c = TestClient(app, base_url='https://testserver')
    assert c.post('/api/v1/events', headers={'X-API-Key': key}, json={'key':'unknown','type':'conversion','user_id':'u'}).status_code == 503


def test_email_and_role_claims_never_link_or_promote(clients, provider, mock_d1):
    for subject in ['separate-a', 'separate-b', 'separate-a']:
        provider['claims'] = {'sub': subject, 'email': 'same@example.invalid', 'is_admin': True, 'role': 'admin'}
        c = TestClient(app, base_url='https://testserver')
        state = start(c, provider)
        response = c.get(f'/api/v1/auth/google/callback?state={state}&code=synthetic', follow_redirects=False)
        assert response.headers['location'] == '/login?oauth=success'
        assert c.get('/api/v1/auth/me').json()['user']['is_admin'] is False
        assert c.get('/api/v1/segments/').status_code == 403
    assert mock_d1.execute("SELECT count(*) FROM platform_account WHERE google_sub LIKE 'separate-%'").fetchone()[0] == 2


@pytest.mark.parametrize('field,value', [
    ('GOOGLE_OAUTH_CLIENT_ID', ''), ('GOOGLE_OAUTH_CLIENT_SECRET', ''),
    ('AUTH_SESSION_SECRET', ''), ('AUTH_COOKIE_SECURE', False),
    ('GOOGLE_OAUTH_REDIRECT_URI', 'http://testserver/api/v1/auth/google/callback'),
    ('GOOGLE_OAUTH_REDIRECT_URI', 'https://testserver/elsewhere'),
    ('GOOGLE_OAUTH_REDIRECT_URI', 'https://['),
    ('GOOGLE_OAUTH_REDIRECT_URI', 'https://user@testserver/api/v1/auth/google/callback'),
    ('GOOGLE_OAUTH_REDIRECT_URI', 'https://testserver/api/v1/auth/google/callback?next=evil'),
])
def test_partial_config_disables_provider(clients, monkeypatch, field, value):
    monkeypatch.setattr(settings, field, value)
    c = TestClient(app, base_url='https://testserver')
    assert c.get('/api/v1/auth/providers').json() == {'google': False}
    assert c.get('/api/v1/auth/google/start').status_code == 503


def test_expired_attempt_and_member_session(clients, provider, mock_d1):
    a, _, _ = clients
    mock_d1.execute('UPDATE platform_session SET expires_at = 1')
    assert a.get('/api/v1/auth/me').json()['authenticated'] is False
    assert a.get('/api/v1/projects/').status_code == 401
    c = TestClient(app, base_url='https://testserver')
    state = start(c, provider)
    mock_d1.execute('UPDATE oauth_attempt SET expires_at = 1')
    assert c.get(f'/api/v1/auth/google/callback?state={state}&code=x', follow_redirects=False).headers['location'].endswith('failed')
    assert provider['exchange_count'] == 0


def test_owned_v1_readout_and_nested_reference_isolation(clients, mock_d1):
    a, b, admin = clients
    ka, kb = project(a, 'project-a'), project(b, 'project-b')
    sdk = TestClient(app, base_url='https://testserver')
    for member, name in [(a, 'a'), (b, 'b')]:
        assert member.post('/api/v1/feature-flags/', json={
            'flag_key': 'flag-' + name, 'project_id': 'project-' + name, 'enabled': True,
        }).status_code == 201
        mock_d1.execute("""INSERT INTO experiments
            (id, name, project_id, flag_key, status, primary_metric, event_model, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'running', 'purchase', 'sdk_v1', '2026-01-01', '2026-01-01')""",
            ['exp-' + name, name, 'project-' + name, 'flag-' + name])
    response = sdk.post('/api/v1/decide', headers={'X-API-Key': ka}, json={
        'key': 'flag-a', 'user_id': 'visitor', 'event_model': 'sdk_v1', 'experiment_id': 'exp-a',
    })
    assert response.status_code == 200, response.text
    context = {**response.json()['tracking_context'], 'impression_id': 'view', 'session_id': 'tab'}
    payload = {'user_id': 'visitor', 'event_name': 'exp_exposure', 'event_id': 'view',
               'experiment_id': 'exp-a', 'variant': context['variant'], 'session_id': 'tab',
               'tracking_context': context, 'sdk_event_type': 'exposure'}
    for _ in range(2):
        assert sdk.post('/api/v1/capture', headers={'X-API-Key': ka}, json=payload).status_code == 202
    assert sdk.post('/api/v1/capture', headers={'X-API-Key': kb}, json=payload).status_code == 404
    forged = {**payload, 'tracking_context': {**context, 'experiment_id': 'exp-b'}}
    assert sdk.post('/api/v1/capture', headers={'X-API-Key': ka}, json=forged).status_code == 404
    assert sdk.post('/api/v1/ingest/events', headers={'X-API-Key': ka}, json={'events': [forged]}).status_code == 404
    # Legacy rows must never override an owned v1 experiment's explicit source.
    assert sdk.post('/api/v1/events', headers={'X-API-Key': ka}, json={
        'user_id': 'visitor', 'type': 'impression', 'key': 'flag-a', 'experiment_id': 'exp-a', 'variant': 'control',
    }).status_code == 202
    analytics = a.get('/api/v1/experiments/exp-a/analytics').json()
    assert analytics['impressions']['total'] == 1
    assert analytics['statistical_significance']['p_value'] is None
    assert a.get('/api/v1/experiments/exp-a/available-events').json()['event_types'] == ['exp_exposure']
    assert b.get('/api/v1/experiments/exp-b/analytics').json()['impressions']['total'] == 0
    assert b.get('/api/v1/experiments/exp-a/analytics').status_code == 404
    assert a.get('/api/v1/experiments/exp-a/result').status_code == 403
    row = mock_d1.execute('SELECT event_id, cohort_id FROM event_log').fetchone()
    assert row['event_id'].startswith('sdk_v1:') and row['cohort_id'] is None
    for endpoint in ['/projects/', '/projects/project-a']:
        assert 'api_key' not in a.get('/api/v1' + endpoint).text


@pytest.mark.parametrize('event_model', ['legacy', 'sdk_v1'])
def test_member_starts_flag_experiment_without_shared_placements(clients, mock_d1, event_model):
    a, b, _ = clients
    key = project(a, 'project-a')
    other_key = project(b, 'project-b')
    assert a.post('/api/v1/feature-flags/', json={
        'flag_key': 'launch-flag', 'project_id': 'project-a', 'enabled': True, 'rollout_pct': 100,
    }).status_code == 201
    assert a.post('/api/v1/feature-flags/launch-flag/rules', json={
        'variant': 'treatment', 'rollout_pct': 50,
    }).status_code == 201
    created = a.post('/api/v1/experiments/', json={
        'id': 'launch-exp', 'name': 'Member launch', 'project_id': 'project-a',
        'flag_key': 'launch-flag', 'event_model': event_model,
    })
    assert created.status_code == 201
    assert a.post('/api/v1/experiments/launch-exp/placements', json={}).status_code == 403
    assert a.patch('/api/v1/experiments/launch-exp', json={'status': 'running'}).status_code == 422
    assert b.patch('/api/v1/experiments/launch-exp', json={'status': 'running', 'primary_metric': 'purchase'}).status_code == 404
    response = a.patch('/api/v1/experiments/launch-exp', json={'status': 'running', 'primary_metric': 'purchase'})
    assert response.status_code == 200, response.text
    assert response.json()['status'] == 'running'
    assert mock_d1.execute('SELECT count(*) FROM experiment_placement_config').fetchone()[0] == 0
    sdk = TestClient(app, base_url='https://testserver')
    decision = sdk.post('/api/v1/decide', headers={'X-API-Key': key}, json={
        'key': 'launch-flag', 'user_id': 'visitor', 'experiment_id': 'launch-exp',
        **({'event_model': 'sdk_v1'} if event_model == 'sdk_v1' else {}),
    })
    assert decision.status_code == 200
    assert decision.json()['variant'] in {'control', 'treatment'}
    assert sdk.post('/api/v1/decide', headers={'X-API-Key': other_key}, json={
        'key': 'launch-flag', 'user_id': 'visitor',
    }).status_code == 404
    if event_model == 'sdk_v1':
        context = {**decision.json()['tracking_context'], 'impression_id': 'launch-view', 'session_id': 'tab'}
        payload = {'user_id': 'visitor', 'event_name': 'exp_exposure', 'event_id': 'launch-view',
                   'experiment_id': 'launch-exp', 'variant': context['variant'], 'session_id': 'tab',
                   'tracking_context': context, 'sdk_event_type': 'exposure'}
        endpoint = '/api/v1/capture'
        action = {**payload, 'event_name': 'purchase', 'event_id': 'purchase-event', 'sdk_event_type': 'conversion'}
    else:
        endpoint = '/api/v1/events'
        payload = {'user_id': 'visitor', 'key': 'launch-flag', 'experiment_id': 'launch-exp',
                   'variant': decision.json()['variant'], 'type': 'impression'}
        action = {**payload, 'type': 'conversion'}
    assert sdk.post(endpoint, headers={'X-API-Key': other_key}, json=payload).status_code == 404
    assert sdk.post(endpoint, headers={'X-API-Key': key}, json=payload).status_code == 202
    assert sdk.post(endpoint, headers={'X-API-Key': key}, json=action).status_code == 202
    analytics = a.get('/api/v1/experiments/launch-exp/analytics').json()
    assert analytics['impressions']['total'] == 1
    assert analytics['conversions']['total'] == 1
    assert b.get('/api/v1/experiments/launch-exp/analytics').status_code == 404
    assert a.patch('/api/v1/experiments/launch-exp', json={'status': 'paused'}).status_code == 200
    assert a.patch('/api/v1/experiments/launch-exp', json={'status': 'running'}).status_code == 200


def test_owned_launch_requires_active_same_project_flag(clients, mock_d1):
    a, b, admin = clients
    project(a, 'project-a')
    project(b, 'project-b')
    assert a.post('/api/v1/experiments/', json={
        'id': 'launch-exp', 'name': 'Launch', 'project_id': 'project-a', 'primary_metric': 'purchase',
    }).status_code == 201
    assert a.patch('/api/v1/experiments/launch-exp', json={'status': 'running'}).status_code == 400
    assert b.post('/api/v1/feature-flags/', json={'flag_key': 'other-flag', 'project_id': 'project-b'}).status_code == 201
    # Even an administrator cannot use the owned-project exception with a foreign flag.
    assert admin.patch('/api/v1/experiments/launch-exp', json={
        'status': 'running', 'flag_key': 'other-flag',
    }).status_code == 400
    assert a.post('/api/v1/feature-flags/', json={'flag_key': 'own-flag', 'project_id': 'project-a'}).status_code == 201
    assert a.patch('/api/v1/experiments/launch-exp', json={'flag_key': 'own-flag'}).status_code == 200
    assert a.post('/api/v1/feature-flags/own-flag/archive').status_code == 200
    assert a.patch('/api/v1/experiments/launch-exp', json={'status': 'running'}).status_code == 400
    assert a.get('/api/v1/experiments/launch-exp').json()['status'] == 'draft'
    assert b.post('/api/v1/feature-flags/own-flag/restore').status_code == 404
    assert a.post('/api/v1/feature-flags/own-flag/restore').status_code == 200
    assert a.patch('/api/v1/experiments/launch-exp', json={'status': 'running'}).status_code == 400
    assert a.patch('/api/v1/feature-flags/own-flag', json={'enabled': True}).status_code == 200
    assert a.patch('/api/v1/experiments/launch-exp', json={'status': 'running'}).status_code == 200
    assert a.post('/api/v1/feature-flags/own-flag/archive', content='not-json').status_code == 422
    assert a.post('/api/v1/feature-flags/', content='').status_code == 404


def test_owned_launch_storage_failure_does_not_bypass_checks(clients, monkeypatch):
    from app.db import d1
    from fastapi import HTTPException
    a, _, admin = clients
    project(a, 'project-a')
    assert a.post('/api/v1/feature-flags/', json={'flag_key': 'launch-flag', 'project_id': 'project-a'}).status_code == 201
    assert a.post('/api/v1/experiments/', json={
        'id': 'launch-exp', 'name': 'Launch', 'project_id': 'project-a',
        'flag_key': 'launch-flag', 'primary_metric': 'purchase',
    }).status_code == 201
    original = d1.security_query
    async def unavailable(sql, params=None):
        if 'project_owner' in sql:
            raise HTTPException(503, 'Unavailable')
        return await original(sql, params)
    monkeypatch.setattr(d1, 'security_query', unavailable)
    assert admin.patch('/api/v1/experiments/launch-exp', json={'status': 'running'}).status_code == 503
    assert admin.get('/api/v1/experiments/launch-exp').json()['status'] == 'draft'


def test_canonical_start_uses_fixed_origin_without_attempt_on_other_host(clients, mock_d1):
    other = TestClient(app, base_url='https://other.example')
    r = other.get('/api/v1/auth/google/start', params={'return_to': '/api-key', 'next': 'https://evil.example'}, headers={'Host': 'evil.example'}, follow_redirects=False)
    assert r.status_code == 303
    assert r.headers['location'] == 'https://testserver/api/v1/auth/google/start'
    assert 'set-cookie' not in r.headers
    assert mock_d1.execute('SELECT count(*) FROM oauth_attempt').fetchone()[0] == 0
    assert other.post('/api/v1/auth/login', json={'username': 'admin', 'password': 'synthetic'}).status_code == 200
    assert other.get('/api/v1/auth/google/callback', follow_redirects=False).headers['location'] == '/login?oauth=failed'


@pytest.mark.parametrize('uri', [None, 'https://testserver:bad/api/v1/auth/google/callback', 'https://testserver:0/api/v1/auth/google/callback', 'https://testserver:99999/api/v1/auth/google/callback', 'https://test server/api/v1/auth/google/callback', 'https://testserver\\evil/api/v1/auth/google/callback', 'https://testserver/api/v1/auth/google/callback\n', 'https://%65vil/api/v1/auth/google/callback'])
def test_canonical_invalid_config_fails_closed(clients, monkeypatch, uri):
    monkeypatch.setattr(settings, 'GOOGLE_OAUTH_REDIRECT_URI', uri)
    c = TestClient(app, base_url='https://other.example')
    assert c.get('/api/v1/auth/providers').json() == {'google': False}
    r = c.get('/api/v1/auth/google/start', follow_redirects=False)
    assert r.status_code == 503 and 'location' not in r.headers and 'set-cookie' not in r.headers


def test_canonical_origin_normalizes_default_port_and_case(clients, monkeypatch):
    monkeypatch.setattr(settings, 'GOOGLE_OAUTH_REDIRECT_URI', 'https://TESTSERVER:443/api/v1/auth/google/callback')
    c = TestClient(app, base_url='https://testserver')
    r = c.get('/api/v1/auth/google/start', follow_redirects=False)
    assert r.headers['location'].startswith(google_oidc.AUTHORIZE_URL)


@pytest.mark.parametrize('forwarded', [{}, {'X-Forwarded-Proto': 'https'}, {'X-Forwarded-Proto': 'http', 'X-Forwarded-Host': 'evil.example'}])
def test_canonical_start_behind_tls_terminating_proxy(clients, monkeypatch, forwarded):
    origin = 'https://iterglow.pseudolab-devfactory.com'
    monkeypatch.setattr(settings, 'GOOGLE_OAUTH_REDIRECT_URI', origin + '/api/v1/auth/google/callback')
    monkeypatch.setattr(settings, 'BACKEND_CORS_ORIGINS', [origin])
    # TestClient does not turn these forwarding headers into a trusted external scheme.
    c = TestClient(app, base_url='http://iterglow.pseudolab-devfactory.com')
    r = c.get('/api/v1/auth/google/start', headers={'Origin': origin, **forwarded}, follow_redirects=False)
    assert r.status_code == 303 and r.headers['location'].startswith(google_oidc.AUTHORIZE_URL)
    assert parse_qs(urlsplit(r.headers['location']).query)['redirect_uri'] == [origin + '/api/v1/auth/google/callback']
    assert 'Secure' in r.headers['set-cookie'] and 'Domain=' not in r.headers['set-cookie']


def test_explicit_google_admin_scope_preserves_identity_and_owners(clients, monkeypatch, mock_d1):
    a, b, password_admin = clients
    project(password_admin, 'existing-unowned')
    project(b, 'other-owned')
    for client, key, pid in [(password_admin, 'shared-flag', 'existing-unowned'), (b, 'member-flag', 'other-owned')]:
        assert client.post('/api/v1/feature-flags/', json={'flag_key': key, 'project_id': pid, 'enabled': True}).status_code == 201
        assert client.post('/api/v1/experiments/', json={'id': key, 'name': key, 'project_id': pid, 'flag_key': key}).status_code == 201
    before = [tuple(r) for r in mock_d1.execute('SELECT * FROM project_owner')]
    monkeypatch.setattr(settings, 'ADMIN_ACCOUNT_ID', 'a')
    me = a.get('/api/v1/auth/me').json()['user']
    assert me['is_admin'] is True and me['account_id'] == 'a'
    assert {p['id'] for p in a.get('/api/v1/projects/').json()} == {'existing-unowned', 'other-owned'}
    assert a.get('/api/v1/projects/existing-unowned/api-key').status_code == 200
    assert a.get('/api/v1/projects/existing-unowned/sdk-status').status_code == 200
    assert a.get('/api/v1/segments/').status_code == 200
    assert {f['flag_key'] for f in a.get('/api/v1/feature-flags/').json()} == {'shared-flag', 'member-flag'}
    assert {e['id'] for e in a.get('/api/v1/experiments/').json()} == {'shared-flag', 'member-flag'}
    assert {e['id'] for e in b.get('/api/v1/experiments/').json()} == {'member-flag'}
    made = a.post('/api/v1/experiments/', json={'id': 'admin-experiment', 'name': 'Admin', 'project_id': 'existing-unowned', 'owner_id': 'forged'})
    assert made.status_code == 201 and made.json()['owner_id'] == 'a'
    assert b.get('/api/v1/segments/').status_code == 403
    assert [tuple(r) for r in mock_d1.execute('SELECT * FROM project_owner')] == before
    project(a, 'admin-created')
    assert mock_d1.execute("SELECT account_id FROM project_owner WHERE project_id='admin-created'").fetchone()[0] == 'a'
    assert b.get('/api/v1/projects/admin-created').status_code == 404
    for project_id in ['existing-unowned', 'other-owned']:
        assert a.post(f'/api/v1/projects/{project_id}/server-key').status_code == 200
        assert a.delete(f'/api/v1/projects/{project_id}/server-key').status_code == 204
    assert b.post('/api/v1/projects/existing-unowned/server-key').status_code == 404
    assert b.delete('/api/v1/projects/existing-unowned').status_code == 404
    project(password_admin, 'empty-shared')
    assert a.delete('/api/v1/projects/empty-shared').status_code == 204
    assert a.delete('/api/v1/projects/existing-unowned').status_code == 409
    # Revoking the selected role affects existing sessions without erasing their identity.
    monkeypatch.setattr(settings, 'ADMIN_ACCOUNT_ID', None)
    assert a.get('/api/v1/auth/me').json()['user'] == {'username': 'user-a', 'account_id': 'a', 'is_admin': False}
    assert a.get('/api/v1/projects/existing-unowned').status_code == 404
    assert a.get('/api/v1/projects/admin-created').status_code == 200


def test_google_admin_without_password_and_explicit_password_retirement(clients, monkeypatch):
    a, b, old_admin = clients
    monkeypatch.setattr(settings, 'ADMIN_ACCOUNT_ID', 'a')
    monkeypatch.setattr(settings, 'PASSWORD_LOGIN_ENABLED', False)
    assert old_admin.get('/api/v1/auth/me').json()['authenticated'] is False
    assert old_admin.get('/api/v1/projects/').status_code == 401
    assert old_admin.post('/api/v1/auth/login', json={'username': 'admin', 'password': 'synthetic'}).status_code == 503
    monkeypatch.setattr(settings, 'ADMIN_PASSWORD_HASH', None)
    monkeypatch.setattr(settings, 'ADMIN_USERNAME', None)
    assert a.get('/api/v1/projects/').status_code == 200
    assert a.get('/api/v1/segments/').status_code == 200
    assert b.get('/api/v1/projects/').status_code == 200
    assert b.get('/api/v1/segments/').status_code == 403
    token = a.cookies.get(settings.AUTH_COOKIE_NAME)
    assert a.post('/api/v1/auth/logout').status_code == 200
    assert a.get('/api/v1/projects/', headers={'Cookie': settings.AUTH_COOKIE_NAME + '=' + token}).status_code == 401


@pytest.mark.parametrize('selected', [None, '', 'missing-account', ' a ', 'google-a'])
def test_no_implicit_or_claim_based_admin_selection(clients, monkeypatch, selected):
    a, b, _ = clients
    monkeypatch.setattr(settings, 'ADMIN_ACCOUNT_ID', selected)
    for c in [a, b]:
        assert c.get('/api/v1/auth/me').json()['user']['is_admin'] is False
        assert c.get('/api/v1/segments/', headers={'X-Admin-Account-Id': 'a', 'X-Role': 'admin'}).status_code == 403
    r = a.post('/api/v1/projects/', json={'id': 'ordinary', 'name': 'Ordinary', 'is_admin': True, 'account_id': 'a'})
    assert r.status_code == 201
    assert a.get('/api/v1/auth/me').json()['user']['is_admin'] is False


def test_incomplete_google_configuration_preserves_enabled_recovery(clients, monkeypatch):
    a, _, admin = clients
    monkeypatch.setattr(settings, 'GOOGLE_OAUTH_CLIENT_SECRET', None)
    assert admin.get('/api/v1/auth/providers').json() == {'google': False}
    assert admin.post('/api/v1/auth/login', json={'username': 'admin', 'password': 'synthetic'}).status_code == 200
    monkeypatch.setattr(settings, 'ADMIN_ACCOUNT_ID', 'a')
    monkeypatch.setattr(settings, 'PASSWORD_LOGIN_ENABLED', False)
    # Existing Google sessions remain usable during provider outage; fresh login fails closed.
    assert a.get('/api/v1/segments/').status_code == 200
    c = TestClient(app, base_url='https://testserver')
    assert c.get('/api/v1/projects/').status_code == 503
    assert c.get('/api/v1/auth/google/start', follow_redirects=False).status_code == 503


def test_client_switch_reuses_sub_account_owner_and_session(clients, provider, monkeypatch, mock_d1):
    c = TestClient(app, base_url='https://testserver')
    state = start(c, provider)
    assert c.get('/api/v1/auth/google/callback', params={'state': state, 'code': 'synthetic'}, follow_redirects=False).headers['location'] == '/login?oauth=success'
    account_id = c.get('/api/v1/auth/me').json()['user']['account_id']
    project(c, 'client-switch-project')
    copied = c.cookies.get(settings.AUTH_COOKIE_NAME)
    monkeypatch.setattr(settings, 'ADMIN_ACCOUNT_ID', account_id)
    monkeypatch.setattr(settings, 'GOOGLE_OAUTH_CLIENT_ID', 'new-synthetic-client')
    assert c.get('/api/v1/projects/').status_code == 200
    assert c.get('/api/v1/auth/me').json()['user']['is_admin'] is True
    c.cookies.clear()
    state = start(c, provider)
    # The old audience is rejected even though the sub is the same.
    assert c.get('/api/v1/auth/google/callback', params={'state': state, 'code': 'synthetic'}, follow_redirects=False).headers['location'] == '/login?oauth=failed'
    provider['claims'] = {'aud': 'new-synthetic-client', 'email': 'irrelevant@example.invalid', 'role': 'member'}
    state = start(c, provider)
    assert c.get('/api/v1/auth/google/callback', params={'state': state, 'code': 'synthetic'}, follow_redirects=False).headers['location'] == '/login?oauth=success'
    assert c.get('/api/v1/auth/me').json()['user']['account_id'] == account_id
    assert mock_d1.execute("SELECT count(*) FROM platform_account WHERE google_sub='new-google-sub'").fetchone()[0] == 1
    assert mock_d1.execute("SELECT account_id FROM project_owner WHERE project_id='client-switch-project'").fetchone()[0] == account_id
    assert c.get('/api/v1/auth/me', headers={'Cookie': settings.AUTH_COOKIE_NAME + '=' + copied}).json()['authenticated'] is True


def test_provider_claims_cannot_promote_google_account(clients, provider, monkeypatch):
    monkeypatch.setattr(settings, 'ADMIN_ACCOUNT_ID', 'a')
    provider['claims'] = {'role': 'admin', 'is_admin': True, 'account_id': 'a', 'email': 'admin@example.invalid'}
    c = TestClient(app, base_url='https://testserver')
    state = start(c, provider)
    assert c.get('/api/v1/auth/google/callback', params={'state': state, 'code': 'synthetic'}, follow_redirects=False).headers['location'] == '/login?oauth=success'
    user = c.get('/api/v1/auth/me').json()['user']
    assert user['account_id'] != 'a' and user['is_admin'] is False
    assert c.get('/api/v1/segments/').status_code == 403


def test_google_admin_fails_closed_without_account_or_security_storage(clients, monkeypatch, mock_d1):
    from fastapi import HTTPException
    from app.db import d1
    a, _, _ = clients
    monkeypatch.setattr(settings, 'ADMIN_ACCOUNT_ID', 'a')
    async def unavailable(*args, **kwargs):
        raise HTTPException(503, 'Security storage unavailable')
    with monkeypatch.context() as patch:
        patch.setattr(d1, 'security_query', unavailable)
        assert a.get('/api/v1/projects/').status_code == 503
    mock_d1.execute("DELETE FROM platform_account WHERE id='a'")
    mock_d1.commit()
    assert a.get('/api/v1/projects/').status_code == 401

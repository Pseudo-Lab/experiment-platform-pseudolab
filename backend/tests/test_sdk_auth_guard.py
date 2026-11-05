"""Anonymous SDK requests must stop before persistence, using only synthetic keys."""
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.event import event_service


@pytest.mark.parametrize('key', [None, '', ' ', 'missing-key', 'sk_live_wrong_type'])
@pytest.mark.parametrize('path,payload,method,table', [
    ('/capture', {'event_name': 'click', 'user_id': 'visitor'}, 'capture', 'event_log'),
    ('/ingest/events', {'events': [{'event_name': 'click', 'user_id': 'visitor'}]}, 'capture_batch', 'event_log'),
    ('/events', {'type': 'conversion', 'key': 'custom-action', 'user_id': 'visitor'}, 'track_experiment_event', 'experiment_event'),
])
def test_rejected_credentials_never_reach_storage(mock_d1, monkeypatch, key, path, payload, method, table):
    spy = AsyncMock(wraps=getattr(event_service, method))
    monkeypatch.setattr(event_service, method, spy)
    client = TestClient(app, base_url='https://testserver')
    response = client.post('/api/v1' + path, json=payload, headers={} if key is None else {'X-API-Key': key})
    assert (response.status_code, spy.await_count, mock_d1.execute('SELECT count(*) FROM ' + table).fetchone()[0]) == (401, 0, 0)


@pytest.fixture
def credential_projects(mock_d1):
    for project_id in ('a', 'b'):
        mock_d1.execute('INSERT INTO projects (id, name, api_key) VALUES (?, ?, ?)',
                        (project_id, project_id, 'public-' + project_id))
        mock_d1.execute("INSERT INTO experiments (id, name, project_id, created_at, updated_at) VALUES (?, ?, ?, '2026-01-01', '2026-01-01')",
                        ('exp-' + project_id, project_id, project_id))
        mock_d1.execute("INSERT INTO feature_flag (flag_key, project_id, enabled, created_at, updated_at) VALUES (?, ?, 1, '2026-01-01', '2026-01-01')",
                        ('flag-' + project_id, project_id))
    mock_d1.commit()
    return mock_d1


@pytest.mark.parametrize('owned', [False, True])
@pytest.mark.parametrize('reference', [
    {'experiment_id': 'exp-b'}, {'experiment_id': 'missing'},
    {'properties': {'experiment_id': 'exp-b'}},
    {'properties': {'flag_key': 'flag-b'}}, {'project_id': 'b'},
    {'tracking_context': {'project_id': 'b', 'key': 'flag-b'}},
    {'tracking_context': {'project_id': 'missing', 'key': 'flag-a'}},
])
@pytest.mark.parametrize('path,method', [('/capture', 'capture'), ('/ingest/events', 'capture_batch'), ('/events', 'track_experiment_event')])
def test_foreign_or_missing_scope_never_reaches_storage(credential_projects, monkeypatch, owned, reference, path, method):
    db = credential_projects
    if owned:
        db.execute("INSERT INTO platform_account VALUES ('owner-a', 'synthetic-google-a', 1)")
        db.execute("INSERT INTO project_owner (project_id, account_id) VALUES ('a', 'owner-a')")
        db.commit()
    spies = []
    for name in ('capture', 'capture_batch', 'track_experiment_event'):
        spy = AsyncMock(wraps=getattr(event_service, name))
        monkeypatch.setattr(event_service, name, spy)
        spies.append(spy)
    # /events ignores tracking_context; only its stored properties can cross scope.
    if path == '/events' and 'tracking_context' in reference:
        reference = {**reference, 'properties': {'experiment_id': 'exp-b'}}
    event = {'event_name': 'click', 'type': 'conversion', 'key': 'custom-action', 'user_id': 'visitor', **reference}
    # A valid first item must not be persisted when a later batch item is invalid.
    payload = {'events': [{'event_name': 'click', 'user_id': 'first'}, event]} if path == '/ingest/events' else event
    response = TestClient(app, base_url='https://testserver').post('/api/v1' + path, json=payload, headers={'X-API-Key': 'public-a'})
    assert response.status_code == 404, response.text
    assert all(spy.await_count == 0 for spy in spies)
    for table in ('event_log', 'experiment_event', 'project_experiment_event'):
        assert db.execute('SELECT count(*) FROM ' + table).fetchone()[0] == 0


@pytest.mark.parametrize('path,payload', [
    ('/capture', {'event_name': 'click', 'user_id': 'visitor'}),
    ('/ingest/events', {'events': [{'event_name': 'click', 'user_id': 'visitor'}]}),
    ('/events', {'type': 'conversion', 'key': 'custom-action', 'user_id': 'visitor'}),
])
def test_current_key_required_after_rotation_or_project_deletion(credential_projects, monkeypatch, path, payload):
    db = credential_projects
    db.execute("UPDATE projects SET api_key='rotated-key' WHERE id='a'")
    db.execute("DELETE FROM experiments WHERE project_id='b'")
    db.execute("DELETE FROM feature_flag WHERE project_id='b'")
    db.execute("DELETE FROM projects WHERE id='b'")
    db.commit()
    spies = []
    for name in ('capture', 'capture_batch', 'track_experiment_event'):
        spy = AsyncMock(wraps=getattr(event_service, name))
        monkeypatch.setattr(event_service, name, spy)
        spies.append(spy)
    client = TestClient(app, base_url='https://testserver')
    for key in ('public-a', 'public-b'):
        assert client.post('/api/v1' + path, json=payload, headers={'X-API-Key': key}).status_code == 401
    assert all(spy.await_count == 0 for spy in spies)
    assert db.execute('SELECT count(*) FROM event_log').fetchone()[0] == 0


@pytest.mark.parametrize('path,payload', [
    ('/capture', {'event_name': 'click', 'user_id': 'visitor', 'experiment_id': 'exp-a'}),
    ('/ingest/events', {'events': [{'event_name': 'click', 'user_id': 'visitor'}, {'event_name': 'purchase', 'user_id': 'visitor', 'experiment_id': 'exp-a'}]}),
    ('/events', {'type': 'conversion', 'key': 'flag-a', 'experiment_id': 'exp-a', 'user_id': 'visitor'}),
])
def test_valid_project_events_still_persist(credential_projects, path, payload):
    response = TestClient(app, base_url='https://testserver').post('/api/v1' + path, json=payload, headers={'X-API-Key': 'public-a'})
    assert response.status_code == 202, response.text
    table = 'experiment_event' if path == '/events' else 'event_log'
    assert credential_projects.execute('SELECT count(*) FROM ' + table).fetchone()[0] == (2 if path == '/ingest/events' else 1)


def test_database_failure_is_closed_before_storage(credential_projects, monkeypatch):
    from app.db import d1
    from fastapi import HTTPException
    monkeypatch.setattr(d1, 'security_query', AsyncMock(side_effect=HTTPException(503, 'Authorization unavailable')))
    spy = AsyncMock(wraps=event_service.capture)
    monkeypatch.setattr(event_service, 'capture', spy)
    response = TestClient(app, base_url='https://testserver').post('/api/v1/capture', json={'event_name': 'click', 'user_id': 'visitor'}, headers={'X-API-Key': 'public-a'})
    assert response.status_code == 503
    assert spy.await_count == 0
    assert credential_projects.execute('SELECT count(*) FROM event_log').fetchone()[0] == 0


@pytest.mark.parametrize('key', [None, '', 'missing-key', 'sk_live_wrong_type'])
@pytest.mark.parametrize('method,path,payload', [
    ('post', '/decide', {'key': 'flag-a', 'user_id': 'visitor'}),
    ('get', '/feature-flags/decide?flag_key=flag-a&user_id=visitor', None),
    ('get', '/experiments/assignment?experiment_id=exp-a&uid=visitor', None),
    ('get', '/experiments/exp-a/assign/visitor', None),
])
def test_decision_credentials_rejected_before_assignments(credential_projects, monkeypatch, key, method, path, payload):
    from app.services.feature_flag import feature_flag_service
    from app.services.experiment import experiment_service
    decide = AsyncMock(wraps=feature_flag_service.decide)
    assign = AsyncMock(wraps=experiment_service.assign)
    monkeypatch.setattr(feature_flag_service, 'decide', decide)
    monkeypatch.setattr(experiment_service, 'assign', assign)
    kwargs = {'headers': {} if key is None else {'X-API-Key': key}}
    if payload is not None:
        kwargs['json'] = payload
    response = getattr(TestClient(app, base_url='https://testserver'), method)('/api/v1' + path, **kwargs)
    assert response.status_code == 401, response.text
    assert decide.await_count == assign.await_count == 0
    for table in ('feature_flag_exposure', 'experiment_assignments'):
        assert credential_projects.execute('SELECT count(*) FROM ' + table).fetchone()[0] == 0


@pytest.mark.parametrize('path,payload,method', [
    ('/capture', {'event_name': 'click', 'user_id': 'visitor'}, 'capture'),
    ('/ingest/events', {'events': [{'event_name': 'click', 'user_id': 'visitor'}]}, 'capture_batch'),
    ('/events', {'type': 'conversion', 'key': 'custom-action', 'user_id': 'visitor'}, 'track_experiment_event'),
    ('/identify', {'user_id': 'visitor'}, 'identify'),
])
def test_admin_cookie_is_not_an_ingestion_credential(mock_d1, monkeypatch, path, payload, method):
    from app.core.auth import create_session_token, hash_password
    from app.core.config import settings
    monkeypatch.setattr(settings, 'ADMIN_USERNAME', 'synthetic-admin')
    monkeypatch.setattr(settings, 'ADMIN_PASSWORD_HASH', hash_password('synthetic', iterations=1000))
    monkeypatch.setattr(settings, 'AUTH_SESSION_SECRET', 'synthetic-session-secret')
    monkeypatch.setattr(settings, 'PASSWORD_LOGIN_ENABLED', True)
    spy = AsyncMock(wraps=getattr(event_service, method))
    monkeypatch.setattr(event_service, method, spy)
    client = TestClient(app, base_url='https://testserver')
    client.cookies.set(settings.AUTH_COOKIE_NAME, create_session_token('synthetic-admin'))
    assert client.get('/api/v1/auth/me').status_code == 200
    response = client.post('/api/v1' + path, json=payload)
    assert response.status_code == 401, response.text
    assert spy.await_count == 0


@pytest.mark.parametrize('path,method', [('/capture', 'capture'), ('/events', 'track_experiment_event')])
def test_ignored_events_array_cannot_hide_single_event_scope(credential_projects, monkeypatch, path, method):
    spy = AsyncMock(wraps=getattr(event_service, method))
    monkeypatch.setattr(event_service, method, spy)
    response = TestClient(app, base_url='https://testserver').post('/api/v1' + path,
        headers={'X-API-Key': 'public-a'}, json={'event_name': 'click', 'type': 'conversion',
        'key': 'flag-a', 'user_id': 'visitor', 'experiment_id': 'exp-b', 'events': []})
    assert response.status_code == 404, response.text
    assert spy.await_count == 0
    for table in ('event_log', 'experiment_event'):
        assert credential_projects.execute('SELECT count(*) FROM ' + table).fetchone()[0] == 0


def test_ignored_context_cannot_hide_legacy_properties_scope(credential_projects, monkeypatch):
    spy = AsyncMock(wraps=event_service.track_experiment_event)
    monkeypatch.setattr(event_service, 'track_experiment_event', spy)
    response = TestClient(app, base_url='https://testserver').post('/api/v1/events',
        headers={'X-API-Key': 'public-a'}, json={'type': 'conversion', 'key': 'flag-a',
        'user_id': 'visitor', 'properties': {'experiment_id': 'exp-b'},
        'tracking_context': {'project_id': 'a', 'key': 'flag-a'}})
    assert response.status_code == 404, response.text
    assert spy.await_count == 0
    assert credential_projects.execute('SELECT count(*) FROM experiment_event').fetchone()[0] == 0


@pytest.mark.parametrize('alias', ['flag_key', 'placement_key'])
@pytest.mark.parametrize('path', ['/capture', '/ingest/events'])
def test_context_does_not_hide_preserved_property_aliases(credential_projects, monkeypatch, alias, path):
    spies = []
    for name in ('capture', 'capture_batch'):
        spy = AsyncMock(wraps=getattr(event_service, name))
        monkeypatch.setattr(event_service, name, spy)
        spies.append(spy)
    # Context overwrites key and experiment_id, but these aliases survive storage.
    import json
    from uuid import NAMESPACE_URL, uuid5
    credential_projects.execute("UPDATE experiments SET flag_key='flag-a', event_model='sdk_v1' WHERE id='exp-a'")
    context = {'project_id': 'a', 'key': 'flag-a', 'experiment_id': 'exp-a',
        'user_id': 'visitor', 'variant': 'control', 'source': 'sdk_v1',
        'assignment_id': str(uuid5(NAMESPACE_URL, json.dumps(['a', 'exp-a', 'flag-a', 'visitor', 'control']))),
        'session_id': 'tab', 'impression_id': 'impression'}
    event = {'event_name': 'click', 'user_id': 'visitor', 'experiment_id': 'exp-a',
        'variant': 'control', 'session_id': 'tab', 'event_id': 'click', 'sdk_event_type': 'click',
        'tracking_context': context, 'properties': {alias: 'flag-b'}}
    payload = {'events': [event]} if path == '/ingest/events' else event
    response = TestClient(app, base_url='https://testserver').post('/api/v1' + path,
        headers={'X-API-Key': 'public-a'}, json=payload)
    assert response.status_code == 404, response.text
    assert all(spy.await_count == 0 for spy in spies)
    assert credential_projects.execute('SELECT count(*) FROM event_log').fetchone()[0] == 0

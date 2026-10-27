import asyncio
import hashlib
import sqlite3
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.db import d1
from app.main import app
from app.services.project import project_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def configure_auth(monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, 'ADMIN_USERNAME', 'test-admin')
    monkeypatch.setattr(settings, 'ADMIN_PASSWORD_HASH', 'fixture-unused-hash')
    monkeypatch.setattr(settings, 'AUTH_SESSION_SECRET', 'fixture-secret')
    client.cookies.clear()

PUBLIC = 'pk_sdk_fixture_public'
SERVER = 'sk_live_fixture_server'


def seed(db):
    db.execute("INSERT INTO projects(id,name,api_key) VALUES ('demo-app','Demo',?)", (PUBLIC,))
    db.execute("INSERT INTO projects(id,name,api_key) VALUES ('other','Other','pk_sdk_other')")
    db.execute("INSERT INTO project_server_credential(token_hash,project_id) VALUES (?,'demo-app')", (hashlib.sha256(SERVER.encode()).hexdigest(),))
    db.commit()


def bearer(key):
    return client.post('/api/v1/access/decide', headers={'Authorization': 'Bearer ' + key},
                       json={'user_id': '', 'flag_key': 'missing', 'route': '/'})


def test_sdk_and_server_are_separate(mock_d1):
    seed(mock_d1)
    assert asyncio.run(project_service.get_by_api_key(PUBLIC)).id == 'demo-app'
    assert asyncio.run(project_service.get_by_api_key(SERVER)) is None
    assert bearer(PUBLIC).status_code == 401
    assert bearer(SERVER).status_code == 200
    assert bearer(SERVER).json()['allow'] is False
    assert client.get('/api/v1/projects/', headers={'Authorization': 'Bearer ' + SERVER}).status_code == 401


@pytest.mark.parametrize('action', ['revoke', 'delete', 'drop', 'legacy'])
def test_no_legacy_fallback(mock_d1, action):
    seed(mock_d1)
    if action == 'revoke':
        mock_d1.execute("UPDATE project_server_credential SET revoked_at = datetime('now')")
    elif action == 'delete':
        mock_d1.execute('DELETE FROM project_server_credential')
    elif action == 'drop':
        mock_d1.execute('DROP TABLE project_server_credential')
    else:
        mock_d1.execute("UPDATE projects SET api_key = ? WHERE id = 'demo-app'", (SERVER,))
        mock_d1.execute('DELETE FROM project_server_credential')
    assert bearer(SERVER).status_code == 401


def test_server_db_failure_is_denied(mock_d1, monkeypatch):
    seed(mock_d1)
    monkeypatch.setattr(d1, 'security_query', AsyncMock(side_effect=RuntimeError('fixture')))
    assert bearer(SERVER).status_code == 401


def test_cas_rotation_and_stale_writer(mock_d1):
    seed(mock_d1)
    new = asyncio.run(project_service.rotate_public_key('demo-app', PUBLIC))
    assert new.startswith('pk_sdk_') and len(new) >= 50
    assert asyncio.run(project_service.get_by_api_key(PUBLIC)) is None
    assert asyncio.run(project_service.get_by_api_key(new)).id == 'demo-app'
    assert bearer(new).status_code == 401
    with pytest.raises(HTTPException) as error:
        asyncio.run(project_service.rotate_public_key('demo-app', PUBLIC))
    assert error.value.status_code == 409
    assert mock_d1.execute("SELECT api_key FROM projects WHERE id='other'").fetchone()[0] == 'pk_sdk_other'
    assert mock_d1.execute("SELECT COUNT(*) FROM projects").fetchone()[0] == 2


def test_cas_wrong_project(mock_d1):
    seed(mock_d1)
    with pytest.raises(HTTPException) as error:
        asyncio.run(project_service.rotate_public_key('other', PUBLIC))
    assert error.value.status_code == 409


def test_demo_runtime_config_only_demo_and_no_cache(mock_d1):
    seed(mock_d1)
    response = client.get('/api/v1/sdk/demo-config')
    assert response.status_code == 200
    assert response.json() == {'api_key': PUBLIC}
    assert response.headers['cache-control'] == 'no-store'
    assert client.get('/api/v1/sdk/other-config').status_code == 401
    mock_d1.execute("DELETE FROM projects WHERE id='demo-app'")
    assert client.get('/api/v1/sdk/demo-config').status_code == 503


def test_actual_migration_is_independent_and_idempotent():
    db = sqlite3.connect(':memory:')
    db.execute('CREATE TABLE projects(id TEXT PRIMARY KEY)')
    migration = (Path(__file__).parents[1] / 'migrations/036_project_server_credential.sql').read_text()
    db.executescript(migration)
    db.executescript(migration)
    assert db.execute('SELECT COUNT(*) FROM project_server_credential').fetchone()[0] == 0
    with pytest.raises(sqlite3.IntegrityError):
        db.execute("INSERT INTO project_server_credential(token_hash,project_id) VALUES ('short','demo-app')")
    db.close()


@pytest.mark.parametrize('mode', ['missing', 'transport', 'provider', 'malformed'])
def test_security_driver_fails_without_secret_logs(monkeypatch, capsys, mode):
    # Load the real driver separately because the general fixture replaces query functions.
    import importlib.util
    spec = importlib.util.spec_from_file_location('isolated_d1', Path(d1.__file__))
    driver = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(driver)
    monkeypatch.setattr(driver, '_get_endpoint', lambda: None if mode == 'missing' else ('https://fixture.invalid', 'fixture-token'))
    response = AsyncMock()
    from unittest.mock import Mock
    response.raise_for_status = Mock()
    response.json = Mock(return_value={'success': False, 'errors': ['fixture-secret']} if mode == 'provider' else {'success': True})
    transport = AsyncMock()
    transport.post = AsyncMock(side_effect=RuntimeError('fixture-secret')) if mode == 'transport' else AsyncMock(return_value=response)
    monkeypatch.setattr(driver, 'get_client', AsyncMock(return_value=transport))
    with pytest.raises(HTTPException) as error:
        asyncio.run(driver.security_query('SELECT ?', ['fixture-secret']))
    assert error.value.status_code == 503
    assert 'fixture-secret' not in str(error.value)
    assert capsys.readouterr().out == ''


def test_fresh_seed_has_unique_random_public_identifiers():
    db = sqlite3.connect(':memory:')
    for name in ['experiments', 'feature_flag', 'event_log', 'feature_flag_exposure']:
        db.execute(f'CREATE TABLE {name}(product TEXT)')
    db.executescript((Path(__file__).parents[1] / 'migrations/017_projects.sql').read_text())
    keys = [row[0] for row in db.execute('SELECT api_key FROM projects')]
    assert len(set(keys)) == 3
    assert all(key.startswith('pk_sdk_') and len(key) == 71 for key in keys)
    db.close()

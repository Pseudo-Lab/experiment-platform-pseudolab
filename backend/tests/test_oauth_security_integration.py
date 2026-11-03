"""Fault injection and concurrency at the integrated security boundary (local SQLite)."""
import asyncio
import hashlib
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.db import d1
from app.main import app
from app.services.project import project_service
from app.schemas.project import ProjectCreate
from test_public_accounts import clients, project


def test_owner_failure_and_lost_response_never_leave_public_orphan(clients, mock_d1, monkeypatch):
    a, _, _ = clients
    mock_d1.execute("CREATE TRIGGER fail_owner BEFORE INSERT ON project_owner BEGIN SELECT RAISE(ABORT, 'injected'); END")
    with pytest.raises(sqlite3.IntegrityError):
        asyncio.run(project_service.create(ProjectCreate(id='failed', name='failed'), 'a'))
    assert not mock_d1.execute("SELECT 1 FROM projects WHERE id='failed'").fetchone()
    mock_d1.execute('DROP TRIGGER fail_owner')
    original = d1.security_query
    async def lost(sql, params=None):
        result = await original(sql, params)
        if sql.startswith('INSERT INTO owned_project_creation'):
            raise HTTPException(503, 'Response lost after commit')
        return result
    monkeypatch.setattr(d1, 'security_query', lost)
    with pytest.raises(HTTPException):
        asyncio.run(project_service.create(ProjectCreate(id='lost', name='lost'), 'a'))
    assert mock_d1.execute("SELECT account_id FROM project_owner WHERE project_id='lost'").fetchone()[0] == 'a'
    assert mock_d1.execute("SELECT count(*) FROM projects p LEFT JOIN project_owner o ON p.id=o.project_id WHERE p.id IN ('lost','failed') AND o.account_id IS NULL").fetchone()[0] == 0


def test_rotation_rollback_revoked_history_and_strict_response(clients, mock_d1, monkeypatch):
    a, _, _ = clients
    public = project(a, 'proj')
    first = a.post('/api/v1/projects/proj/server-key')
    assert first.status_code == 200 and first.headers['cache-control'] == 'no-store'
    token = first.json()['server_key']
    old_hash = hashlib.sha256(token.encode()).hexdigest()
    # Failure AFTER the rotation trigger has revoked the prior key rolls back both.
    mock_d1.execute("CREATE TRIGGER fail_credential AFTER INSERT ON project_server_credential BEGIN SELECT RAISE(ABORT, 'injected'); END")
    with pytest.raises(sqlite3.IntegrityError):
        asyncio.run(project_service.rotate_server_key('proj'))
    assert mock_d1.execute('SELECT revoked_at FROM project_server_credential WHERE token_hash=?', [old_hash]).fetchone()[0] is None
    assert mock_d1.execute('SELECT count(*) FROM project_server_credential').fetchone()[0] == 1
    mock_d1.execute('DROP TRIGGER fail_credential')
    second = a.post('/api/v1/projects/proj/server-key')
    assert second.status_code == 200
    assert mock_d1.execute('SELECT revoked_at FROM project_server_credential WHERE token_hash=?', [old_hash]).fetchone()[0]
    assert asyncio.run(project_service.get_by_server_key(token)) is None
    assert a.delete('/api/v1/projects/proj').status_code == 409
    assert a.delete('/api/v1/projects/proj/server-key').status_code == 204
    assert mock_d1.execute('SELECT count(*) FROM project_server_credential WHERE revoked_at IS NOT NULL').fetchone()[0] == 2
    assert mock_d1.execute('SELECT api_key FROM projects WHERE id="proj"').fetchone()[0] == public
    assert mock_d1.execute('SELECT count(*) FROM project_server_key').fetchone()[0] == 0
    assert a.delete('/api/v1/projects/proj').status_code == 409
    original = d1.security_query
    async def ambiguous(sql, params=None):
        if sql.startswith('INSERT INTO project_server_credential'):
            return []
        return await original(sql, params)
    monkeypatch.setattr(d1, 'security_query', ambiguous)
    response = a.post('/api/v1/projects/proj/server-key')
    assert response.status_code == 409 and 'server_key' not in response.json()


@pytest.mark.parametrize('operation', ['rotate', 'revoke'])
def test_concurrent_rotation_cas_rejects_stale_writer(clients, mock_d1, monkeypatch, operation):
    a, _, _ = clients
    project(a, 'proj')
    first = asyncio.run(project_service.rotate_server_key('proj'))
    original = project_service._active_server_hashes
    async def race():
        gate = asyncio.Event()
        count = 0
        async def snapshot(project_id):
            nonlocal count
            values = await original(project_id)
            count += 1
            if count == 2: gate.set()
            await gate.wait()
            return values
        monkeypatch.setattr(project_service, '_active_server_hashes', snapshot)
        other = project_service.rotate_server_key('proj') if operation == 'rotate' else project_service.revoke_server_key('proj')
        return await asyncio.gather(project_service.rotate_server_key('proj'), other, return_exceptions=True)
    outcomes = asyncio.run(race())
    assert sum(isinstance(x, HTTPException) and x.status_code == 409 for x in outcomes) == 1
    assert mock_d1.execute('SELECT count(*) FROM project_server_credential WHERE revoked_at IS NULL').fetchone()[0] <= 1
    assert asyncio.run(project_service.get_by_server_key(first)) is None


def test_owned_project_competing_connections_are_atomic(clients, mock_d1, tmp_path):
    path = tmp_path / 'race.sqlite'
    mock_d1.commit()
    target = sqlite3.connect(path)
    mock_d1.backup(target)
    target.close()
    from threading import Barrier
    barrier = Barrier(2)
    def create(account):
        db = sqlite3.connect(path, timeout=5)
        db.execute('PRAGMA foreign_keys=ON')
        barrier.wait()
        try:
            db.execute("INSERT INTO owned_project_creation(id,name,api_key,project_type,account_id) VALUES ('race','race',?,'ab_test',?)", ['synthetic-' + account, account])
            db.commit()
            return account
        except sqlite3.IntegrityError:
            db.rollback()
            return None
        finally: db.close()
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(create, ['a','b']))
    assert sum(x is not None for x in outcomes) == 1
    db = sqlite3.connect(path)
    assert db.execute("SELECT account_id FROM project_owner WHERE project_id='race'").fetchone()[0] in outcomes
    assert db.execute('PRAGMA foreign_key_check').fetchall() == []
    db.close()


@pytest.mark.parametrize('owned', [True, False])
def test_legacy_server_table_never_authenticates(clients, mock_d1, owned):
    a, _, admin = clients
    public = project(a if owned else admin, 'proj')
    token = 'sk_live_synthetic_legacy'
    mock_d1.execute('INSERT INTO project_server_key VALUES (?, ?, ?)', ['proj', hashlib.sha256(token.encode()).hexdigest(), 1])
    sdk = TestClient(app, base_url='https://testserver')
    for value in [public, token]:
        assert sdk.post('/api/v1/access/decide', headers={'Authorization': 'Bearer ' + value}, json={}).status_code == 401
    assert mock_d1.execute('SELECT count(*) FROM project_server_credential').fetchone()[0] == 0


def test_session_write_failure_never_reports_logout_success(clients, monkeypatch):
    a, _, admin = clients
    original = d1.security_query
    async def unavailable(sql, params=None):
        if sql.startswith(('DELETE FROM platform_session', 'INSERT OR IGNORE INTO revoked_admin_session')):
            raise HTTPException(503, 'unavailable')
        return await original(sql, params)
    monkeypatch.setattr(d1, 'security_query', unavailable)
    for client in [a, admin]:
        assert client.post('/api/v1/auth/logout').status_code == 503
        assert client.get('/api/v1/auth/me').json()['authenticated'] is True


def test_additive_migration_preserves_keys_and_old_data(clients, mock_d1):
    a, _, admin = clients
    project(admin, 'legacy')
    project(a, 'owned')
    asyncio.run(project_service.rotate_server_key('owned'))
    asyncio.run(project_service.rotate_server_key('owned'))
    mock_d1.execute("INSERT INTO project_server_key VALUES ('legacy', ?, 1)", ['a'*64])
    tables = ['projects', 'project_owner', 'platform_account', 'project_server_credential', 'project_server_key']
    before = {t: list(mock_d1.execute('SELECT * FROM ' + t)) for t in tables}
    mock_d1.executescript((Path(__file__).parents[1] / 'migrations/037_atomic_owned_projects_and_credentials.sql').read_text())
    assert before == {t: list(mock_d1.execute('SELECT * FROM ' + t)) for t in tables}
    assert list(mock_d1.execute('PRAGMA foreign_key_check')) == []


def test_missing_atomic_migration_denies_writes(clients, mock_d1):
    a, _, _ = clients
    project(a, 'owned')
    mock_d1.execute('DROP TRIGGER rotate_project_server_credential')
    assert a.post('/api/v1/projects/owned/server-key').status_code == 409
    assert mock_d1.execute('SELECT count(*) FROM project_server_credential').fetchone()[0] == 0
    mock_d1.execute('DROP TRIGGER create_owned_project')
    with pytest.raises(sqlite3.OperationalError):
        asyncio.run(project_service.create(ProjectCreate(id='missing', name='missing'), 'a'))
    assert mock_d1.execute("SELECT count(*) FROM projects WHERE id='missing'").fetchone()[0] == 0


@pytest.mark.parametrize('method', ['POST', 'DELETE'])
def test_credential_lost_response_is_not_success(clients, mock_d1, monkeypatch, method):
    a, _, _ = clients
    project(a, 'owned')
    original_token = asyncio.run(project_service.rotate_server_key('owned'))
    original = d1.security_query
    async def lost(sql, params=None):
        result = await original(sql, params)
        if sql.startswith(('INSERT INTO project_server_credential', 'UPDATE project_server_credential')):
            raise HTTPException(503, 'Ambiguous response')
        return result
    monkeypatch.setattr(d1, 'security_query', lost)
    result = a.request(method, '/api/v1/projects/owned/server-key')
    assert result.status_code == 503 and 'server_key' not in result.json()
    assert result.headers['cache-control'] == 'no-store'
    assert asyncio.run(project_service.get_by_server_key(original_token)) is None
    assert mock_d1.execute('SELECT count(*) FROM project_server_credential WHERE revoked_at IS NOT NULL').fetchone()[0] == 1

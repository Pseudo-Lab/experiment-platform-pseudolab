"""Real routes with signed synthetic Google tokens and isolated SQLite only."""
import sqlite3
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from test_public_accounts import clients, provider, start, project
from test_project_sharing import invite, accept


def google_login(provider, claims):
    provider['claims'] = claims
    client = TestClient(app, base_url='https://testserver')
    state = start(client, provider)
    response = client.get(f'/api/v1/auth/google/callback?state={state}&code=synthetic', follow_redirects=False)
    assert response.headers['location'] == '/login?oauth=success'
    return client


def test_google_profile_updates_same_sub_without_linking_or_changing_roles(clients, provider, mock_d1):
    first = google_login(provider, {'name': '  Test Person  ', 'email': 'First@Gmail.com', 'email_verified': True})
    original = first.get('/api/v1/auth/me').json()['user']
    assert original['display_name'] == 'Test Person'
    assert original['email'] == 'first@gmail.com'
    assert original['is_admin'] is False
    project(first, 'profile-project')
    second = google_login(provider, {'name': 'Updated Person', 'email': 'other@gmail.com', 'email_verified': True, 'is_admin': True})
    updated = second.get('/api/v1/auth/me').json()['user']
    assert updated['account_id'] == original['account_id']
    assert updated['username'] == original['username']
    assert updated['display_name'] == 'Updated Person' and updated['email'] == 'other@gmail.com'
    assert updated['is_admin'] is False
    assert first.get('/api/v1/auth/me').json()['user']['email'] == 'other@gmail.com'
    assert second.get('/api/v1/projects/').json()[0]['id'] == 'profile-project'
    assert mock_d1.execute("SELECT count(*) FROM platform_account WHERE google_sub='new-google-sub'").fetchone()[0] == 1


@pytest.mark.parametrize('claims,email,authoritative', [
    ({'email': 'a@gmail.com', 'email_verified': True}, 'a@gmail.com', 1),
    ({'email': 'a@example.com', 'email_verified': True, 'hd': 'example.com'}, 'a@example.com', 1),
    ({'email': 'a@example.com', 'email_verified': True}, 'a@example.com', 0),
    ({'email': 'a@example.com', 'email_verified': True, 'hd': ' '}, 'a@example.com', 0),
    ({'email': 'a@gmail.com', 'email_verified': 'true'}, None, 0),
    ({'email': 'a@gmail.com', 'email_verified': False}, None, 0),
    ({'email': 'invalid', 'email_verified': True}, None, 0),
    ({'email': {'forged': 'a@gmail.com'}, 'email_verified': True}, None, 0),
    ({'email_verified': True}, None, 0),
    ({}, None, 0),
])
def test_profile_missing_or_invalid_claims_do_not_become_identity_or_permission(clients, provider, mock_d1, claims, email, authoritative):
    client = google_login(provider, {**claims, 'name': ['invalid-name']})
    user = client.get('/api/v1/auth/me').json()['user']
    assert user['display_name'] is None and user['email'] == email
    assert user['is_admin'] is False
    assert mock_d1.execute('SELECT email_authoritative FROM platform_account_profile WHERE account_id=?', [user['account_id']]).fetchone()[0] == authoritative


def test_missing_claims_clear_previous_email_proof(clients, provider, mock_d1):
    client = google_login(provider, {'email': 'a@gmail.com', 'email_verified': True})
    account = client.get('/api/v1/auth/me').json()['user']['account_id']
    google_login(provider, {})
    profile = dict(mock_d1.execute('SELECT * FROM platform_account_profile WHERE account_id=?', [account]).fetchone())
    assert profile['email'] is None and profile['email_authoritative'] == 0


def test_profile_storage_failure_does_not_issue_a_session(clients, provider, monkeypatch):
    from app.db import d1
    execute = d1.security_execute
    async def fail_profile(sql, params=None):
        if 'INSERT INTO platform_account_profile' in sql:
            raise HTTPException(503, 'Synthetic profile failure')
        return await execute(sql, params)
    monkeypatch.setattr(d1, 'security_execute', fail_profile)
    client = TestClient(app, base_url='https://testserver')
    state = start(client, provider)
    response = client.get(f'/api/v1/auth/google/callback?state={state}&code=synthetic', follow_redirects=False)
    assert response.headers['location'] == '/login?oauth=failed'
    assert client.get('/api/v1/auth/me').json()['authenticated'] is False


def test_recipient_invitation_scopes_profile_data_and_preserves_history(clients, mock_d1):
    owner, member, admin = clients
    project(owner, 'shared')
    mock_d1.executemany('INSERT INTO platform_account_profile VALUES (?,?,?,1)', [
        ('a', 'Owner', 'owner@gmail.com'), ('b', 'Member', 'member@gmail.com'),
    ])
    mock_d1.commit()
    response = owner.post('/api/v1/projects/shared/invitations', json={'role': 'editor', 'email': ' MEMBER@GMAIL.COM '})
    assert response.status_code == 201, response.text
    link = response.json()
    assert link['recipient_email'] == 'member@gmail.com'
    assert accept(owner, link).status_code == 403
    assert mock_d1.execute('SELECT accepted_by FROM project_invitation').fetchone()[0] is None
    assert accept(member, link).status_code == 200
    assert accept(member, link).status_code == 200
    members = owner.get('/api/v1/projects/shared/members')
    assert members.headers['cache-control'] == 'no-store'
    by_id = {m['account_id']: m for m in members.json()}
    assert by_id['b']['display_name'] == 'Member' and by_id['b']['email'] == 'member@gmail.com'
    assert set(by_id['b']) == {'account_id', 'role', 'display_name', 'email'}
    assert member.get('/api/v1/projects/shared/members').status_code == 403
    assert member.get('/api/v1/projects/shared/invitations').status_code == 403
    assert owner.delete('/api/v1/projects/shared/members/b').status_code == 204
    history = owner.get('/api/v1/projects/shared/invitations').json()[0]
    assert history['accepted_display_name'] == 'Member' and history['accepted_email'] == 'member@gmail.com'
    assert history['recipient_email'] == 'member@gmail.com' and history['accepted_by'] == 'b'
    assert 'token' not in history and 'token_hash' not in history
    assert accept(member, link).status_code == 410


@pytest.mark.parametrize('email,authoritative', [('wrong@gmail.com', 1), ('member@gmail.com', 0), (None, 0)])
def test_recipient_check_cannot_be_bypassed_by_token_or_untrusted_email(clients, mock_d1, email, authoritative):
    owner, member, _ = clients
    project(owner, 'shared')
    mock_d1.execute('INSERT INTO platform_account_profile VALUES (?,?,?,?)', ['b', 'Member', email, authoritative])
    mock_d1.commit()
    link = owner.post('/api/v1/projects/shared/invitations', json={'role': 'viewer', 'email': 'member@gmail.com'}).json()
    assert accept(member, link).status_code == 403
    with pytest.raises(sqlite3.IntegrityError, match='Invited Google account required'):
        mock_d1.execute('INSERT INTO project_invitation_acceptance VALUES (?,?)', [
            mock_d1.execute('SELECT token_hash FROM project_invitation').fetchone()[0], 'b',
        ])
    assert mock_d1.execute('SELECT count(*) FROM project_member').fetchone()[0] == 0
    assert mock_d1.execute('SELECT accepted_by FROM project_invitation').fetchone()[0] is None


def test_invitation_and_recipient_creation_roll_back_together(clients, mock_d1):
    owner, _, _ = clients
    project(owner, 'shared')
    mock_d1.executescript("CREATE TRIGGER reject_recipient BEFORE INSERT ON project_invitation_recipient BEGIN SELECT RAISE(ABORT, 'Synthetic failure'); END;")
    with pytest.raises(sqlite3.IntegrityError):
        mock_d1.execute('INSERT INTO project_invitation_creation VALUES (?,?,?,?,?,?)', ['id', 'shared', 'digest', 'viewer', 9999999999, 'member@gmail.com'])
    assert mock_d1.execute('SELECT count(*) FROM project_invitation').fetchone()[0] == 0


def test_acceptance_rechecks_email_at_write_and_preserves_retry_identity(clients, mock_d1, monkeypatch):
    from app.db import d1
    owner, member, _ = clients
    project(owner, 'shared')
    mock_d1.execute('INSERT INTO platform_account_profile VALUES (?,?,?,1)', ['b', 'Member', 'member@gmail.com'])
    mock_d1.commit()
    link = owner.post('/api/v1/projects/shared/invitations', json={'role': 'viewer', 'email': 'member@gmail.com'}).json()
    query = d1.security_query
    async def change_email_before_insert(sql, params=None, **kwargs):
        if 'INSERT INTO project_invitation_acceptance' in sql:
            mock_d1.execute("UPDATE platform_account_profile SET email='changed@gmail.com' WHERE account_id='b'")
            mock_d1.commit()
        try:
            return await query(sql, params, **kwargs)
        except sqlite3.IntegrityError:
            # The production D1 client maps a failed statement to a closed 503.
            raise HTTPException(503, 'Synthetic failed statement') from None
    monkeypatch.setattr(d1, 'security_query', change_email_before_insert)
    assert accept(member, link).status_code == 503
    assert mock_d1.execute('SELECT count(*) FROM project_member').fetchone()[0] == 0
    assert mock_d1.execute('SELECT accepted_by FROM project_invitation').fetchone()[0] is None
    monkeypatch.setattr(d1, 'security_query', query)
    mock_d1.execute("UPDATE platform_account_profile SET email='member@gmail.com' WHERE account_id='b'")
    mock_d1.commit()
    assert accept(member, link).status_code == 200
    mock_d1.execute("UPDATE platform_account_profile SET email='changed@gmail.com' WHERE account_id='b'")
    mock_d1.commit()
    assert accept(member, link).status_code == 200  # same accepted internal account


@pytest.mark.parametrize('email', ['', 'not-email', 'Name <person@gmail.com>', 'a@b', 'a@gmail.com\r\nBcc:x@y.com', 'a\x00@gmail.com', 'a'*255+'@gmail.com'])
def test_invitation_email_validation(clients, email):
    owner, _, _ = clients
    project(owner, 'shared')
    assert owner.post('/api/v1/projects/shared/invitations', json={'role': 'viewer', 'email': email}).status_code == 422


def test_profile_migration_replays_without_inventing_profiles_or_changing_links(clients, mock_d1):
    owner, member, _ = clients
    project(owner, 'shared')
    link = invite(owner)
    migration = (Path(__file__).parents[1] / 'migrations/042_account_profiles_and_invitation_recipients.sql').read_text()
    mock_d1.executescript(migration)
    mock_d1.executescript(migration)
    assert mock_d1.execute('SELECT count(*) FROM platform_account_profile').fetchone()[0] == 0
    assert accept(member, link).status_code == 200
    assert owner.get('/api/v1/projects/shared/invitations').json()[0]['accepted_by'] == 'b'

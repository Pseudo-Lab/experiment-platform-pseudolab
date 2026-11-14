import hashlib
import sqlite3
import time
from pathlib import Path

import pytest
from fastapi import HTTPException

from app.db import d1
from test_public_accounts import clients, project

BASE = '/api/v1/projects'


def create_invitation(owner, email='member@gmail.com'):
    return owner.post(f'{BASE}/inbox/invitations', json={'role': 'editor', 'email': email})


def set_profile(db, account, email, authoritative=1, name=None):
    db.execute('INSERT OR REPLACE INTO platform_account_profile VALUES (?,?,?,?)',
               [account, name, email, authoritative])
    db.commit()


def test_pending_inbox_is_recipient_scoped_and_before_signup(clients, mock_d1):
    owner, member, other = clients
    project(owner, 'inbox')
    set_profile(mock_d1, 'a', 'owner@gmail.com', name='Project Owner')
    response = create_invitation(owner)
    assert response.status_code == 201, response.text
    invite = response.json()
    assert mock_d1.execute('SELECT invited_by FROM project_invitation WHERE id=?', [invite['id']]).fetchone()[0] == 'a'
    assert member.get(f'{BASE}/invitations/pending').json() == []

    # Signup is independent of invite creation; the verified matching profile makes it appear later.
    set_profile(mock_d1, 'b', 'Member@Gmail.com', name='Member Name')
    pending = member.get(f'{BASE}/invitations/pending')
    assert pending.status_code == 200
    assert pending.headers['cache-control'] == 'no-store'
    assert pending.json() == [{
        'id': invite['id'], 'project_id': 'inbox', 'project_name': 'inbox', 'role': 'editor',
        'created_at': invite['created_at'], 'expires_at': invite['expires_at'], 'inviter_name': 'Project Owner',
    }]
    assert owner.get(f'{BASE}/invitations/pending').json() == []
    assert other.get(f'{BASE}/invitations/pending').status_code == 403  # administrator session has no account_id
    assert member.get(f'{BASE}/inbox/invitations').status_code == 404
    assert member.get(f'{BASE}/invitations/pending/extra').status_code == 403
    assert 'token' not in pending.text and 'token_hash' not in pending.text and 'recipient_email' not in pending.text


@pytest.mark.parametrize('email,authoritative', [('other@gmail.com', 1), ('member@gmail.com', 0), (None, 0)])
def test_pending_inbox_and_id_actions_hide_nonmatching_or_unverified_accounts(clients, mock_d1, email, authoritative):
    owner, member, _ = clients
    project(owner, 'inbox')
    invitation = create_invitation(owner).json()
    set_profile(mock_d1, 'b', email, authoritative)
    assert member.get(f'{BASE}/invitations/pending').json() == []
    assert member.post(f"{BASE}/invitations/{invitation['id']}/accept").status_code == 404
    assert member.post(f"{BASE}/invitations/{invitation['id']}/decline").status_code == 404
    assert tuple(mock_d1.execute('SELECT accepted_by, declined_at FROM project_invitation').fetchone()) == (None, None)


def test_unknown_invitation_and_no_account_sessions_have_exact_statuses(clients):
    owner, member, admin = clients
    unknown = 'missing-invitation-id'
    assert member.post(f"{BASE}/invitations/{unknown}/accept").status_code == 404
    assert member.post(f"{BASE}/invitations/{unknown}/decline").status_code == 404
    assert admin.get(f'{BASE}/invitations/pending').status_code == 403
    assert admin.post(f"{BASE}/invitations/{unknown}/accept").status_code == 403
    assert admin.post(f"{BASE}/invitations/{unknown}/decline").status_code == 403


def test_email_acceptance_and_retry_do_not_restore_removed_member(clients, mock_d1):
    owner, member, _ = clients
    project(owner, 'inbox')
    set_profile(mock_d1, 'b', 'member@gmail.com')
    invitation = create_invitation(owner).json()
    path = f"{BASE}/invitations/{invitation['id']}/accept"
    accepted = member.post(path)
    assert accepted.status_code == 200 and accepted.json()['access_role'] == 'editor'
    assert member.post(path).status_code == 200
    # Once accepted, retry identity is the internal account and existing access, not mutable email.
    mock_d1.execute("UPDATE platform_account_profile SET email=NULL, email_authoritative=0 WHERE account_id='b'")
    mock_d1.commit()
    assert member.post(path).status_code == 200
    mock_d1.execute("UPDATE platform_account_profile SET email='member@gmail.com', email_authoritative=1 WHERE account_id='b'")
    mock_d1.commit()
    assert owner.delete(f"{BASE}/inbox/members/b").status_code == 204
    assert member.post(path).status_code == 410
    assert mock_d1.execute('SELECT count(*) FROM project_member WHERE account_id="b"').fetchone()[0] == 0


def test_acceptance_rechecks_current_email_atomically(clients, mock_d1, monkeypatch):
    owner, member, _ = clients
    project(owner, 'inbox')
    set_profile(mock_d1, 'b', 'member@gmail.com')
    invitation = create_invitation(owner).json()
    original = d1.security_query

    async def change_email(sql, params=None, **kwargs):
        if 'INSERT INTO project_invitation_acceptance' in sql:
            mock_d1.execute("UPDATE platform_account_profile SET email='changed@gmail.com' WHERE account_id='b'")
            mock_d1.commit()
        try:
            return await original(sql, params, **kwargs)
        except sqlite3.IntegrityError:
            raise HTTPException(503, 'Synthetic failed statement') from None

    monkeypatch.setattr(d1, 'security_query', change_email)
    response = member.post(f"{BASE}/invitations/{invitation['id']}/accept")
    assert response.status_code == 503
    assert mock_d1.execute('SELECT accepted_by FROM project_invitation').fetchone()[0] is None
    assert mock_d1.execute('SELECT count(*) FROM project_member').fetchone()[0] == 0


def test_decline_is_atomic_idempotent_and_blocks_legacy_acceptance(clients, mock_d1):
    owner, member, _ = clients
    project(owner, 'inbox')
    set_profile(mock_d1, 'b', 'member@gmail.com')
    invitation = create_invitation(owner).json()
    path = f"{BASE}/invitations/{invitation['id']}/decline"
    assert member.post(path).status_code == 204
    assert member.post(path).status_code == 204
    assert mock_d1.execute('SELECT declined_at FROM project_invitation WHERE id=?', [invitation['id']]).fetchone()[0] is not None
    assert member.get(f'{BASE}/invitations/pending').json() == []
    assert member.post(f'{BASE}/invitations/preview', json={'token': invitation['token']}).status_code == 410
    assert member.post(f"{BASE}/invitations/{invitation['id']}/accept").status_code == 410
    digest = mock_d1.execute('SELECT token_hash FROM project_invitation WHERE id=?', [invitation['id']]).fetchone()[0]
    with pytest.raises(sqlite3.IntegrityError, match='Invitation unavailable'):
        mock_d1.execute('INSERT INTO project_invitation_acceptance VALUES (?,?)', [digest, 'b'])
    history = owner.get(f'{BASE}/inbox/invitations').json()[0]
    assert history['status'] == 'declined' and history['declined_at'] is not None
    assert mock_d1.execute('SELECT count(*) FROM project_member').fetchone()[0] == 0


@pytest.mark.parametrize('terminal', ['expired', 'revoked', 'declined'])
def test_rightful_terminal_invitations_return_gone(clients, mock_d1, terminal):
    owner, member, _ = clients
    project(owner, 'inbox')
    set_profile(mock_d1, 'b', 'member@gmail.com')
    invitation = create_invitation(owner).json()
    if terminal == 'expired':
        mock_d1.execute('UPDATE project_invitation SET expires_at=? WHERE id=?', [int(time.time()) - 1, invitation['id']])
    elif terminal == 'revoked':
        assert owner.delete(f"{BASE}/inbox/invitations/{invitation['id']}").status_code == 204
    else:
        assert member.post(f"{BASE}/invitations/{invitation['id']}/decline").status_code == 204
    mock_d1.commit()
    assert member.post(f"{BASE}/invitations/{invitation['id']}/accept").status_code == 410
    if terminal != 'declined':
        assert member.post(f"{BASE}/invitations/{invitation['id']}/decline").status_code == 410
    assert member.get(f'{BASE}/invitations/pending').json() == []


def test_legacy_untargeted_invites_remain_link_compatible_and_creator_defaults_null(clients, mock_d1):
    owner, member, _ = clients
    project(owner, 'inbox')
    link = owner.post(f'{BASE}/inbox/invitations', json={'role': 'viewer'}).json()
    assert owner.get(f'{BASE}/invitations/pending').json() == []
    assert mock_d1.execute('SELECT invited_by FROM project_invitation WHERE id=?', [link['id']]).fetchone()[0] == 'a'
    # Old creation callers that omit the newly added named column continue to store NULL.
    mock_d1.execute(
        'INSERT INTO project_invitation_creation (id, project_id, token_hash, role, expires_at, email) VALUES (?,?,?,?,?,?)',
        ['legacy', 'inbox', hashlib.sha256(b'legacy-token').hexdigest(), 'viewer', int(time.time()) + 3600, None])
    assert mock_d1.execute("SELECT invited_by FROM project_invitation WHERE id='legacy'").fetchone()[0] is None
    assert member.post(f'{BASE}/invitations/accept', json={'token': link['token']}).status_code == 200


def test_migration_045_preserves_existing_legacy_invitation():
    db = sqlite3.connect(':memory:')
    db.row_factory = sqlite3.Row
    db.executescript('''
        PRAGMA foreign_keys=ON;
        CREATE TABLE projects (id TEXT PRIMARY KEY);
        CREATE TABLE platform_account (id TEXT PRIMARY KEY);
        CREATE TABLE project_owner (
            project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
            account_id TEXT NOT NULL REFERENCES platform_account(id)
        );
    ''')
    migration_dir = Path(__file__).parents[1] / 'migrations'
    db.executescript((migration_dir / '040_project_sharing.sql').read_text())
    db.executescript((migration_dir / '042_account_profiles_and_invitation_recipients.sql').read_text())
    db.executemany('INSERT INTO platform_account VALUES (?)', [('owner',), ('recipient',)])
    db.execute('INSERT INTO projects VALUES (?)', ['inbox'])
    db.execute('INSERT INTO project_owner VALUES (?,?)', ['inbox', 'owner'])
    token_digest = hashlib.sha256(b'existing-legacy-token').hexdigest()
    db.execute('INSERT INTO project_invitation (id, project_id, token_hash, role, expires_at) VALUES (?,?,?,?,?)',
               ['legacy-id', 'inbox', token_digest, 'viewer', int(time.time()) + 3600])
    db.commit()
    migration = (Path(__file__).parents[1] / 'migrations/045_email_invitation_inbox.sql').read_text()
    db.executescript(migration)
    # Existing invitations and hashes survive, with no inferred recipient or inviter.
    row = db.execute('SELECT token_hash, invited_by, declined_at FROM project_invitation WHERE id=?', ['legacy-id']).fetchone()
    assert tuple(row) == (token_digest, None, None)
    db.execute('INSERT INTO project_invitation_acceptance VALUES (?,?)', [token_digest, 'recipient'])
    assert db.execute('SELECT accepted_by FROM project_invitation WHERE id=?', ['legacy-id']).fetchone()[0] == 'recipient'
    assert db.execute('SELECT role FROM project_member WHERE project_id=? AND account_id=?', ['inbox', 'recipient']).fetchone()[0] == 'viewer'
    assert 'declined_at' in migration and 'invited_by' in migration
    db.close()


def test_acceptance_response_loss_reconciles_commit_without_replaying_insert(clients, mock_d1, monkeypatch):
    owner, member, _ = clients
    project(owner, 'inbox')
    set_profile(mock_d1, 'b', 'member@gmail.com')
    invitation = create_invitation(owner).json()
    original = d1.security_query
    writes = 0

    async def commit_then_lose_response(sql, params=None, **kwargs):
        nonlocal writes
        result = await original(sql, params, **kwargs)
        if 'INSERT INTO project_invitation_acceptance' in sql:
            writes += 1
            raise HTTPException(503, 'Synthetic lost response')
        return result

    monkeypatch.setattr(d1, 'security_query', commit_then_lose_response)
    response = member.post(f"{BASE}/invitations/{invitation['id']}/accept")
    assert response.status_code == 200 and response.json()['access_role'] == 'editor'
    assert writes == 1
    assert mock_d1.execute('SELECT accepted_by FROM project_invitation WHERE id=?', [invitation['id']]).fetchone()[0] == 'b'


def test_acceptance_reconciles_revoke_that_wins_write_race(clients, mock_d1, monkeypatch):
    owner, member, _ = clients
    project(owner, 'inbox')
    set_profile(mock_d1, 'b', 'member@gmail.com')
    invitation = create_invitation(owner).json()
    original = d1.security_query

    async def revoke_before_acceptance(sql, params=None, **kwargs):
        if 'INSERT INTO project_invitation_acceptance' in sql:
            mock_d1.execute('UPDATE project_invitation SET revoked_at=unixepoch() WHERE id=?', [invitation['id']])
            mock_d1.commit()
            try:
                return await original(sql, params, **kwargs)
            except sqlite3.IntegrityError:
                raise HTTPException(503, 'Synthetic concurrent revoke') from None
        return await original(sql, params, **kwargs)

    monkeypatch.setattr(d1, 'security_query', revoke_before_acceptance)
    response = member.post(f"{BASE}/invitations/{invitation['id']}/accept")
    assert response.status_code == 410
    assert mock_d1.execute('SELECT accepted_by FROM project_invitation WHERE id=?', [invitation['id']]).fetchone()[0] is None
    assert mock_d1.execute('SELECT count(*) FROM project_member').fetchone()[0] == 0


def test_invitation_acceptance_does_not_promote_existing_viewer_or_owner(clients, mock_d1):
    owner, member, _ = clients
    project(owner, 'inbox')
    mock_d1.execute('INSERT INTO project_member VALUES (?,?,?)', ['inbox', 'b', 'viewer'])
    mock_d1.commit()
    set_profile(mock_d1, 'b', 'member@gmail.com')
    viewer_invitation = create_invitation(owner).json()
    accepted_viewer = member.post(f"{BASE}/invitations/{viewer_invitation['id']}/accept")
    assert accepted_viewer.status_code == 200 and accepted_viewer.json()['access_role'] == 'viewer'
    assert mock_d1.execute("SELECT role FROM project_member WHERE project_id='inbox' AND account_id='b'").fetchone()[0] == 'viewer'

    set_profile(mock_d1, 'a', 'owner@gmail.com')
    owner_invitation = owner.post(f'{BASE}/inbox/invitations', json={'role': 'editor', 'email': 'owner@gmail.com'}).json()
    accepted_owner = owner.post(f"{BASE}/invitations/{owner_invitation['id']}/accept")
    assert accepted_owner.status_code == 200 and accepted_owner.json()['access_role'] == 'owner'
    assert mock_d1.execute("SELECT count(*) FROM project_member WHERE project_id='inbox' AND account_id='a'").fetchone()[0] == 0

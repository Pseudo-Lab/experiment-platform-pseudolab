import hashlib
import sqlite3
import time
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from app.main import app
from test_public_accounts import clients, project

BASE = '/api/v1/projects'


def invite(owner, role='viewer', pid='shared'):
    r = owner.post(f'{BASE}/{pid}/invitations', json={'role': role})
    assert r.status_code == 201, r.text
    return r.json()


def accept(client, invitation):
    return client.post(f'{BASE}/invitations/accept', json={'token': invitation['token']})


@pytest.mark.parametrize('role', ['viewer', 'editor'])
def test_sharing_scope_and_permissions(clients, mock_d1, role):
    owner, member, _ = clients
    project(owner, 'shared')
    project(owner, 'private')
    owner.post('/api/v1/feature-flags/', json={'flag_key':'shared-flag','project_id':'shared'})
    owner.post('/api/v1/experiments/', json={'id':'shared-exp','name':'Shared','project_id':'shared','flag_key':'shared-flag'})
    link = invite(owner, role)
    assert member.get(f'{BASE}/shared').status_code == 404
    assert accept(member, link).json()['access_role'] == role
    assert accept(member, link).status_code == 200  # safe retry
    assert [p['id'] for p in member.get(BASE+'/').json()] == ['shared']
    assert member.get(f'{BASE}/private').status_code == 404
    assert member.get('/api/v1/experiments/').json()[0]['id'] == 'shared-exp'
    assert member.get('/api/v1/feature-flags/').json()[0]['flag_key'] == 'shared-flag'
    for path in ['/experiments/shared-exp','/experiments/shared-exp/analytics','/feature-flags/shared-flag/rules']:
        assert member.get('/api/v1'+path).status_code == 200
    expected = 200 if role == 'editor' else 403
    assert member.patch('/api/v1/experiments/shared-exp',json={'name':'Edited'}).status_code == expected
    assert member.get(f'{BASE}/shared/api-key').status_code == expected
    assert member.post('/api/v1/feature-flags/',json={'flag_key':'new-flag','project_id':'shared'}).status_code == (201 if role=='editor' else 403)
    for path, method in [('shared','delete'),('shared/server-key','post'),('shared/server-key','delete'),('shared/members','get'),('shared/invitations','get')]:
        assert getattr(member, method)(f'{BASE}/{path}').status_code == 403
    assert member.post(f'{BASE}/shared/invitations',json={'role':'editor'}).status_code == 403
    assert member.get('/api/v1/experiments/shared-exp/result').status_code == 403
    assert {m['account_id']: m['role'] for m in owner.get(f'{BASE}/shared/members').json()} == {'a':'owner','b':role}
    assert member.get(f'{BASE}/shared').json()['access_role'] == role


def test_token_hash_single_use_and_removal(clients, mock_d1):
    owner, member, admin = clients
    project(owner,'shared')
    link=invite(owner,'editor')
    assert mock_d1.execute('SELECT token_hash FROM project_invitation').fetchone()[0] == hashlib.sha256(link['token'].encode()).hexdigest()
    assert 'token' not in owner.get(f'{BASE}/shared/invitations').json()[0]
    assert accept(member,link).status_code == 200
    # A different account cannot claim an already used invitation.
    assert accept(owner,link).status_code == 410
    assert owner.patch(f'{BASE}/shared/members/b',json={'role':'viewer'}).status_code == 204
    assert member.get(f'{BASE}/shared/api-key').status_code == 403
    assert owner.delete(f'{BASE}/shared/members/b').status_code == 204
    assert member.get(f'{BASE}/shared').status_code == 404
    assert accept(member,link).status_code == 410
    assert owner.delete(f'{BASE}/shared/members/a').status_code == 409
    assert owner.patch(f'{BASE}/shared/members/a',json={'role':'viewer'}).status_code == 409


@pytest.mark.parametrize('invalid', ['expired','revoked','unknown'])
def test_invalid_invites_cannot_add_members(clients, mock_d1, invalid):
    owner,member,_=clients
    project(owner,'shared');link=invite(owner)
    if invalid=='expired': mock_d1.execute('UPDATE project_invitation SET expires_at=0')
    if invalid=='revoked': assert owner.delete(f'{BASE}/shared/invitations/'+link['id']).status_code == 204
    if invalid=='unknown': link['token']='z'*43
    assert accept(member,link).status_code == 410
    assert member.get(BASE+'/').json()==[]
    assert mock_d1.execute('SELECT count(*) FROM project_member').fetchone()[0]==0


def test_unauthenticated_cross_project_and_invalid_role(clients):
    owner,other,_=clients
    project(owner,'shared');project(other,'other')
    link=invite(owner)
    assert TestClient(app,base_url='https://testserver').post(BASE+'/invitations/accept',json={'token':link['token']}).status_code==401
    assert other.delete(f'{BASE}/other/invitations/'+link['id']).status_code==404
    assert other.get(f'{BASE}/shared/invitations').status_code==404
    assert owner.post(f'{BASE}/shared/invitations',json={'role':'owner'}).status_code==422
    assert owner.post(f'{BASE}/shared/invitations',json={'role':'admin'}).status_code==422


def test_accept_trigger_is_atomic_and_single_use(clients, mock_d1):
    owner,member,_=clients
    project(owner,'shared');link=invite(owner)
    digest=hashlib.sha256(link['token'].encode()).hexdigest()
    # Acceptance for a missing account rolls the entire statement back.
    with pytest.raises(sqlite3.IntegrityError):
        mock_d1.execute('INSERT INTO project_invitation_acceptance VALUES (?,?)',[digest,'missing'])
    assert mock_d1.execute('SELECT accepted_by FROM project_invitation').fetchone()[0] is None
    assert accept(member,link).status_code==200
    with pytest.raises(sqlite3.IntegrityError):
        mock_d1.execute('INSERT INTO project_invitation_acceptance VALUES (?,?)',[digest,'a'])
    mock_d1.executescript((Path(__file__).parents[1]/'migrations/040_project_sharing.sql').read_text())
    assert mock_d1.execute('SELECT count(*) FROM project_member').fetchone()[0]==1


def test_preview_does_not_consume_and_revoke_invalidates_it(clients):
    owner,member,_=clients
    project(owner,'shared');link=invite(owner,'editor')
    response=member.post(BASE+'/invitations/preview',json={'token':link['token']})
    assert response.json()['name']=='shared'
    assert response.json()['role']=='editor'
    assert member.get(BASE+'/').json()==[]
    assert owner.delete(f"{BASE}/shared/invitations/{link['id']}").status_code==204
    assert member.post(BASE+'/invitations/preview',json={'token':link['token']}).status_code==410
    assert accept(member,link).status_code==410


def test_membership_storage_failure_fails_closed(clients, monkeypatch):
    owner,member,_=clients
    project(owner,'shared');assert accept(member,invite(owner)).status_code==200
    from app.db import d1
    from fastapi import HTTPException
    original=d1.security_query
    async def unavailable(sql,params=None,**kwargs):
        if 'project_access' in sql:
            raise HTTPException(503,'Storage unavailable')
        return await original(sql,params,**kwargs)
    monkeypatch.setattr(d1,'security_query',unavailable)
    assert member.get(BASE+'/shared').status_code==503
    assert member.get(BASE+'/').status_code==503

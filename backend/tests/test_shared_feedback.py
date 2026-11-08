"""Real middleware/SQLite routes, isolated identities and stub private R2 only."""
import base64
import json
import sqlite3
from pathlib import Path
from unittest.mock import Mock

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.core.auth import AuthenticatedUser
from app.core.config import settings
from app.db import r2
from app.main import app

BASE = '/api/v1/bug-reports'
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1cAAAAASUVORK5CYII=')


@pytest.fixture
def actors(monkeypatch):
    async def resolve(request):
        name = request.headers.get('test-actor')
        return AuthenticatedUser(username='private-identity', account_id=name, is_admin=name == 'admin') if name else None
    monkeypatch.setattr('app.main.resolve_session', resolve)
    monkeypatch.setattr(settings, 'ADMIN_USERNAME', 'configured')
    monkeypatch.setattr(settings, 'ADMIN_PASSWORD_HASH', 'configured')
    monkeypatch.setattr(settings, 'AUTH_SESSION_SECRET', 'isolated-test-secret')
    monkeypatch.setattr(r2, 'download', Mock(return_value=PNG))
    return TestClient(app)


def create(client, actor='alice', **fields):
    return client.post(BASE+'/', headers={'test-actor': actor}, json={
        'title': 'A problem', 'description': 'Steps to reproduce', 'category': 'functional', **fields,
    })


def test_shared_feedback_members_and_admin_status(actors):
    response = create(actors)
    assert response.status_code == 201
    report = response.json()
    assert 'author_account_id' not in report
    for actor in ['alice', 'bob', 'admin']:
        headers = {'test-actor': actor}
        assert actors.get(BASE+'/', headers=headers).json()[0]['id'] == report['id']
        assert actors.get(BASE+'/'+report['id'], headers=headers).status_code == 200
    for method in ['patch', 'delete']:
        kwargs = {'json': {'status': 'resolved'}} if method == 'patch' else {}
        assert getattr(actors, method)(BASE+'/'+report['id'], headers={'test-actor':'alice'}, **kwargs).status_code == 403
    changed = actors.patch(BASE+'/'+report['id'], headers={'test-actor':'admin'}, json={'status':'in_progress'})
    assert changed.json()['status'] == 'in_progress'
    assert actors.patch(BASE+'/'+report['id'], headers={'test-actor':'admin'}, json={'status':'invalid'}).status_code == 422


def test_suggestion_works_with_production_category_constraint(actors, mock_d1):
    # The historical production CHECK excludes feature_request; map into other + feedback_kind.
    response = create(actors, category='feature_request')
    assert response.status_code == 201
    assert response.json()['category'] == 'feature_request'
    row = mock_d1.execute('SELECT category, feedback_kind FROM bug_reports').fetchone()
    assert tuple(row) == ('other', 'suggestion')


def test_legacy_private_reports_not_shared(actors, mock_d1):
    mock_d1.execute("INSERT INTO bug_reports (id,title,category,status,attachments,created_at,updated_at) VALUES ('legacy','Private','other','reported','[]',datetime('now'),datetime('now'))")
    assert actors.get(BASE+'/', headers={'test-actor':'alice'}).json() == []
    assert actors.get(BASE+'/legacy', headers={'test-actor':'alice'}).status_code == 404
    assert actors.post(BASE+'/legacy/comments', headers={'test-actor':'alice'}, json={'content':'x'}).status_code == 404
    assert actors.get(BASE+'/legacy', headers={'test-actor':'admin'}).status_code == 200
    assert mock_d1.execute("SELECT shared FROM bug_reports WHERE id='legacy'").fetchone()[0] == 0


@pytest.mark.parametrize('path,method,payload', [('/', 'get', None), ('/', 'post', {'title':'x','category':'other'}),
    ('/anything','get',None), ('/anything/comments','post',{'content':'x'}),
    ('/attachments/file.png','get',None), ('/anything','patch',{'status':'resolved'})])
def test_anonymous_rejected(actors,path,method,payload):
    kwargs = {'json':payload} if payload is not None else {}
    assert getattr(actors,method)(BASE+path,**kwargs).status_code == 401


def test_comment_uses_verified_role_not_spoofed_name(actors):
    report = create(actors).json()
    response = actors.post(BASE+'/'+report['id']+'/comments', headers={'test-actor':'bob'}, json={'content':'Thanks', 'author':'Administrator'})
    assert response.status_code == 200
    assert response.json()['comments'][0]['author'] == 'Member'
    assert 'private-identity' not in response.text
    assert actors.post(BASE+'/'+report['id']+'/comments', headers={'test-actor':'bob'}, json={'content':'   '}).status_code == 422


@pytest.mark.parametrize('payload', [{'title':' '}, {'title':'x'*161}, {'description':'x'*10001}, {'attachment_keys':[{}]*4}])
def test_bounded_input(actors,payload):
    assert create(actors,**payload).status_code == 422


def test_private_upload_claim_and_logout_protection(actors, monkeypatch):
    presign = Mock()
    monkeypatch.setattr(r2,'presigned_url',presign)
    response = actors.post(BASE+'/upload', headers={'test-actor':'alice'}, files={'file':('shot.png',PNG,'image/png')})
    assert response.status_code == 200
    attachment = response.json()
    assert attachment['url'].startswith(BASE+'/attachments/')
    assert actors.get(attachment['url'], headers={'test-actor':'alice'}).content == PNG
    assert actors.get(attachment['url'], headers={'test-actor':'bob'}).status_code == 404
    assert create(actors, actor='bob', attachment_keys=[attachment]).status_code == 422
    forged = {**attachment, 'name':'forged.html', 'type':'text/html', 'url':'https://evil.invalid'}
    report = create(actors, attachment_keys=[forged]).json()
    assert report['attachments'][0]['name'] == 'shot.png'
    assert report['attachments'][0]['type'] == 'image/png'
    assert 'evil.invalid' not in str(report)
    assert create(actors,attachment_keys=[attachment]).status_code == 422
    image = actors.get(attachment['url'], headers={'test-actor':'bob'})
    assert image.status_code == 200
    assert image.headers['cache-control'] == 'no-store'
    assert image.headers['x-content-type-options'] == 'nosniff'
    assert image.headers['content-type'] == 'image/png'
    assert actors.get(attachment['url']).status_code == 401
    presign.assert_not_called()


@pytest.mark.parametrize('data,mime', [(b'<svg onload="alert(1)">','image/svg+xml'),(b'<script>x</script>','image/png'),(PNG,'text/html')])
def test_non_screenshot_upload_rejected(actors, monkeypatch,data,mime):
    upload = Mock()
    monkeypatch.setattr(r2,'upload',upload)
    response = actors.post(BASE+'/upload', headers={'test-actor':'alice'}, files={'file':('bad.png',data,mime)})
    assert response.status_code == 415
    upload.assert_not_called()


def test_storage_failure_is_not_false_success(actors, monkeypatch):
    async def fail(*args,**kwargs):
        raise HTTPException(503,'Credential storage unavailable')
    monkeypatch.setattr('app.db.d1.security_query',fail)
    assert actors.get(BASE+'/',headers={'test-actor':'alice'}).status_code == 503
    assert create(actors).status_code == 503


def test_migration_preserves_legacy_and_atomic_attachment_claim():
    conn = sqlite3.connect(':memory:')
    root = Path(__file__).parents[1]/'migrations'
    for name in ['002_bug_reports.sql','003_bug_reports_severity_comments.sql','039_shared_feedback.sql']:
        conn.executescript((root/name).read_text())
    conn.execute("INSERT INTO bug_reports (id,title,category,created_at,updated_at) VALUES ('old','private','other','now','now')")
    conn.execute("INSERT INTO bug_report_uploads (key,owner_id,name,content_type,created_at) VALUES ('key','alice','a.png','image/png','now')")
    sql = "INSERT INTO bug_reports (id,title,category,created_at,updated_at,shared,author_account_id,attachments,feedback_kind) VALUES (?, 'shared', 'other','now','now',1,?,?, 'suggestion')"
    attachments = json.dumps([{'key':'key'}])
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute(sql,['wrong','bob',attachments])
    assert conn.execute("SELECT report_id FROM bug_report_uploads").fetchone()[0] is None
    conn.execute(sql,['first','alice',attachments])
    assert conn.execute("SELECT report_id FROM bug_report_uploads").fetchone()[0] == 'first'
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute(sql,['second','alice',attachments])
    assert conn.execute("SELECT shared FROM bug_reports WHERE id='old'").fetchone()[0] == 0
    assert conn.execute("SELECT COUNT(*) FROM bug_reports WHERE id='second'").fetchone()[0] == 0
    conn.close()


@pytest.mark.parametrize('actor,expected', [('alice', 'minor'), ('admin', 'critical')])
def test_create_severity_is_controlled_by_server_role(actors, mock_d1, actor, expected):
    response = create(actors, actor=actor, severity='critical')
    assert response.status_code == 201
    assert response.json()['severity'] == expected
    stored = mock_d1.execute('SELECT severity FROM bug_reports WHERE id = ?', [response.json()['id']]).fetchone()
    assert stored[0] == expected

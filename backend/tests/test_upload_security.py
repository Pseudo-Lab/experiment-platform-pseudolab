"""Synthetic uploads only: fail closed before receive and never touch real R2."""
import asyncio
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.core.auth import create_session_token, hash_password
from app.core.config import settings
from app.core.upload import MAX_UPLOAD_BODY_BYTES
from app.db import r2
from app.main import app

PATH = '/api/v1/bug-reports/upload'


@pytest.fixture(autouse=True)
def storage(monkeypatch):
    upload = Mock(return_value=True)
    presign = Mock(return_value='https://storage.test/attachment')
    monkeypatch.setattr(r2, 'upload', upload)
    monkeypatch.setattr(r2, 'presigned_url', presign)
    return upload, presign


@pytest.fixture
def admin(monkeypatch):
    monkeypatch.setattr(settings, 'ADMIN_USERNAME', 'upload-admin')
    monkeypatch.setattr(settings, 'ADMIN_PASSWORD_HASH', hash_password('test', iterations=1000))
    monkeypatch.setattr(settings, 'AUTH_SESSION_SECRET', 'isolated-upload-test-secret')
    with TestClient(app) as client:
        client.cookies.set(settings.AUTH_COOKIE_NAME, create_session_token('upload-admin'))
        yield client


@pytest.mark.parametrize('configured,expected', [(True, 401), (False, 503)])
@pytest.mark.parametrize('content_type', ['multipart/form-data; boundary=test', 'application/x-www-form-urlencoded'])
def test_anonymous_rejected_before_receive_or_form(monkeypatch, storage, configured, expected, content_type):
    monkeypatch.setattr(settings, 'ADMIN_USERNAME', 'admin' if configured else None)
    monkeypatch.setattr(settings, 'ADMIN_PASSWORD_HASH', 'unused' if configured else None)
    monkeypatch.setattr(settings, 'AUTH_SESSION_SECRET', 'unused' if configured else None)
    async def run():
        received = 0
        messages = []
        async def receive():
            nonlocal received
            received += 1
            raise AssertionError('Anonymous body must not be consumed')
        async def send(message):
            messages.append(message)
        def form(*args, **kwargs):
            raise AssertionError('Anonymous form must not be parsed')
        monkeypatch.setattr(Request, 'form', form)
        scope = {'type': 'http', 'http_version': '1.1', 'method': 'POST', 'scheme': 'http',
                 'path': PATH, 'raw_path': PATH.encode(), 'query_string': b'', 'root_path': '',
                 'headers': [(b'host', b'testserver'), (b'content-type', content_type.encode())],
                 'server': ('testserver', 80), 'client': ('127.0.0.1', 1234)}
        await app(scope, receive, send)
        assert received == 0
        assert next(m['status'] for m in messages if m['type'] == 'http.response.start') == expected
    asyncio.run(run())
    for call in storage:
        call.assert_not_called()


def test_valid_upload_preserves_contract(admin, storage):
    response = admin.post(PATH, files={'file': ('test.png', b'test image', 'image/png')})
    assert response.status_code == 200
    data = response.json()
    assert data['name'] == 'test.png'
    assert data['type'] == 'image/png'
    assert data['url'] == 'https://storage.test/attachment'
    assert data['key'].startswith('bug-reports/') and data['key'].endswith('.png')
    storage[0].assert_called_once_with(data['key'], b'test image', 'image/png')
    assert response.headers['cache-control'] == 'no-store'


@pytest.mark.parametrize('case,expected', [
    ('missing', 422), ('empty', 422), ('malformed', 400), ('many_fields', 400),
    ('oversized_file', 413), ('oversized_part', 413), ('urlencoded', 422), ('many_urlencoded', 400),
])
def test_rejected_uploads_never_call_storage(admin, storage, case, expected):
    if case == 'missing':
        response = admin.post(PATH, files={'other': (None, 'value')})
    elif case == 'empty':
        response = admin.post(PATH, files={'file': ('empty.txt', b'', 'text/plain')})
    elif case == 'malformed':
        response = admin.post(PATH, content=b'invalid multipart', headers={'Content-Type': 'multipart/form-data'})
    elif case == 'many_fields':
        response = admin.post(PATH, files=[('file', ('ok.txt', b'ok', 'text/plain'))] + [(f'f{i}', (None, 'v')) for i in range(1001)])
    elif case == 'oversized_file':
        response = admin.post(PATH, files={'file': ('large.txt', b'x' * MAX_UPLOAD_BODY_BYTES, 'text/plain')})
    elif case == 'oversized_part':
        response = admin.post(PATH, files={'field': (None, 'x' * MAX_UPLOAD_BODY_BYTES)})
    elif case == 'urlencoded':
        response = admin.post(PATH, data={'file': 'not an uploaded file'})
    else:
        response = admin.post(PATH, data={f'f{i}': 'v' for i in range(1001)})
    assert response.status_code == expected, response.text
    for call in storage:
        call.assert_not_called()


def test_chunked_body_cannot_bypass_limit_and_is_not_parsed(admin, monkeypatch, storage):
    def form(*args, **kwargs):
        raise AssertionError('Oversized body must not be parsed')
    monkeypatch.setattr(Request, 'form', form)
    response = admin.post(PATH, content=iter([b'x' * 65536] * 17),
                          headers={'Content-Type': 'multipart/form-data; boundary=test'})
    assert response.status_code == 413
    for call in storage:
        call.assert_not_called()


def test_body_limit_includes_multipart_overhead(admin, storage):
    import httpx
    empty = httpx.Request('POST', 'http://testserver' + PATH, files={'file': ('t.txt', b'', 'text/plain')}).read()
    payload = b'x' * (MAX_UPLOAD_BODY_BYTES - len(empty))
    response = admin.post(PATH, files={'file': ('t.txt', payload, 'text/plain')})
    assert response.status_code == 200
    assert len(storage[0].call_args.args[1]) == len(payload)
    storage[0].reset_mock()
    storage[1].reset_mock()
    response = admin.post(PATH, files={'file': ('t.txt', payload + b'x', 'text/plain')})
    assert response.status_code == 413
    for call in storage:
        call.assert_not_called()


def test_storage_failure_preserves_error_and_does_not_presign(admin, storage):
    storage[0].return_value = False
    response = admin.post(PATH, files={'file': ('t.txt', b'ok', 'text/plain')})
    assert response.status_code == 500
    storage[1].assert_not_called()


def test_actual_asgi_chunks_are_counted_even_with_false_content_length(admin, monkeypatch, storage):
    def form(*args, **kwargs):
        raise AssertionError('Oversized stream must not reach form parsing')
    monkeypatch.setattr(Request, 'form', form)
    async def run():
        chunks_read = 0
        messages = []
        async def receive():
            nonlocal chunks_read
            chunks_read += 1
            assert chunks_read <= 17
            return {'type': 'http.request', 'body': b'x' * 65536, 'more_body': True}
        async def send(message):
            messages.append(message)
        cookie = f'{settings.AUTH_COOKIE_NAME}={create_session_token("upload-admin")}'
        scope = {'type': 'http', 'http_version': '1.1', 'method': 'POST', 'scheme': 'http',
                 'path': PATH, 'raw_path': PATH.encode(), 'query_string': b'', 'root_path': '',
                 'headers': [(b'host', b'testserver'), (b'cookie', cookie.encode()),
                             (b'content-length', b'1'), (b'content-type', b'multipart/form-data; boundary=test')],
                 'server': ('testserver', 80), 'client': ('127.0.0.1', 1234)}
        await app(scope, receive, send)
        assert chunks_read == 17
        assert next(m['status'] for m in messages if m['type'] == 'http.response.start') == 413
    asyncio.run(run())
    for call in storage:
        call.assert_not_called()

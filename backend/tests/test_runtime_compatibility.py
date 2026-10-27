"""Service contracts that must survive the FastAPI/Starlette/Pydantic upgrade."""
import asyncio
from tempfile import SpooledTemporaryFile

import pytest
from fastapi.testclient import TestClient
from starlette.datastructures import UploadFile
from starlette.exceptions import HTTPException
from starlette.requests import Request

from app.core.config import Settings
from app.main import app


def test_settings_parse_json_origins_and_cookie_types(monkeypatch):
    monkeypatch.setenv('BACKEND_CORS_ORIGINS', '["https://admin.test", "http://localhost:8081"]')
    monkeypatch.setenv('AUTH_COOKIE_SECURE', 'true')
    monkeypatch.setenv('AUTH_SESSION_TTL_SECONDS', '900')
    settings = Settings(_env_file=None)
    assert settings.BACKEND_CORS_ORIGINS == ['https://admin.test', 'http://localhost:8081']
    assert settings.AUTH_COOKIE_SECURE is True
    assert settings.AUTH_SESSION_TTL_SECONDS == 900


def test_openapi_upload_contract_and_json_validation():
    with TestClient(app) as client:
        response = client.get('/api/v1/openapi.json')
        assert response.status_code == 200
        schema = response.json()
        upload = schema['paths']['/api/v1/bug-reports/upload']['post']
        body_ref = upload['requestBody']['content']['multipart/form-data']['schema']['$ref'].split('/')[-1]
        body = schema['components']['schemas'][body_ref]
        assert body['required'] == ['file']
        assert body['properties']['file']['format'] == 'binary'
        invalid = client.post('/api/v1/projects/', json={'id': 'INVALID ID', 'name': ''})
        assert invalid.status_code == 422
        assert isinstance(invalid.json()['detail'], list)
        malformed = client.post('/api/v1/projects/', content=b'{bad', headers={'Content-Type': 'application/json'})
        assert malformed.status_code == 422
        assert malformed.json()['detail'][0]['type'] == 'json_invalid'
        report = client.post('/api/v1/bug-reports/', json={'title': 'test', 'category': 'ui'})
        assert report.status_code == 201
        data = report.json()
        assert data['category'] == 'ui' and data['status'] == 'reported'
        assert isinstance(data['created_at'], str) and 'T' in data['created_at']
        assert data['attachments'] == [] and data['comments'] == []
        preflight = client.options('/api/v1/bug-reports/upload', headers={
            'Origin': 'https://sdk.test', 'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type',
        })
        assert preflight.status_code == 200
        assert preflight.headers['access-control-allow-origin'] == 'https://sdk.test'


@pytest.mark.parametrize('encoding', ['urlencoded', 'multipart'])
@pytest.mark.parametrize('violation', ['fields', 'part_size'])
def test_patched_parsers_enforce_custom_limits(encoding, violation):
    if encoding == 'urlencoded':
        content_type = b'application/x-www-form-urlencoded'
        body = b'a=1&b=2&c=3' if violation == 'fields' else b'a=' + b'x' * 40
    else:
        content_type = b'multipart/form-data; boundary=test'
        pairs = [('a', '1'), ('b', '2'), ('c', '3')] if violation == 'fields' else [('a', 'x' * 40)]
        body = ''.join(f'--test\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n' for key, value in pairs).encode() + b'--test--\r\n'
    async def run():
        async def receive():
            return {'type': 'http.request', 'body': body, 'more_body': False}
        request = Request({'type': 'http', 'method': 'POST', 'path': '/', 'app': app,
                           'headers': [(b'content-type', content_type)]}, receive)
        with pytest.raises(HTTPException) as caught:
            async with request.form(max_fields=2, max_part_size=32):
                pass
        assert caught.value.status_code == 400
    asyncio.run(run())


def test_spool_rollover_runs_in_threadpool(monkeypatch):
    import starlette.datastructures as data
    calls = []
    original = data.run_in_threadpool
    async def tracked(function, *args, **kwargs):
        calls.append(function)
        return await original(function, *args, **kwargs)
    monkeypatch.setattr(data, 'run_in_threadpool', tracked)
    async def run():
        file = UploadFile(SpooledTemporaryFile(max_size=32), size=0)
        try:
            await file.write(b'x' * 64)
            assert calls, 'The write that rolls over must leave the event loop'
            await file.seek(0)
            assert await file.read() == b'x' * 64
        finally:
            await file.close()
    asyncio.run(run())

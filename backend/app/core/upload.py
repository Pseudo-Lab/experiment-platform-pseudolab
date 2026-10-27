"""Bound attachment request bytes before FastAPI invokes its form parser."""
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

MAX_UPLOAD_BODY_BYTES = 1024 * 1024


class UploadBodyLimitMiddleware:
    def __init__(self, app: ASGIApp, path: str):
        self.app = app
        self.path = path

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if (scope['type'] != 'http' or scope['method'] != 'POST'
                or scope['path'].rstrip('/') != self.path):
            await self.app(scope, receive, send)
            return

        # Do not trust Content-Length: count streamed/chunked bytes as well.
        body = bytearray()
        while True:
            message = await receive()
            if message['type'] == 'http.disconnect':
                return
            chunk = message.get('body', b'')
            if len(body) + len(chunk) > MAX_UPLOAD_BODY_BYTES:
                response = JSONResponse(status_code=413, content={'detail': 'Upload request exceeds 1 MiB'})
                await response(scope, receive, send)
                return
            body.extend(chunk)
            if not message.get('more_body', False):
                break

        # Replay the bounded body through ASGI, without private Request fields.
        consumed = False

        async def bounded_receive():
            nonlocal consumed
            if not consumed:
                consumed = True
                return {'type': 'http.request', 'body': bytes(body), 'more_body': False}
            return await receive()

        await self.app(scope, bounded_receive, send)

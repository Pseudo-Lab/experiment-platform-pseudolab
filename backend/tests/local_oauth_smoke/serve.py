"""Serve the production SPA locally without Vite's development /api prefix proxy."""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
ROOT = Path(__file__).resolve().parents[3] / 'frontend' / 'dist'
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, *args): pass
    def do_GET(self):
        if not Path(self.translate_path(self.path)).is_file(): self.path = '/index.html'
        super().do_GET()
ThreadingHTTPServer(('127.0.0.1',19003), Handler).serve_forever()

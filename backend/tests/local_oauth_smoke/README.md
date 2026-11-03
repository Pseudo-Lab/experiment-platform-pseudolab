Status: active

Local HTTPS/OIDC mock only. No Google, D1, R2, production keys or accounts are used.
Run from repository root with backend requirements installed and frontend/SDK built:

```sh
python backend/tests/local_oauth_smoke/prepare.py
PYTHONPATH=backend python backend/tests/local_oauth_smoke/boot.py
# In separate terminals:
python backend/tests/local_oauth_smoke/serve.py
python backend/tests/local_oauth_smoke/proxy.py
# With playwright-core and its Chromium installed:
node backend/tests/local_oauth_smoke/browser.cjs
```

`PLAYWRIGHT_MODULE` may point to an existing playwright-core installation;
`PLAYWRIGHT_BROWSERS_PATH` may point to its browser cache. All servers bind to
loopback: backend 19001, production SPA 19003, HTTPS 19043. Stop those processes
after verification. Restart boot.py between runs because its synthetic DB is in
memory. Results are written to `/tmp/oauth-security-smoke/browser-results.json`;
copy that sanitized JSON to the designated evidence directory. Do not copy the
transient synthetic credentials or TLS private key to evidence or Git.

The browser intercepts the outbound Google navigation and supplies a local
callback. Only the test boot module substitutes token/JWKS responses. Production
provider URLs remain fixed. Real Google consent/exchange and real D1 behavior
are not established by this test. This serves the production SPA directly because
Vite's existing development `/api` prefix proxy also matches the `/api-key` page.

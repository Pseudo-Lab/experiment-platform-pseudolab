"""Run from repository root; generate only synthetic DB and ephemeral TLS inputs."""
import ast
import json
import secrets
import subprocess
from pathlib import Path
root = Path('/tmp/oauth-security-smoke')
root.mkdir(exist_ok=True)
tree = ast.parse(Path('backend/tests/conftest.py').read_text())
schema = next(ast.literal_eval(n.value) for n in tree.body if isinstance(n, ast.Assign)
              and any(isinstance(t, ast.Name) and t.id == '_SCHEMA' for t in n.targets))
for name in ['034_public_accounts.sql', '035_project_experiment_events.sql',
             '036_project_server_credential.sql', '037_atomic_owned_projects_and_credentials.sql', '038_sdk_event_model.sql']:
    schema += '\n' + Path('backend/migrations', name).read_text()
(root / 'schema.sql').write_text(schema)
(root / 'synthetic.json').write_text(json.dumps({
    'username': 'local-admin', 'password': secrets.token_urlsafe(24), 'session': secrets.token_urlsafe(32)}))
(root / 'synthetic.json').chmod(0o600)
subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
                '-keyout', str(root / 'key.pem'), '-out', str(root / 'cert.pem'),
                '-days', '1', '-subj', '/CN=localhost'], check=True, capture_output=True)
(root / 'key.pem').chmod(0o600)

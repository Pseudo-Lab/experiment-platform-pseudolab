-- Independent of OAuth migrations 034/035. No legacy/public-key fallback.
CREATE TABLE IF NOT EXISTS project_server_credential (
    token_hash TEXT PRIMARY KEY CHECK(length(token_hash) = 64),
    project_id TEXT NOT NULL REFERENCES projects(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_server_credential_project
    ON project_server_credential(project_id);

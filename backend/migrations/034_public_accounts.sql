-- Additive, replay-safe. No existing project gets an owner automatically.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS platform_account (
    id TEXT PRIMARY KEY,
    google_sub TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS project_owner (
    project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES platform_account(id)
);
CREATE INDEX IF NOT EXISTS idx_project_owner_account ON project_owner(account_id);
CREATE TABLE IF NOT EXISTS platform_session (
    token_hash TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES platform_account(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_platform_session_expiry ON platform_session(expires_at);
CREATE TABLE IF NOT EXISTS revoked_admin_session (
    token_hash TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_attempt (
    state_hash TEXT PRIMARY KEY,
    browser_hash TEXT NOT NULL,
    nonce TEXT NOT NULL,
    verifier TEXT NOT NULL,
    expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oauth_attempt_expiry ON oauth_attempt(expires_at);
-- Public SDK credentials remain in projects.api_key; only hashes of new server keys persist.
CREATE TABLE IF NOT EXISTS project_server_key (
    project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
);

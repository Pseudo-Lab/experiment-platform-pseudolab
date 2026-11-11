-- Additive and replay-safe. Owners remain authoritative; no existing access changes.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS project_member (
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES platform_account(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
    PRIMARY KEY (project_id, account_id)
);
CREATE INDEX IF NOT EXISTS idx_project_member_account ON project_member(account_id);
CREATE VIEW IF NOT EXISTS project_access AS
    SELECT project_id, account_id, 'owner' AS role FROM project_owner
    UNION ALL
    SELECT m.project_id, m.account_id, m.role FROM project_member m
    WHERE NOT EXISTS (SELECT 1 FROM project_owner o WHERE o.project_id=m.project_id AND o.account_id=m.account_id);
CREATE TABLE IF NOT EXISTS project_invitation (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER,
    accepted_by TEXT REFERENCES platform_account(id),
    accepted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_project_invitation_project ON project_invitation(project_id);
-- A single statement consumes the invitation and creates membership atomically.
CREATE VIEW IF NOT EXISTS project_invitation_acceptance AS
    SELECT token_hash, accepted_by AS account_id FROM project_invitation WHERE 0;
CREATE TRIGGER IF NOT EXISTS accept_project_invitation
INSTEAD OF INSERT ON project_invitation_acceptance
BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM project_invitation WHERE token_hash=NEW.token_hash
        AND revoked_at IS NULL AND expires_at > unixepoch() AND accepted_by IS NULL
    ) THEN RAISE(ABORT, 'Invitation unavailable') END;
    INSERT OR IGNORE INTO project_member (project_id, account_id, role)
        SELECT project_id, NEW.account_id, role FROM project_invitation WHERE token_hash=NEW.token_hash
        AND NOT EXISTS (SELECT 1 FROM project_owner WHERE project_id=project_invitation.project_id AND account_id=NEW.account_id);
    UPDATE project_invitation SET accepted_by=NEW.account_id, accepted_at=unixepoch()
        WHERE token_hash=NEW.token_hash;
END;

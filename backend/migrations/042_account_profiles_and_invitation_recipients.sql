-- Additive and replay-safe. No profile or recipient is inferred for existing rows.
CREATE TABLE IF NOT EXISTS platform_account_profile (
    account_id TEXT PRIMARY KEY REFERENCES platform_account(id) ON DELETE CASCADE,
    display_name TEXT,
    email TEXT,
    email_authoritative INTEGER NOT NULL CHECK (email_authoritative IN (0, 1))
);
CREATE TABLE IF NOT EXISTS project_invitation_recipient (
    invitation_id TEXT PRIMARY KEY REFERENCES project_invitation(id) ON DELETE CASCADE,
    email TEXT NOT NULL
);

-- Create the invitation and its optional recipient in one statement transaction.
CREATE VIEW IF NOT EXISTS project_invitation_creation AS
    SELECT i.id, i.project_id, i.token_hash, i.role, i.expires_at, r.email
    FROM project_invitation i LEFT JOIN project_invitation_recipient r ON r.invitation_id=i.id;
CREATE TRIGGER IF NOT EXISTS create_project_invitation
INSTEAD OF INSERT ON project_invitation_creation
BEGIN
    INSERT INTO project_invitation (id, project_id, token_hash, role, expires_at)
        VALUES (NEW.id, NEW.project_id, NEW.token_hash, NEW.role, NEW.expires_at);
    INSERT INTO project_invitation_recipient (invitation_id, email)
        SELECT NEW.id, NEW.email WHERE NEW.email IS NOT NULL;
END;

-- Replace only the acceptance trigger. Keep existing links, membership and history.
DROP TRIGGER IF EXISTS accept_project_invitation;
CREATE TRIGGER accept_project_invitation
INSTEAD OF INSERT ON project_invitation_acceptance
BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM project_invitation WHERE token_hash=NEW.token_hash
        AND revoked_at IS NULL AND expires_at > unixepoch() AND accepted_by IS NULL
    ) THEN RAISE(ABORT, 'Invitation unavailable') END;
    SELECT CASE WHEN EXISTS (
        SELECT 1 FROM project_invitation i
        JOIN project_invitation_recipient r ON r.invitation_id=i.id
        WHERE i.token_hash=NEW.token_hash AND NOT EXISTS (
            SELECT 1 FROM platform_account_profile p WHERE p.account_id=NEW.account_id
            AND p.email_authoritative=1 AND lower(p.email)=lower(r.email)
        )
    ) THEN RAISE(ABORT, 'Invited Google account required') END;
    INSERT OR IGNORE INTO project_member (project_id, account_id, role)
        SELECT project_id, NEW.account_id, role FROM project_invitation WHERE token_hash=NEW.token_hash
        AND NOT EXISTS (SELECT 1 FROM project_owner WHERE project_id=project_invitation.project_id AND account_id=NEW.account_id);
    UPDATE project_invitation SET accepted_by=NEW.account_id, accepted_at=unixepoch()
        WHERE token_hash=NEW.token_hash;
END;

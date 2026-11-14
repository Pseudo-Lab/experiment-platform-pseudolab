-- Track invitation origin and explicit declines without changing legacy token APIs.
ALTER TABLE project_invitation ADD COLUMN declined_at INTEGER;
ALTER TABLE project_invitation ADD COLUMN invited_by TEXT REFERENCES platform_account(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS create_project_invitation;
DROP VIEW IF EXISTS project_invitation_creation;
CREATE VIEW project_invitation_creation AS
    SELECT i.id, i.project_id, i.token_hash, i.role, i.expires_at, r.email, i.invited_by
    FROM project_invitation i LEFT JOIN project_invitation_recipient r ON r.invitation_id=i.id;
CREATE TRIGGER create_project_invitation
INSTEAD OF INSERT ON project_invitation_creation
BEGIN
    INSERT INTO project_invitation (id, project_id, token_hash, role, expires_at, invited_by)
        VALUES (NEW.id, NEW.project_id, NEW.token_hash, NEW.role, NEW.expires_at, NEW.invited_by);
    INSERT INTO project_invitation_recipient (invitation_id, email)
        SELECT NEW.id, NEW.email WHERE NEW.email IS NOT NULL;
END;

DROP TRIGGER IF EXISTS accept_project_invitation;
CREATE TRIGGER accept_project_invitation
INSTEAD OF INSERT ON project_invitation_acceptance
BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM project_invitation WHERE token_hash=NEW.token_hash
        AND revoked_at IS NULL AND declined_at IS NULL AND expires_at > unixepoch() AND accepted_by IS NULL
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

-- Additive: no key conversion, project reassignment, or credential deletion.
-- Use single-statement trigger transactions through the existing D1 REST client.
CREATE VIEW IF NOT EXISTS owned_project_creation AS
SELECT p.id, p.name, p.api_key, p.base_url, p.project_type, o.account_id
FROM projects p JOIN project_owner o ON o.project_id = p.id;

CREATE TRIGGER IF NOT EXISTS create_owned_project
INSTEAD OF INSERT ON owned_project_creation
BEGIN
    SELECT CASE WHEN NEW.account_id IS NULL THEN RAISE(ABORT, 'Owner required') END;
    INSERT INTO projects (id, name, api_key, base_url, project_type)
    VALUES (NEW.id, NEW.name, NEW.api_key, NEW.base_url, NEW.project_type);
    INSERT INTO project_owner (project_id, account_id) VALUES (NEW.id, NEW.account_id);
END;

-- The INSERT and revocation form one statement transaction. Failed insertion
-- cannot revoke a working key; concurrent callers additionally use a CAS predicate.
CREATE TRIGGER IF NOT EXISTS rotate_project_server_credential
BEFORE INSERT ON project_server_credential
WHEN NEW.revoked_at IS NULL
BEGIN
    UPDATE project_server_credential SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE project_id = NEW.project_id AND revoked_at IS NULL;
END;

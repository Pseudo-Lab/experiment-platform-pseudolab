-- 017: PostHog-style Projects
-- Each project has an API key used by SDK clients.

CREATE TABLE IF NOT EXISTS projects (
    id         TEXT PRIMARY KEY,           -- slug (lvup, demo-app, pseudo-lab)
    name       TEXT NOT NULL,
    api_key    TEXT NOT NULL UNIQUE,       -- public SDK identifier
    created_at TEXT DEFAULT (datetime('now'))
);

ALTER TABLE experiments        ADD COLUMN project_id TEXT REFERENCES projects(id);
ALTER TABLE feature_flag       ADD COLUMN project_id TEXT REFERENCES projects(id);
ALTER TABLE event_log          ADD COLUMN project_id TEXT REFERENCES projects(id);
ALTER TABLE feature_flag_exposure ADD COLUMN project_id TEXT REFERENCES projects(id);

-- Seed the three known projects
INSERT INTO projects (id, name, api_key, created_at) VALUES
    ('lvup',       'LVUP',       ('pk_sdk_' || lower(hex(randomblob(32)))),      datetime('now')),
    ('demo-app',   'Demo App',   ('pk_sdk_' || lower(hex(randomblob(32)))),      datetime('now')),
    ('pseudo-lab', 'Pseudo Lab', ('pk_sdk_' || lower(hex(randomblob(32)))),    datetime('now'));

-- Backfill project_id from existing product column values
UPDATE experiments        SET project_id = product WHERE product IN ('lvup', 'demo-app', 'pseudo-lab');
UPDATE feature_flag       SET project_id = product WHERE product IN ('lvup', 'demo-app', 'pseudo-lab');

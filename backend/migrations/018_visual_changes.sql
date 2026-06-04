-- 018: Visual Editor changes
-- DOM mutations (selector/property/value) scoped to a project + variant.
-- The SDK fetches these in production; the dashboard editor previews them live.

CREATE TABLE IF NOT EXISTS visual_changes (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects(id),
    flag_key    TEXT,
    variant     TEXT NOT NULL,
    selector    TEXT NOT NULL,
    property    TEXT NOT NULL,
    value       TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_visual_changes_project_variant
    ON visual_changes (project_id, variant);

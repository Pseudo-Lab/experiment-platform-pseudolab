-- 022: Visual changes v2 — scoped to experiment + variation_key
-- Replaces the project-based schema (018) with experiment-based one.

DROP TABLE IF EXISTS visual_changes;

CREATE TABLE IF NOT EXISTS visual_changes (
    id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    experiment_id TEXT NOT NULL,
    variation_key TEXT NOT NULL,
    selector      TEXT NOT NULL,
    type          TEXT NOT NULL,
    value         TEXT NOT NULL,
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (experiment_id) REFERENCES experiments(id)
);

CREATE INDEX IF NOT EXISTS idx_visual_changes_experiment
    ON visual_changes (experiment_id, variation_key);

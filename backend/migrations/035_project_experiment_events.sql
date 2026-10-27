-- Owned SDK events never enter the legacy key-only event store. Replay-safe.
CREATE TABLE IF NOT EXISTS project_experiment_event (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 event_type TEXT NOT NULL, experiment_key TEXT NOT NULL, experiment_id TEXT,
 variant TEXT NOT NULL, url TEXT, user_id TEXT NOT NULL, properties TEXT,
 event_time TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_project_event_key ON project_experiment_event(project_id, experiment_key);
CREATE INDEX IF NOT EXISTS idx_project_event_experiment ON project_experiment_event(project_id, experiment_id);

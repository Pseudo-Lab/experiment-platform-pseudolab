-- Additive and replay-safe. Existing rows have unknown history: do not backfill.
-- Record database-observed times rather than mutable experiments.updated_at.
CREATE TABLE IF NOT EXISTS experiment_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    from_status TEXT CHECK (
        from_status IN ('draft', 'running', 'paused', 'completed', 'archived')
    ),
    to_status TEXT NOT NULL CHECK (
        to_status IN ('draft', 'running', 'paused', 'completed', 'archived')
    ),
    recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_experiment_status_history_experiment
    ON experiment_status_history(experiment_id, id);

CREATE TRIGGER IF NOT EXISTS record_sdk_experiment_creation
AFTER INSERT ON experiments
WHEN NEW.event_model = 'sdk_v1'
BEGIN
    INSERT INTO experiment_status_history (experiment_id, from_status, to_status)
        VALUES (NEW.id, NULL, NEW.status);
END;

CREATE TRIGGER IF NOT EXISTS record_sdk_experiment_status_change
AFTER UPDATE OF status ON experiments
WHEN NEW.event_model = 'sdk_v1' AND OLD.status <> NEW.status
BEGIN
    INSERT INTO experiment_status_history (experiment_id, from_status, to_status)
        VALUES (NEW.id, OLD.status, NEW.status);
END;

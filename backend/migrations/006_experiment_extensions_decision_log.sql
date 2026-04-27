-- experiments 테이블 확장
ALTER TABLE experiments ADD COLUMN expected_effect TEXT;
ALTER TABLE experiments ADD COLUMN primary_metric  TEXT;
ALTER TABLE experiments ADD COLUMN cohort_id       TEXT;
ALTER TABLE experiments ADD COLUMN reflection_start_date  TEXT;
ALTER TABLE experiments ADD COLUMN reflection_window_days INTEGER NOT NULL DEFAULT 7;

-- 의사결정 이력 (INSERT ONLY)
CREATE TABLE IF NOT EXISTS decision_log (
    id            TEXT PRIMARY KEY,
    experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    decision      TEXT NOT NULL CHECK (decision IN ('SHIP', 'HOLD', 'ROLLBACK')),
    reason        TEXT NOT NULL,
    decided_by    TEXT NOT NULL,
    decided_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_decision_log_experiment_id ON decision_log(experiment_id);

-- 학습 노트
CREATE TABLE IF NOT EXISTS learning_note (
    id            TEXT PRIMARY KEY,
    experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    content       TEXT NOT NULL,
    created_by    TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_learning_note_experiment_id ON learning_note(experiment_id);

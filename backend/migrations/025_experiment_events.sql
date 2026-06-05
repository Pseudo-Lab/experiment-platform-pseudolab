-- 실험별 impression / conversion 이벤트 수집
CREATE TABLE IF NOT EXISTS experiment_event (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type     TEXT    NOT NULL,            -- 'impression' | 'conversion'
    experiment_key TEXT,                        -- SDK decide() key (flag_key or placement_key)
    experiment_id  TEXT,                        -- experiment UUID (optional direct link)
    variant        TEXT    NOT NULL DEFAULT 'unknown',
    url            TEXT,
    user_id        TEXT    NOT NULL,
    properties     TEXT,                        -- JSON blob
    event_time     TEXT    NOT NULL,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_experiment_event_key    ON experiment_event(experiment_key);
CREATE INDEX IF NOT EXISTS idx_experiment_event_exp_id ON experiment_event(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_event_time   ON experiment_event(event_time);
CREATE INDEX IF NOT EXISTS idx_experiment_event_type   ON experiment_event(event_type);

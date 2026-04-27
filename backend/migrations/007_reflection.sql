-- 회고 가이드 응답 (1인 1실험 1회 제출)
CREATE TABLE IF NOT EXISTS reflection (
    id                 TEXT PRIMARY KEY,
    experiment_id      TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    user_id            TEXT NOT NULL,
    project_id         TEXT NOT NULL,
    project_type       TEXT NOT NULL CHECK (project_type IN ('research','implementation','presentation','document','opensource')),
    output_types       TEXT,
    response_good      TEXT,
    response_blocked   TEXT,
    response_goal      TEXT,
    final_output_type  TEXT,
    completed_at       TEXT NOT NULL,
    created_at         TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, experiment_id)
);
CREATE INDEX IF NOT EXISTS idx_reflection_experiment_id ON reflection(experiment_id);
CREATE INDEX IF NOT EXISTS idx_reflection_user_id       ON reflection(user_id);

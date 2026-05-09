-- Feature Flag exposure logging

CREATE TABLE IF NOT EXISTS feature_flag_exposure (
    id           TEXT PRIMARY KEY,
    flag_key     TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    variant      TEXT NOT NULL,
    reason       TEXT,
    evaluated_at TEXT NOT NULL,
    context_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_feature_flag_exposure_flag_user
    ON feature_flag_exposure(flag_key, user_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_exposure_flag_evaluated_at
    ON feature_flag_exposure(flag_key, evaluated_at);
CREATE INDEX IF NOT EXISTS idx_feature_flag_exposure_evaluated_at
    ON feature_flag_exposure(evaluated_at);

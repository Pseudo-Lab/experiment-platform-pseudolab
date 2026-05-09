-- Feature Flag Phase 1: reusable segments and targeting rules

CREATE TABLE IF NOT EXISTS feature_segment (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    source      TEXT NOT NULL DEFAULT 'manual',
    query_name  TEXT,
    rules_json  TEXT,
    enabled     INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feature_segment_source ON feature_segment(source);
CREATE INDEX IF NOT EXISTS idx_feature_segment_enabled ON feature_segment(enabled);
CREATE INDEX IF NOT EXISTS idx_feature_segment_created_at ON feature_segment(created_at);

CREATE TABLE IF NOT EXISTS feature_segment_member (
    segment_id   TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    reason       TEXT,
    refreshed_at TEXT NOT NULL,
    PRIMARY KEY (segment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feature_segment_member_user_id ON feature_segment_member(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_segment_member_refreshed_at ON feature_segment_member(refreshed_at);

CREATE TABLE IF NOT EXISTS feature_flag_rule (
    id          TEXT PRIMARY KEY,
    flag_key    TEXT NOT NULL,
    priority    INTEGER NOT NULL DEFAULT 100,
    segment_id  TEXT,
    rollout_pct INTEGER NOT NULL DEFAULT 100,
    variant     TEXT NOT NULL DEFAULT 'treatment',
    enabled     INTEGER NOT NULL DEFAULT 1,
    starts_at   TEXT,
    ends_at     TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feature_flag_rule_flag_priority ON feature_flag_rule(flag_key, enabled, priority);
CREATE INDEX IF NOT EXISTS idx_feature_flag_rule_segment_id ON feature_flag_rule(segment_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_rule_window ON feature_flag_rule(starts_at, ends_at);

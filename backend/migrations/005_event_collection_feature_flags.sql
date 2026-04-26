-- 이벤트 수집 원천 테이블
CREATE TABLE IF NOT EXISTS event_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   TEXT    NOT NULL,
    cohort_id TEXT,
    event_name TEXT   NOT NULL,
    properties TEXT,
    event_time TEXT   NOT NULL,
    created_at TEXT   NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_event_log_user_id    ON event_log(user_id);
CREATE INDEX IF NOT EXISTS idx_event_log_event_name ON event_log(event_name);
CREATE INDEX IF NOT EXISTS idx_event_log_event_time ON event_log(event_time);

-- 사용자 식별 정보
CREATE TABLE IF NOT EXISTS person (
    user_id     TEXT PRIMARY KEY,
    cohort_id   TEXT,
    cohort_name TEXT,
    team_name   TEXT,
    role        TEXT,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Feature Flag 정의
CREATE TABLE IF NOT EXISTS feature_flag (
    flag_key    TEXT PRIMARY KEY,
    description TEXT,
    rollout_pct INTEGER NOT NULL DEFAULT 0,
    enabled     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 코호트 관리
CREATE TABLE IF NOT EXISTS cohort (
    id                 TEXT PRIMARY KEY,
    name               TEXT    NOT NULL,
    season_number      INTEGER NOT NULL,
    supabase_cohort_id TEXT,
    created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

"""
테스트용 in-memory SQLite로 Cloudflare D1을 대체한다.
D1은 SQLite 기반이라 동일한 SQL 문법이 그대로 동작한다.
"""
import sqlite3
import pytest

# 마이그레이션 001~003을 합친 스키마 (ALTER TABLE → 컬럼을 처음부터 포함)
_SCHEMA = """
CREATE TABLE IF NOT EXISTS experiments (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    hypothesis  TEXT,
    expected_effect TEXT,
    primary_metric  TEXT,
    completion_event TEXT,
    experiment_type TEXT NOT NULL DEFAULT 'ab_test',
    cohort_id       TEXT,
    flag_key    TEXT,
    variant_names_json TEXT,
    status      TEXT NOT NULL DEFAULT 'draft',
    owner_id    TEXT,
    start_at    TEXT,
    end_at      TEXT,
    reflection_start_date  TEXT,
    reflection_window_days INTEGER NOT NULL DEFAULT 7,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS experiment_assignments (
    experiment_id   TEXT NOT NULL,
    variant_name    TEXT NOT NULL,
    user_id         TEXT NOT NULL,
    assigned_at     TEXT NOT NULL,
    PRIMARY KEY (experiment_id, user_id)
);

CREATE TABLE IF NOT EXISTS bug_reports (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    category    TEXT NOT NULL,
    description TEXT,
    status      TEXT NOT NULL DEFAULT 'reported',
    attachments TEXT NOT NULL DEFAULT '[]',
    severity    TEXT NOT NULL DEFAULT 'minor',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bug_report_comments (
    id          TEXT PRIMARY KEY,
    report_id   TEXT NOT NULL,
    author      TEXT,
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feature_flag (
    flag_key    TEXT PRIMARY KEY,
    description TEXT,
    rollout_pct INTEGER NOT NULL DEFAULT 0,
    enabled     INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT,
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
);

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

CREATE TABLE IF NOT EXISTS feature_segment_member (
    segment_id   TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    reason       TEXT,
    refreshed_at TEXT NOT NULL,
    PRIMARY KEY (segment_id, user_id)
);

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

CREATE TABLE IF NOT EXISTS feature_flag_exposure (
    id           TEXT PRIMARY KEY,
    flag_key     TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    variant      TEXT NOT NULL,
    reason       TEXT,
    evaluated_at TEXT NOT NULL,
    context_json TEXT
);

CREATE TABLE IF NOT EXISTS event_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   TEXT    NOT NULL,
    cohort_id TEXT,
    event_name TEXT   NOT NULL,
    properties TEXT,
    event_time TEXT   NOT NULL,
    created_at TEXT   NOT NULL
);

CREATE TABLE IF NOT EXISTS person (
    user_id     TEXT PRIMARY KEY,
    cohort_id   TEXT,
    cohort_name TEXT,
    team_name   TEXT,
    role        TEXT,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reflection (
    id                 TEXT PRIMARY KEY,
    experiment_id      TEXT NOT NULL,
    user_id            TEXT NOT NULL,
    project_id         TEXT NOT NULL,
    project_type       TEXT NOT NULL,
    output_types       TEXT,
    response_good      TEXT,
    response_blocked   TEXT,
    response_goal      TEXT,
    final_output_type  TEXT,
    completed_at       TEXT NOT NULL,
    created_at         TEXT NOT NULL,
    UNIQUE(user_id, experiment_id)
);

CREATE TABLE IF NOT EXISTS experiment_placement_config (
    experiment_id  TEXT NOT NULL,
    placement_key  TEXT NOT NULL,
    ui_id          TEXT NOT NULL,
    ui_type        TEXT NOT NULL DEFAULT 'banner',
    title          TEXT NOT NULL,
    description    TEXT NOT NULL,
    target_url     TEXT NOT NULL,
    source         TEXT NOT NULL DEFAULT 'unknown',
    target_cohort  TEXT NOT NULL DEFAULT '*',
    allowed_roles  TEXT NOT NULL DEFAULT '[]',
    enabled        INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL,
    PRIMARY KEY (experiment_id, placement_key)
);

"""


@pytest.fixture(autouse=True)
def mock_d1(monkeypatch):
    """테스트마다 빈 in-memory SQLite DB를 생성하고 d1 모듈을 교체한다."""
    monkeypatch.setenv("D1_MAIN_DATABASE_ID", "test-main")
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(_SCHEMA)
    conn.commit()

    async def _query(sql: str, params=None, database_id=None):
        cursor = conn.execute(sql, params or [])
        return [dict(row) for row in cursor.fetchall()]

    async def _execute(sql: str, params=None, database_id=None):
        conn.execute(sql, params or [])
        conn.commit()
        return True

    monkeypatch.setattr("app.db.d1.query", _query)
    monkeypatch.setattr("app.db.d1.execute", _execute)

    yield conn
    conn.close()


@pytest.fixture(autouse=True)
def mock_r2(monkeypatch):
    """테스트 시 실제 R2 스토리지를 사용하지 않고 Mocking한다."""
    def _upload(key, data, content_type):
        return True

    def _presigned_url(key, expires_in=3600):
        return f"https://mock-r2.com/{key}?expires={expires_in}"

    def _delete(key):
        return True

    monkeypatch.setattr("app.db.r2.upload", _upload)
    monkeypatch.setattr("app.db.r2.presigned_url", _presigned_url)
    monkeypatch.setattr("app.db.r2.delete", _delete)

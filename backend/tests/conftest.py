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
    status      TEXT NOT NULL DEFAULT 'draft',
    owner_id    TEXT,
    start_at    TEXT,
    end_at      TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS experiment_variants (
    id              TEXT PRIMARY KEY,
    experiment_id   TEXT NOT NULL,
    name            TEXT NOT NULL,
    traffic_ratio   REAL NOT NULL,
    description     TEXT,
    created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS experiment_assignments (
    experiment_id   TEXT NOT NULL,
    variant_id      TEXT NOT NULL,
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
"""


@pytest.fixture(autouse=True)
def mock_d1(monkeypatch):
    """테스트마다 빈 in-memory SQLite DB를 생성하고 d1 모듈을 교체한다."""
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(_SCHEMA)
    conn.commit()

    def _query(sql: str, params=None):
        cursor = conn.execute(sql, params or [])
        return [dict(row) for row in cursor.fetchall()]

    def _execute(sql: str, params=None):
        conn.execute(sql, params or [])
        conn.commit()
        return True

    monkeypatch.setattr("app.db.d1.query", _query)
    monkeypatch.setattr("app.db.d1.execute", _execute)

    yield conn
    conn.close()

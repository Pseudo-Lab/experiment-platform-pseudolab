"""SDK lifecycle evidence only; no conversion-window or collection policy."""
from datetime import datetime, timezone
from pathlib import Path
import sqlite3

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
BASE = "/api/v1/experiments"
MIGRATION = (
    Path(__file__).parents[1] / "migrations/041_experiment_status_history.sql"
).read_text()


@pytest.fixture
def sdk_experiment():
    assert client.post("/api/v1/feature-flags/", json={
        "flag_key": "history-flag", "enabled": True,
    }).status_code == 201
    response = client.post(BASE + "/", json={
        "id": "history-sdk", "name": "History",
        "flag_key": "history-flag", "event_model": "sdk_v1",
        "primary_metric": "purchase",
    })
    assert response.status_code == 201
    return response.json()


def test_records_sdk_creation_but_not_legacy(mock_d1, sdk_experiment):
    assert client.post(BASE + "/", json={
        "id": "history-legacy", "name": "Legacy",
    }).status_code == 201
    rows = mock_d1.execute(
        "SELECT experiment_id, from_status, to_status FROM experiment_status_history"
    ).fetchall()
    assert [tuple(row) for row in rows] == [("history-sdk", None, "draft")]


def test_preserves_every_pause_resume_interval(mock_d1, sdk_experiment):
    states = ["running", "paused", "running", "paused", "running", "completed"]
    previous = "draft"
    expected = [(None, "draft")]
    for status in states:
        mock_d1.execute(
            "UPDATE experiments SET status=?, updated_at='2000-01-01' WHERE id=?",
            [status, sdk_experiment["id"]],
        )
        expected.append((previous, status))
        previous = status
    mock_d1.commit()

    rows = mock_d1.execute(
        "SELECT from_status, to_status, recorded_at FROM experiment_status_history "
        "WHERE experiment_id=? ORDER BY id", [sdk_experiment["id"]],
    ).fetchall()
    assert [(r["from_status"], r["to_status"]) for r in rows] == expected
    for row in rows:
        recorded = datetime.fromisoformat(row["recorded_at"])
        assert recorded.utcoffset() == timezone.utc.utcoffset(recorded)
        assert recorded.year != 2000


def test_name_edits_and_status_retries_do_not_add_history(mock_d1, sdk_experiment):
    first = [
        dict(row) for row in mock_d1.execute(
            "SELECT * FROM experiment_status_history ORDER BY id"
        )
    ]
    assert client.patch(BASE + "/history-sdk", json={"name": "New name"}).status_code == 200
    mock_d1.execute(
        "UPDATE experiments SET status=status, updated_at='2000-01-01' WHERE id=?",
        [sdk_experiment["id"]],
    )
    mock_d1.commit()
    assert [
        dict(row) for row in mock_d1.execute(
            "SELECT * FROM experiment_status_history ORDER BY id"
        )
    ] == first


def test_adopt_winner_records_completion_once(mock_d1, sdk_experiment):
    # The shared test schema omits this existing migration 028 column.
    mock_d1.execute("ALTER TABLE feature_flag ADD COLUMN forced_variant TEXT")
    mock_d1.execute(
        "UPDATE experiments SET status='running' WHERE id=?", [sdk_experiment["id"]]
    )
    mock_d1.commit()
    for _ in range(2):
        response = client.post(
            BASE + "/history-sdk/adopt-winner", json={"variant": "treatment"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "completed"
    rows = mock_d1.execute(
        "SELECT from_status, to_status FROM experiment_status_history "
        "WHERE experiment_id=? ORDER BY id", [sdk_experiment["id"]],
    ).fetchall()
    assert [tuple(row) for row in rows] == [
        (None, "draft"), ("draft", "running"), ("running", "completed"),
    ]


def test_state_and_history_roll_back_together(mock_d1, sdk_experiment):
    mock_d1.execute("BEGIN")
    mock_d1.execute(
        "UPDATE experiments SET status='running' WHERE id=?", [sdk_experiment["id"]]
    )
    assert mock_d1.execute("SELECT count(*) FROM experiment_status_history").fetchone()[0] == 2
    mock_d1.rollback()
    assert mock_d1.execute(
        "SELECT status FROM experiments WHERE id=?", [sdk_experiment["id"]]
    ).fetchone()[0] == "draft"
    assert mock_d1.execute("SELECT count(*) FROM experiment_status_history").fetchone()[0] == 1


def test_history_failure_aborts_state_write(mock_d1, sdk_experiment):
    mock_d1.executescript("""
        CREATE TRIGGER reject_history BEFORE INSERT ON experiment_status_history
        BEGIN SELECT RAISE(ABORT, 'synthetic history failure'); END;
    """)
    with pytest.raises(sqlite3.IntegrityError, match="synthetic history failure"):
        mock_d1.execute(
            "UPDATE experiments SET status='running' WHERE id=?", [sdk_experiment["id"]]
        )
    assert mock_d1.execute(
        "SELECT status FROM experiments WHERE id=?", [sdk_experiment["id"]]
    ).fetchone()[0] == "draft"
    assert mock_d1.execute("SELECT count(*) FROM experiment_status_history").fetchone()[0] == 1


def test_deleting_experiment_removes_its_history(mock_d1, sdk_experiment):
    assert mock_d1.execute("PRAGMA foreign_keys").fetchone()[0] == 1
    assert client.delete(BASE + "/history-sdk").status_code == 204
    assert mock_d1.execute("SELECT count(*) FROM experiment_status_history").fetchone()[0] == 0


def test_migration_is_replay_safe_and_does_not_invent_existing_history():
    with sqlite3.connect(":memory:") as db:
        db.executescript("""
            PRAGMA foreign_keys=ON;
            CREATE TABLE experiments (
                id TEXT PRIMARY KEY, event_model TEXT NOT NULL, status TEXT NOT NULL
            );
            INSERT INTO experiments VALUES ('old-sdk', 'sdk_v1', 'running');
            INSERT INTO experiments VALUES ('old-legacy', 'legacy', 'draft');
        """)
        before = db.execute("SELECT * FROM experiments ORDER BY id").fetchall()
        db.executescript(MIGRATION)
        db.executescript(MIGRATION)
        assert db.execute("SELECT * FROM experiments ORDER BY id").fetchall() == before
        assert db.execute("SELECT count(*) FROM experiment_status_history").fetchone()[0] == 0
        db.execute("UPDATE experiments SET status='paused' WHERE id='old-sdk'")
        assert db.execute(
            "SELECT from_status, to_status FROM experiment_status_history"
        ).fetchall() == [("running", "paused")]
        db.execute("INSERT INTO experiments VALUES ('new-sdk', 'sdk_v1', 'draft')")
        assert db.execute(
            "SELECT count(*) FROM experiment_status_history WHERE experiment_id='new-sdk'"
        ).fetchone()[0] == 1

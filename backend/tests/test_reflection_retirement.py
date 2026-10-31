from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)
RETIRED_ID = "s12-mid-reflection"
NOW = "2026-07-01T00:00:00+00:00"


def test_retired_reflection_rejects_submission_without_database_access(monkeypatch):
    async def unexpected_access(*args, **kwargs):
        raise AssertionError("Retired submissions must not access the database")

    monkeypatch.setattr("app.db.d1.query", unexpected_access)
    monkeypatch.setattr("app.db.d1.execute", unexpected_access)
    response = client.post("/api/v1/reflections/", json={
        "experiment_id": RETIRED_ID,
        "user_id": "new-user",
        "project_id": "project-1",
        "project_type": "research",
    })

    assert response.status_code == 410


def test_retired_reflection_history_and_logs_remain_readable_and_unchanged(mock_d1):
    mock_d1.execute(
        """INSERT INTO reflection
           (id, experiment_id, user_id, project_id, project_type,
            response_good, completed_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        ["existing", RETIRED_ID, "existing-user", "project-1", "research",
         "Historical response", NOW, NOW],
    )
    mock_d1.execute(
        "INSERT INTO event_log (user_id, event_name, properties, event_time, created_at) VALUES (?, ?, ?, ?, ?)",
        ["existing-user", "project_reflection_submitted", '{"experiment_id":"s12-mid-reflection"}', NOW, NOW],
    )
    mock_d1.commit()
    before = {table: mock_d1.execute(f"SELECT * FROM {table}").fetchall()
              for table in ("reflection", "event_log")}

    response = client.post("/api/v1/reflections/", json={
        "experiment_id": RETIRED_ID, "user_id": "existing-user",
        "project_id": "project-1", "project_type": "research",
        "response_good": "Must not replace history",
    })
    assert response.status_code == 410
    check = client.get("/api/v1/reflections/check", params={
        "experiment_id": RETIRED_ID, "user_id": "existing-user",
    })
    assert check.status_code == 200
    assert check.json() == {"submitted": True, "completed_at": "2026-07-01T00:00:00Z"}
    summary = client.get("/api/v1/reflections/summary", params={"experiment_id": RETIRED_ID})
    assert summary.status_code == 200
    assert summary.json()["total_completed"] == 1
    for table, rows in before.items():
        assert mock_d1.execute(f"SELECT * FROM {table}").fetchall() == rows


def test_other_reflections_still_accept_submissions_and_record_completion(mock_d1):
    mock_d1.execute(
        """INSERT INTO experiments
           (id, name, status, completion_event, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        ["another-reflection", "Another reflection", "running", "reflection_completed", NOW, NOW],
    )
    mock_d1.commit()
    response = client.post("/api/v1/reflections/", json={
        "experiment_id": "another-reflection", "user_id": "new-user",
        "project_id": "project-1", "project_type": "research",
    })
    assert response.status_code == 201
    assert response.json()["experiment_id"] == "another-reflection"
    assert mock_d1.execute("SELECT COUNT(*) FROM reflection").fetchone()[0] == 1
    assert mock_d1.execute("SELECT event_name FROM event_log").fetchone()[0] == "reflection_completed"

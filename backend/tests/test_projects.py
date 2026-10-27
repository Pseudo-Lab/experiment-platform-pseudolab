import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def _seed_project(id_: str, name: str, api_key: str, mock_d1):
    mock_d1.execute(
        "INSERT INTO projects (id, name, api_key) VALUES (?, ?, ?)",
        (id_, name, api_key),
    )
    mock_d1.commit()


class TestProjectsCRUD:
    def test_list_empty(self, mock_d1):
        res = client.get("/api/v1/projects/")
        assert res.status_code == 200
        assert res.json() == []

    def test_create_project(self, mock_d1):
        res = client.post("/api/v1/projects/", json={"id": "my-project", "name": "My Project"})
        assert res.status_code == 201
        body = res.json()
        assert body["id"] == "my-project"
        assert body["name"] == "My Project"
        assert "api_key" not in body

    def test_create_duplicate_returns_409(self, mock_d1):
        client.post("/api/v1/projects/", json={"id": "dup", "name": "Dup"})
        res = client.post("/api/v1/projects/", json={"id": "dup", "name": "Dup Again"})
        assert res.status_code == 409

    def test_list_returns_created_project(self, mock_d1):
        client.post("/api/v1/projects/", json={"id": "proj-a", "name": "Proj A"})
        res = client.get("/api/v1/projects/")
        assert res.status_code == 200
        ids = [p["id"] for p in res.json()]
        assert "proj-a" in ids

    def test_get_project(self, mock_d1):
        _seed_project("lvup", "LVUP", "pk_live_lvup_test", mock_d1)
        res = client.get("/api/v1/projects/lvup")
        assert res.status_code == 200
        assert res.json()["id"] == "lvup"
        assert "api_key" not in res.json()

    def test_get_unknown_returns_404(self, mock_d1):
        res = client.get("/api/v1/projects/no-such-project")
        assert res.status_code == 404


class TestSdkStatus:
    def test_unknown_project_returns_404(self, mock_d1):
        res = client.get("/api/v1/projects/no-such/sdk-status")
        assert res.status_code == 404

    def test_not_connected_when_no_data(self, mock_d1):
        _seed_project("quiet", "Quiet", "pk_live_quiet", mock_d1)
        res = client.get("/api/v1/projects/quiet/sdk-status")
        assert res.status_code == 200
        assert res.json()["status"] == "not_connected"

    def test_connected_when_recent_event(self, mock_d1):
        _seed_project("live-evt", "Live Evt", "pk_live_evt", mock_d1)
        now = datetime.now(timezone.utc).isoformat()
        mock_d1.execute(
            "INSERT INTO event_log (user_id, event_name, event_time, created_at, project_id)"
            " VALUES ('u1', 'click', ?, ?, 'live-evt')",
            (now, now),
        )
        mock_d1.commit()
        res = client.get("/api/v1/projects/live-evt/sdk-status")
        assert res.json()["status"] == "connected"

    def test_connected_when_recent_exposure(self, mock_d1):
        _seed_project("live-exp", "Live Exp", "pk_live_exp_sdk", mock_d1)
        now = datetime.now(timezone.utc).isoformat()
        mock_d1.execute(
            "INSERT INTO feature_flag_exposure (id, flag_key, user_id, variant, evaluated_at, project_id)"
            " VALUES ('e1', 'f1', 'u1', 'control', ?, 'live-exp')",
            (now,),
        )
        mock_d1.commit()
        res = client.get("/api/v1/projects/live-exp/sdk-status")
        assert res.json()["status"] == "connected"

    def test_not_connected_when_event_too_old(self, mock_d1):
        _seed_project("stale", "Stale", "pk_live_stale", mock_d1)
        old = (datetime.now(timezone.utc) - timedelta(days=45)).isoformat()
        mock_d1.execute(
            "INSERT INTO event_log (user_id, event_name, event_time, created_at, project_id)"
            " VALUES ('u1', 'click', ?, ?, 'stale')",
            (old, old),
        )
        mock_d1.commit()
        res = client.get("/api/v1/projects/stale/sdk-status")
        assert res.json()["status"] == "not_connected"


class TestProjectsDelete:
    def test_delete_unreferenced_project(self, mock_d1):
        mock_d1.execute("PRAGMA foreign_keys = ON")
        _seed_project("to-delete", "To Delete", "pk_live_todelete", mock_d1)
        res = client.delete("/api/v1/projects/to-delete")
        assert res.status_code == 204
        assert client.get("/api/v1/projects/to-delete").status_code == 404

    def test_delete_unknown_returns_404(self, mock_d1):
        res = client.delete("/api/v1/projects/no-such")
        assert res.status_code == 404

    def test_delete_fails_409_when_experiment_references_it(self, mock_d1):
        _seed_project("locked-exp", "Locked Exp", "pk_live_locked_exp", mock_d1)
        mock_d1.execute(
            "INSERT INTO experiments (id, name, created_at, updated_at, project_id)"
            " VALUES ('exp-1', 'Exp 1', '2024-01-01', '2024-01-01', 'locked-exp')"
        )
        mock_d1.commit()
        res = client.delete("/api/v1/projects/locked-exp")
        assert res.status_code == 409
        assert "experiments" in res.json()["detail"]

    def test_delete_fails_409_when_flag_references_it(self, mock_d1):
        _seed_project("locked-flag", "Locked Flag", "pk_live_locked_flag", mock_d1)
        mock_d1.execute(
            "INSERT INTO feature_flag (flag_key, created_at, updated_at, project_id)"
            " VALUES ('my-flag', '2024-01-01', '2024-01-01', 'locked-flag')"
        )
        mock_d1.commit()
        res = client.delete("/api/v1/projects/locked-flag")
        assert res.status_code == 409
        assert "feature flags" in res.json()["detail"]


class TestDecideWithApiKey:
    def _setup(self, mock_d1):
        _seed_project("lvup", "LVUP", "pk_live_lvup_test", mock_d1)
        mock_d1.execute(
            "INSERT INTO feature_flag (flag_key, rollout_pct, enabled, product, project_id, created_at, updated_at)"
            " VALUES ('test-flag', 100, 1, 'lvup', 'lvup', '2024-01-01', '2024-01-01')"
        )
        mock_d1.commit()

    def test_decide_without_api_key_works(self, mock_d1):
        self._setup(mock_d1)
        res = client.get("/api/v1/feature-flags/decide?flag_key=test-flag&user_id=user1")
        assert res.status_code == 200
        assert res.json()["data"]["variant"] in ("treatment", "control")

    def test_decide_with_valid_api_key_works(self, mock_d1):
        self._setup(mock_d1)
        res = client.get(
            "/api/v1/feature-flags/decide?flag_key=test-flag&user_id=user1",
            headers={"x-api-key": "pk_live_lvup_test"},
        )
        assert res.status_code == 200
        assert res.json()["data"]["variant"] in ("treatment", "control")

    def test_decide_with_invalid_api_key_returns_401(self, mock_d1):
        self._setup(mock_d1)
        res = client.get(
            "/api/v1/feature-flags/decide?flag_key=test-flag&user_id=user1",
            headers={"x-api-key": "pk_live_invalid_key"},
        )
        assert res.status_code == 401


class TestCaptureWithApiKey:
    def _setup(self, mock_d1):
        _seed_project("demo-app", "Demo App", "pk_live_demo_test", mock_d1)

    def test_capture_without_api_key(self, mock_d1):
        res = client.post(
            "/api/v1/capture",
            json={"user_id": "u1", "event_name": "click"},
        )
        assert res.status_code == 202
        rows = mock_d1.execute("SELECT project_id FROM event_log WHERE user_id='u1'").fetchall()
        assert rows[0]["project_id"] is None

    def test_capture_with_valid_api_key_tags_project(self, mock_d1):
        self._setup(mock_d1)
        res = client.post(
            "/api/v1/capture",
            json={"user_id": "u2", "event_name": "click"},
            headers={"x-api-key": "pk_live_demo_test"},
        )
        assert res.status_code == 202
        rows = mock_d1.execute("SELECT project_id FROM event_log WHERE user_id='u2'").fetchall()
        assert rows[0]["project_id"] == "demo-app"

    def test_capture_with_invalid_api_key_returns_401(self, mock_d1):
        self._setup(mock_d1)
        res = client.post(
            "/api/v1/capture",
            json={"user_id": "u3", "event_name": "click"},
            headers={"x-api-key": "pk_live_bad_key"},
        )
        assert res.status_code == 401


@pytest.mark.parametrize("revoked", [False, True])
def test_delete_with_server_credential_returns_409(mock_d1, revoked):
    mock_d1.execute("PRAGMA foreign_keys = ON")
    assert mock_d1.execute("PRAGMA foreign_keys").fetchone()[0] == 1
    _seed_project("credential-owner", "Owner", "pk_sdk_fixture_owner", mock_d1)
    mock_d1.execute(
        "INSERT INTO project_server_credential(token_hash, project_id, revoked_at) VALUES (?, ?, ?)",
        ("a" * 64, "credential-owner", "2026-01-01" if revoked else None),
    )
    mock_d1.commit()
    res = client.delete("/api/v1/projects/credential-owner")
    assert res.status_code == 409
    assert "server credentials" in res.json()["detail"]
    assert mock_d1.execute("SELECT COUNT(*) FROM projects").fetchone()[0] == 1
    assert mock_d1.execute("SELECT COUNT(*) FROM project_server_credential").fetchone()[0] == 1


@pytest.mark.parametrize("mode", ["provider", "result", "transport", "missing", "zero_rows", "racing_fk"])
def test_delete_storage_failure_never_reports_204(mock_d1, monkeypatch, mode):
    import importlib.util
    import sqlite3
    from pathlib import Path
    from unittest.mock import AsyncMock, Mock
    from app.db import d1

    mock_d1.execute("PRAGMA foreign_keys = ON")
    _seed_project("failure", "Failure", "pk_sdk_fixture_failure", mock_d1)
    # Exercise the real fail-closed driver for the final write, with no network.
    spec = importlib.util.spec_from_file_location("delete_d1", Path(d1.__file__))
    driver = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(driver)
    monkeypatch.setattr(driver, "_get_endpoint", lambda: None if mode == "missing" else ("https://fixture.invalid", "fixture"))
    payload = {"success": mode != "provider", "result": [{"success": mode != "result", "results": []}]}
    transport = AsyncMock()
    transport.post = AsyncMock(return_value=Mock(raise_for_status=Mock(), json=Mock(return_value=payload)))
    if mode == "transport":
        transport.post.side_effect = RuntimeError("fixture provider failure")
    monkeypatch.setattr(driver, "get_client", AsyncMock(return_value=transport))
    query = d1.security_query

    async def final_write(sql, params=None):
        if not sql.startswith("DELETE"):
            return await query(sql, params)
        if mode == "racing_fk":
            mock_d1.execute("INSERT INTO project_server_credential(token_hash,project_id) VALUES (?, 'failure')", ("b" * 64,))
            mock_d1.commit()
            with pytest.raises(sqlite3.IntegrityError):
                mock_d1.execute(sql, params)
            # D1 wraps the FK failure as a failed result.
            payload["result"][0]["success"] = False
        return await driver.security_query(sql, params)

    monkeypatch.setattr(d1, "security_query", final_write)
    res = client.delete("/api/v1/projects/failure")
    assert res.status_code == (409 if mode == "zero_rows" else 503)
    assert mock_d1.execute("SELECT COUNT(*) FROM projects").fetchone()[0] == 1


def test_delete_preflight_storage_failure_is_503(mock_d1, monkeypatch):
    from unittest.mock import AsyncMock
    from fastapi import HTTPException
    from app.db import d1
    monkeypatch.setattr(d1, "security_query", AsyncMock(side_effect=HTTPException(503, "Credential storage unavailable")))
    assert client.delete("/api/v1/projects/any").status_code == 503

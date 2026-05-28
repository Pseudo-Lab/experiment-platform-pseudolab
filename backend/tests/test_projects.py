import pytest
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
        assert body["api_key"].startswith("pk_live_my-project_")

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
        assert res.json()["api_key"] == "pk_live_lvup_test"

    def test_get_unknown_returns_404(self, mock_d1):
        res = client.get("/api/v1/projects/no-such-project")
        assert res.status_code == 404


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

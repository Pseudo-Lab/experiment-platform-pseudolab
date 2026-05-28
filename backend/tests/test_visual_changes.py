from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def _seed_project(mock_d1, id_="demo-app", name="Demo", api_key="pk_live_demo_vc"):
    mock_d1.execute("INSERT INTO projects (id, name, api_key) VALUES (?, ?, ?)", (id_, name, api_key))
    mock_d1.commit()


def _create(payload=None):
    body = {"variant": "treatment", "selector": ".btn", "property": "color", "value": "red"}
    if payload:
        body.update(payload)
    return client.post("/api/v1/projects/demo-app/visual-changes", json=body)


class TestVisualChanges:
    def test_list_empty(self, mock_d1):
        _seed_project(mock_d1)
        res = client.get("/api/v1/projects/demo-app/visual-changes")
        assert res.status_code == 200
        assert res.json() == []

    def test_create_and_list(self, mock_d1):
        _seed_project(mock_d1)
        res = _create()
        assert res.status_code == 201
        body = res.json()
        assert body["project_id"] == "demo-app"
        assert body["selector"] == ".btn"
        assert body["property"] == "color"
        assert body["value"] == "red"
        assert body["id"]

        listed = client.get("/api/v1/projects/demo-app/visual-changes").json()
        assert len(listed) == 1

    def test_list_filters_by_variant(self, mock_d1):
        _seed_project(mock_d1)
        _create({"variant": "treatment", "selector": ".a"})
        _create({"variant": "control", "selector": ".b"})
        res = client.get("/api/v1/projects/demo-app/visual-changes?variant=treatment")
        assert res.status_code == 200
        rows = res.json()
        assert len(rows) == 1
        assert rows[0]["variant"] == "treatment"

    def test_create_with_flag_key(self, mock_d1):
        _seed_project(mock_d1)
        res = _create({"flag_key": "home_layout_v1"})
        assert res.status_code == 201
        assert res.json()["flag_key"] == "home_layout_v1"

    def test_delete(self, mock_d1):
        _seed_project(mock_d1)
        created = _create().json()
        res = client.delete(f"/api/v1/projects/demo-app/visual-changes/{created['id']}")
        assert res.status_code == 204
        assert client.get("/api/v1/projects/demo-app/visual-changes").json() == []

    def test_delete_unknown_returns_404(self, mock_d1):
        _seed_project(mock_d1)
        res = client.delete("/api/v1/projects/demo-app/visual-changes/no-such-id")
        assert res.status_code == 404

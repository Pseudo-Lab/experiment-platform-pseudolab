from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def _seed_experiment(mock_d1, exp_id="exp-vc-test"):
    import datetime
    now = datetime.datetime.utcnow().isoformat()
    mock_d1.execute(
        """INSERT INTO experiments
           (id, name, status, experiment_type, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (exp_id, "VC Test Experiment", "running", "ab_test", now, now),
    )
    mock_d1.commit()


def _create(exp_id="exp-vc-test", payload=None):
    body = {"variation_key": "treatment", "selector": ".btn", "type": "color", "value": "red"}
    if payload:
        body.update(payload)
    return client.post(f"/api/v1/experiments/{exp_id}/visual-changes", json=body)


class TestVisualChanges:
    def test_list_empty(self, mock_d1):
        _seed_experiment(mock_d1)
        res = client.get("/api/v1/experiments/exp-vc-test/visual-changes")
        assert res.status_code == 200
        assert res.json() == []

    def test_create_and_list(self, mock_d1):
        _seed_experiment(mock_d1)
        res = _create()
        assert res.status_code == 201
        body = res.json()
        assert body["experiment_id"] == "exp-vc-test"
        assert body["selector"] == ".btn"
        assert body["type"] == "color"
        assert body["value"] == "red"
        assert body["id"]

        listed = client.get("/api/v1/experiments/exp-vc-test/visual-changes").json()
        assert len(listed) == 1

    def test_list_filters_by_variation_key(self, mock_d1):
        _seed_experiment(mock_d1)
        _create(payload={"variation_key": "treatment", "selector": ".a"})
        _create(payload={"variation_key": "control", "selector": ".b"})
        res = client.get("/api/v1/experiments/exp-vc-test/visual-changes?variation_key=treatment")
        assert res.status_code == 200
        rows = res.json()
        assert len(rows) == 1
        assert rows[0]["variation_key"] == "treatment"

    def test_delete(self, mock_d1):
        _seed_experiment(mock_d1)
        created = _create().json()
        res = client.delete(f"/api/v1/visual-changes/{created['id']}")
        assert res.status_code == 204
        assert client.get("/api/v1/experiments/exp-vc-test/visual-changes").json() == []

    def test_delete_unknown_returns_404(self, mock_d1):
        res = client.delete("/api/v1/visual-changes/no-such-id")
        assert res.status_code == 404

    def test_create_unknown_experiment_returns_404(self, mock_d1):
        res = client.post(
            "/api/v1/experiments/nonexistent-exp/visual-changes",
            json={"variation_key": "treatment", "selector": ".btn", "type": "color", "value": "red"},
        )
        assert res.status_code == 404

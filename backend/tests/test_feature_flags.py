import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

BASE = "/api/v1/feature-flags"


def _create_flag(flag_key="test_flag", rollout_pct=0, enabled=False, description="test flag"):
    return client.post(
        BASE + "/",
        json={
            "flag_key": flag_key,
            "description": description,
            "rollout_pct": rollout_pct,
            "enabled": enabled,
        },
    )


class TestCreateFeatureFlag:
    def test_success(self):
        resp = _create_flag("valid_flag", rollout_pct=25, enabled=True)

        assert resp.status_code == 201
        body = resp.json()
        assert body["flag_key"] == "valid_flag"
        assert body["description"] == "test flag"
        assert body["rollout_pct"] == 25
        assert body["enabled"] is True
        assert body["created_at"]
        assert body["updated_at"]

    def test_duplicate_flag_key_returns_409(self):
        first = _create_flag("dup_flag")
        assert first.status_code == 201

        second = _create_flag("dup_flag")
        assert second.status_code == 409
        assert "already exists" in second.json()["detail"]

    @pytest.mark.parametrize(
        "flag_key",
        [
            "ab",
            "InvalidFlag",
            "-bad",
            "bad.key",
            "bad key",
        ],
    )
    def test_invalid_flag_key_returns_422(self, flag_key):
        resp = _create_flag(flag_key)
        assert resp.status_code == 422

    @pytest.mark.parametrize("rollout_pct", [-1, 101])
    def test_invalid_rollout_returns_422(self, rollout_pct):
        resp = _create_flag("bad_rollout", rollout_pct=rollout_pct)
        assert resp.status_code == 422

    def test_execute_failure_returns_502(self, monkeypatch):
        async def fail_execute(sql: str, params=None):
            return False

        monkeypatch.setattr("app.db.d1.execute", fail_execute)

        resp = _create_flag("execute_fail")
        assert resp.status_code == 502
        assert resp.json()["detail"] == "Failed to create feature flag"


class TestUpdateFeatureFlag:
    def test_missing_update_returns_404(self):
        resp = client.patch(f"{BASE}/missing_flag", json={"enabled": True})
        assert resp.status_code == 404

    def test_invalid_flag_key_returns_422(self):
        resp = client.patch(f"{BASE}/Bad.Flag", json={"enabled": True})
        assert resp.status_code == 422

    def test_invalid_rollout_returns_422(self):
        created = _create_flag("update_bad_rollout")
        assert created.status_code == 201

        resp = client.patch(f"{BASE}/update_bad_rollout", json={"rollout_pct": 101})
        assert resp.status_code == 422

    def test_execute_failure_returns_502(self, monkeypatch):
        created = _create_flag("update_execute_fail")
        assert created.status_code == 201

        async def fail_execute(sql: str, params=None):
            return False

        monkeypatch.setattr("app.db.d1.execute", fail_execute)

        resp = client.patch(f"{BASE}/update_execute_fail", json={"enabled": True})
        assert resp.status_code == 502
        assert resp.json()["detail"] == "Failed to update feature flag"


class TestDecideFeatureFlag:
    def test_unknown_flag_returns_control(self):
        resp = client.get(f"{BASE}/decide", params={"flag_key": "unknown_flag", "user_id": "user-1"})

        assert resp.status_code == 200
        assert resp.json() == {"success": True, "data": {"variant": "control"}}

    def test_disabled_flag_always_returns_control(self):
        created = _create_flag("disabled_flag", rollout_pct=100, enabled=False)
        assert created.status_code == 201

        for user_id in ["user-1", "user-2", "user-3"]:
            resp = client.get(f"{BASE}/decide", params={"flag_key": "disabled_flag", "user_id": user_id})
            assert resp.status_code == 200
            assert resp.json()["data"]["variant"] == "control"

    def test_rollout_zero_returns_control(self):
        created = _create_flag("zero_rollout", rollout_pct=0, enabled=True)
        assert created.status_code == 201

        resp = client.get(f"{BASE}/decide", params={"flag_key": "zero_rollout", "user_id": "user-1"})
        assert resp.status_code == 200
        assert resp.json()["data"]["variant"] == "control"

    def test_rollout_hundred_returns_treatment(self):
        created = _create_flag("hundred_rollout", rollout_pct=100, enabled=True)
        assert created.status_code == 201

        resp = client.get(f"{BASE}/decide", params={"flag_key": "hundred_rollout", "user_id": "user-1"})
        assert resp.status_code == 200
        assert resp.json()["data"]["variant"] == "treatment"

    def test_decide_invalid_flag_key_returns_422(self):
        resp = client.get(f"{BASE}/decide", params={"flag_key": "Bad.Flag", "user_id": "user-1"})
        assert resp.status_code == 422

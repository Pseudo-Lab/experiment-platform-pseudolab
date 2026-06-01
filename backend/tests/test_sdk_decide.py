import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

BASE = "/api/v1"


def _create_flag(flag_key="sdk_flag", rollout_pct=100, enabled=True):
    return client.post(
        f"{BASE}/feature-flags/",
        json={"flag_key": flag_key, "rollout_pct": rollout_pct, "enabled": enabled},
    )


def _create_placement(key="sdk-placement", status="active"):
    return client.post(
        f"{BASE}/placements/",
        json={"key": key, "name": "SDK Placement", "status": status},
    )


class TestUnifiedDecide:
    def test_flag_treatment(self):
        _create_flag("sdk_flag_on", rollout_pct=100, enabled=True)
        resp = client.post(f"{BASE}/decide", json={"key": "sdk_flag_on", "user_id": "u1"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["type"] == "flag"
        assert body["variant"] == "treatment"
        assert body["show"] is True
        assert body["payload"] is None

    def test_flag_control(self):
        _create_flag("sdk_flag_off", rollout_pct=0, enabled=True)
        resp = client.post(f"{BASE}/decide", json={"key": "sdk_flag_off", "user_id": "u1"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["type"] == "flag"
        assert body["variant"] == "control"
        assert body["show"] is False

    def test_placement_show(self):
        _create_placement("sdk-pl-active", status="active")
        resp = client.post(f"{BASE}/decide", json={"key": "sdk-pl-active", "user_id": "u1"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["type"] == "placement"
        assert body["show"] is True
        assert body["variant"] == "treatment"
        assert body["payload"] is not None
        assert "reason" in body["payload"]

    def test_placement_inactive(self):
        _create_placement("sdk-pl-inactive", status="inactive")
        resp = client.post(f"{BASE}/decide", json={"key": "sdk-pl-inactive", "user_id": "u1"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["type"] == "placement"
        assert body["show"] is False
        assert body["variant"] == "control"

    def test_flag_takes_priority_over_placement(self):
        # same key exists in both tables — flag should win
        _create_flag("overlap_key", rollout_pct=100, enabled=True)
        _create_placement("overlap_key", status="active")
        resp = client.post(f"{BASE}/decide", json={"key": "overlap_key", "user_id": "u1"})
        assert resp.status_code == 200
        assert resp.json()["type"] == "flag"

    def test_unknown_key_returns_placement_not_found(self):
        resp = client.post(f"{BASE}/decide", json={"key": "no-such-key", "user_id": "u1"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["type"] == "placement"
        assert body["show"] is False
        assert body["payload"]["reason"] == "not_found"

    def test_missing_user_id_returns_422(self):
        resp = client.post(f"{BASE}/decide", json={"key": "some_key"})
        assert resp.status_code == 422

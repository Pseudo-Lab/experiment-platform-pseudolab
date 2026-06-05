"""
GET /experiments/{id}/analytics 엔드포인트 테스트.
POST /events 엔드포인트 테스트 포함.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

BASE = "/api/v1"
EXP_BASE = f"{BASE}/experiments"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_experiment(flag_key: str | None = None) -> dict:
    payload = {
        "name": "Analytics 테스트 실험",
        "experiment_type": "ab_test",
        "primary_metric": "click",
        "variants": [
            {"name": "control", "traffic_ratio": 0.5},
            {"name": "treatment", "traffic_ratio": 0.5},
        ],
    }
    if flag_key:
        payload["flag_key"] = flag_key
        # feature_flag를 먼저 생성해야 _require_flag 검증을 통과한다
        client.post(f"{BASE}/feature-flags/", json={"flag_key": flag_key, "description": "test"})
    resp = client.post(f"{EXP_BASE}/", json=payload)
    assert resp.status_code == 201
    return resp.json()


def _post_event(event_type: str, key: str, variant: str, user_id: str,
                experiment_id: str | None = None, url: str | None = None):
    payload = {
        "type": event_type,
        "key": key,
        "variant": variant,
        "user_id": user_id,
        "url": url,
    }
    if experiment_id:
        payload["experiment_id"] = experiment_id
    resp = client.post(f"{BASE}/events", json=payload)
    assert resp.status_code == 202
    return resp.json()


# ---------------------------------------------------------------------------
# POST /events
# ---------------------------------------------------------------------------

class TestPostEvents:
    def test_impression_accepted(self):
        resp = client.post(f"{BASE}/events", json={
            "type": "impression",
            "key": "my-flag",
            "variant": "control",
            "user_id": "u1",
        })
        assert resp.status_code == 202
        assert resp.json()["success"] is True

    def test_conversion_accepted(self):
        resp = client.post(f"{BASE}/events", json={
            "type": "conversion",
            "key": "my-flag",
            "variant": "treatment",
            "user_id": "u2",
            "url": "/home",
            "experiment_id": "exp-abc",
        })
        assert resp.status_code == 202

    def test_no_auth_required(self):
        """인증 없이 호출 가능해야 한다."""
        resp = client.post(f"{BASE}/events", json={
            "type": "impression",
            "key": "flag-x",
            "variant": "control",
            "user_id": "anonymous",
        })
        assert resp.status_code == 202


# ---------------------------------------------------------------------------
# GET /experiments/{id}/analytics — empty state
# ---------------------------------------------------------------------------

class TestAnalyticsEmpty:
    def test_empty_returns_zeros(self):
        exp = _create_experiment()
        resp = client.get(f"{EXP_BASE}/{exp['id']}/analytics")
        assert resp.status_code == 200
        data = resp.json()
        assert data["impressions"]["total"] == 0
        assert data["conversions"]["total"] == 0
        assert data["statistical_significance"]["is_significant"] is False
        assert data["statistical_significance"]["p_value"] is None
        assert data["anomalies"] == []


# ---------------------------------------------------------------------------
# GET /experiments/{id}/analytics — with data
# ---------------------------------------------------------------------------

class TestAnalyticsWithData:
    def test_impression_counts_by_variant(self):
        exp = _create_experiment()
        exp_id = exp["id"]
        for i in range(5):
            _post_event("impression", "flag-x", "control", f"u-ctrl-{i}", experiment_id=exp_id, url="/home")
        for i in range(7):
            _post_event("impression", "flag-x", "treatment", f"u-treat-{i}", experiment_id=exp_id, url="/home")

        resp = client.get(f"{EXP_BASE}/{exp_id}/analytics")
        assert resp.status_code == 200
        data = resp.json()
        assert data["impressions"]["total"] == 12
        assert data["impressions"]["by_variant"]["control"] == 5
        assert data["impressions"]["by_variant"]["treatment"] == 7
        assert "/home" in data["impressions"]["by_url"]

    def test_conversion_rates_calculated(self):
        exp = _create_experiment()
        exp_id = exp["id"]
        for i in range(100):
            _post_event("impression", "flag-x", "control", f"uc{i}", experiment_id=exp_id)
        for i in range(100):
            _post_event("impression", "flag-x", "treatment", f"ut{i}", experiment_id=exp_id)
        for i in range(10):
            _post_event("conversion", "flag-x", "control", f"uc{i}", experiment_id=exp_id)
        for i in range(25):
            _post_event("conversion", "flag-x", "treatment", f"ut{i}", experiment_id=exp_id)

        resp = client.get(f"{EXP_BASE}/{exp_id}/analytics")
        assert resp.status_code == 200
        data = resp.json()
        assert data["conversions"]["total"] == 35
        assert data["conversions"]["by_variant"]["control"] == 10
        assert data["conversions"]["by_variant"]["treatment"] == 25
        ctrl_rate = data["conversions"]["rate"]["control"]
        treat_rate = data["conversions"]["rate"]["treatment"]
        assert abs(ctrl_rate - 0.10) < 0.001
        assert abs(treat_rate - 0.25) < 0.001

    def test_significant_result(self):
        """충분한 데이터가 있으면 통계적 유의성을 올바르게 판단해야 한다."""
        exp = _create_experiment()
        exp_id = exp["id"]
        # control: 500 imp, 50 conv (10%)
        for i in range(500):
            _post_event("impression", "fk", "control", f"uc{i}", experiment_id=exp_id)
        for i in range(50):
            _post_event("conversion", "fk", "control", f"uc{i}", experiment_id=exp_id)
        # treatment: 500 imp, 100 conv (20%) — large uplift → should be significant
        for i in range(500):
            _post_event("impression", "fk", "treatment", f"ut{i}", experiment_id=exp_id)
        for i in range(100):
            _post_event("conversion", "fk", "treatment", f"ut{i}", experiment_id=exp_id)

        resp = client.get(f"{EXP_BASE}/{exp_id}/analytics")
        assert resp.status_code == 200
        sig = resp.json()["statistical_significance"]
        assert sig["is_significant"] is True
        assert sig["p_value"] is not None
        assert sig["p_value"] < 0.05
        assert sig["winner"] == "treatment"

    def test_not_significant_result(self):
        """효과가 없으면 유의하지 않아야 한다."""
        exp = _create_experiment()
        exp_id = exp["id"]
        for i in range(200):
            _post_event("impression", "fk", "control", f"uc{i}", experiment_id=exp_id)
        for i in range(200):
            _post_event("impression", "fk", "treatment", f"ut{i}", experiment_id=exp_id)
        for i in range(20):
            _post_event("conversion", "fk", "control", f"uc{i}", experiment_id=exp_id)
        for i in range(21):
            _post_event("conversion", "fk", "treatment", f"ut{i}", experiment_id=exp_id)

        resp = client.get(f"{EXP_BASE}/{exp_id}/analytics")
        sig = resp.json()["statistical_significance"]
        assert sig["is_significant"] is False

    def test_time_series_present(self):
        exp = _create_experiment()
        exp_id = exp["id"]
        _post_event("impression", "fk", "control", "u1", experiment_id=exp_id)
        resp = client.get(f"{EXP_BASE}/{exp_id}/analytics")
        ts = resp.json()["impressions"]["time_series"]
        assert len(ts) >= 1
        assert "date" in ts[0]
        assert "count" in ts[0]

    def test_lookup_by_flag_key(self):
        """experiment_id 없이 experiment_key만 있어도 집계돼야 한다."""
        exp = _create_experiment(flag_key="my-exp-flag")
        exp_id = exp["id"]
        # 이벤트는 experiment_id 없이 experiment_key만 전달
        _post_event("impression", "my-exp-flag", "control", "u1")
        _post_event("impression", "my-exp-flag", "treatment", "u2")

        resp = client.get(f"{EXP_BASE}/{exp_id}/analytics")
        assert resp.status_code == 200
        assert resp.json()["impressions"]["total"] == 2

    def test_anomaly_conversion_exceeds_impression(self):
        """전환 수 > 노출 수이면 이상 감지 경고를 반환해야 한다."""
        exp = _create_experiment()
        exp_id = exp["id"]
        _post_event("impression", "fk", "treatment", "u1", experiment_id=exp_id)
        for i in range(5):
            _post_event("conversion", "fk", "treatment", f"u{i}", experiment_id=exp_id)

        resp = client.get(f"{EXP_BASE}/{exp_id}/analytics")
        anomalies = resp.json()["anomalies"]
        assert len(anomalies) >= 1
        assert any(a["variant"] == "treatment" for a in anomalies)

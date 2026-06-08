"""
의사결정 엔드포인트 테스트.
POST /experiments/{id}/decisions
GET  /experiments/{id}/decisions
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

BASE = "/api/v1"
EXP_BASE = f"{BASE}/experiments"


@pytest.fixture
def experiment():
    resp = client.post(f"{EXP_BASE}/", json={
        "name": "Decision test exp",
        "variants": [
            {"name": "control", "traffic_ratio": 0.5},
            {"name": "treatment", "traffic_ratio": 0.5},
        ],
    })
    assert resp.status_code == 201
    exp = resp.json()
    yield exp
    client.delete(f"{EXP_BASE}/{exp['id']}")


class TestCreateExperimentDecision:
    def test_ship_decision(self, experiment):
        exp_id = experiment["id"]
        resp = client.post(f"{EXP_BASE}/{exp_id}/decisions", json={
            "decision": "SHIP",
            "reason": "p-value < 0.05, treatment wins",
        })
        assert resp.status_code == 201
        body = resp.json()
        assert body["decision"] == "SHIP"
        assert body["reason"] == "p-value < 0.05, treatment wins"
        assert body["experiment_id"] == exp_id
        assert body["decided_by"] == "user"
        assert "decided_at" in body

    def test_hold_decision(self, experiment):
        resp = client.post(f"{EXP_BASE}/{experiment['id']}/decisions", json={
            "decision": "HOLD",
            "reason": "데이터 부족",
        })
        assert resp.status_code == 201
        assert resp.json()["decision"] == "HOLD"

    def test_rollback_decision(self, experiment):
        resp = client.post(f"{EXP_BASE}/{experiment['id']}/decisions", json={
            "decision": "ROLLBACK",
            "reason": "가드레일 위반",
        })
        assert resp.status_code == 201
        assert resp.json()["decision"] == "ROLLBACK"

    def test_custom_decided_by(self, experiment):
        resp = client.post(f"{EXP_BASE}/{experiment['id']}/decisions", json={
            "decision": "SHIP",
            "reason": "팀 합의",
            "decided_by": "gaekyung",
        })
        assert resp.status_code == 201
        assert resp.json()["decided_by"] == "gaekyung"

    def test_invalid_decision_type(self, experiment):
        resp = client.post(f"{EXP_BASE}/{experiment['id']}/decisions", json={
            "decision": "MAYBE",
            "reason": "not valid",
        })
        assert resp.status_code == 422

    def test_unknown_experiment(self):
        resp = client.post(f"{EXP_BASE}/nonexistent-id/decisions", json={
            "decision": "SHIP",
            "reason": "test",
        })
        assert resp.status_code == 404


class TestListExperimentDecisions:
    def test_empty_list(self, experiment):
        resp = client.get(f"{EXP_BASE}/{experiment['id']}/decisions")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_after_create(self, experiment):
        exp_id = experiment["id"]
        client.post(f"{EXP_BASE}/{exp_id}/decisions", json={"decision": "HOLD", "reason": "first"})
        client.post(f"{EXP_BASE}/{exp_id}/decisions", json={"decision": "SHIP", "reason": "second"})

        resp = client.get(f"{EXP_BASE}/{exp_id}/decisions")
        assert resp.status_code == 200
        decisions = resp.json()
        assert len(decisions) == 2
        # most recent first
        assert decisions[0]["reason"] == "second"
        assert decisions[1]["reason"] == "first"

    def test_decisions_isolated_per_experiment(self, experiment):
        exp_id = experiment["id"]
        other = client.post(f"{EXP_BASE}/", json={
            "name": "other exp",
            "variants": [{"name": "control", "traffic_ratio": 1.0}],
        }).json()

        client.post(f"{EXP_BASE}/{exp_id}/decisions", json={"decision": "SHIP", "reason": "exp1"})
        client.post(f"{EXP_BASE}/{other['id']}/decisions", json={"decision": "HOLD", "reason": "exp2"})

        d1 = client.get(f"{EXP_BASE}/{exp_id}/decisions").json()
        d2 = client.get(f"{EXP_BASE}/{other['id']}/decisions").json()

        assert len(d1) == 1 and d1[0]["reason"] == "exp1"
        assert len(d2) == 1 and d2[0]["reason"] == "exp2"

        client.delete(f"{EXP_BASE}/{other['id']}")


class TestSrmWarning:
    def _post_event(self, event_type: str, key: str, variant: str, user_id: str, exp_id: str):
        client.post(f"{BASE}/events", json={
            "type": event_type,
            "key": key,
            "variant": variant,
            "user_id": user_id,
            "experiment_id": exp_id,
        })

    def test_no_srm_with_balanced_data(self):
        exp = client.post(f"{EXP_BASE}/", json={
            "name": "srm balanced",
            "variants": [
                {"name": "control", "traffic_ratio": 0.5},
                {"name": "treatment", "traffic_ratio": 0.5},
            ],
        }).json()
        exp_id = exp["id"]

        for i in range(100):
            self._post_event("impression", "fk", "control", f"uc{i}", exp_id)
        for i in range(100):
            self._post_event("impression", "fk", "treatment", f"ut{i}", exp_id)

        resp = client.get(f"{EXP_BASE}/{exp_id}/analytics")
        assert resp.status_code == 200
        assert resp.json()["srm_warning"] is False

        client.delete(f"{EXP_BASE}/{exp_id}")

    def test_srm_detected_with_skewed_data(self):
        exp = client.post(f"{EXP_BASE}/", json={
            "name": "srm skewed",
            "variants": [
                {"name": "control", "traffic_ratio": 0.5},
                {"name": "treatment", "traffic_ratio": 0.5},
            ],
        }).json()
        exp_id = exp["id"]

        for i in range(500):
            self._post_event("impression", "fk", "control", f"uc{i}", exp_id)
        for i in range(10):
            self._post_event("impression", "fk", "treatment", f"ut{i}", exp_id)

        resp = client.get(f"{EXP_BASE}/{exp_id}/analytics")
        assert resp.status_code == 200
        assert resp.json()["srm_warning"] is True

        client.delete(f"{EXP_BASE}/{exp_id}")

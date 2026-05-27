import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

BASE = "/api/v1/experiments"

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def created_experiment():
    """실험 하나 생성 후 반환, 테스트 종료 후 삭제.

    상태 전환 검증을 통과하기 위해 quasi_experiment + primary_metric로 생성한다.
    (ab_test는 running 전환 시 flag_key를 요구하므로 별도 fixture로 분리)
    """
    payload = {
        "name": "테스트 실험",
        "hypothesis": "버튼 색상이 전환율에 영향을 준다",
        "owner_id": "user-001",
        "experiment_type": "quasi_experiment",
        "primary_metric": "button_clicked",
        "variants": [
            {"name": "control", "traffic_ratio": 0.5},
            {"name": "treatment", "traffic_ratio": 0.5},
        ],
    }
    resp = client.post(BASE + "/", json=payload)
    assert resp.status_code == 201
    exp = resp.json()
    yield exp
    client.delete(f"{BASE}/{exp['id']}")


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

class TestCreateExperiment:
    def test_success(self):
        payload = {
            "name": "생성 테스트",
            "variants": [
                {"name": "A", "traffic_ratio": 0.5},
                {"name": "B", "traffic_ratio": 0.5},
            ],
        }
        resp = client.post(BASE + "/", json=payload)
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "생성 테스트"
        assert body["status"] == "draft"
        assert len(body["variants"]) == 2
        client.delete(f"{BASE}/{body['id']}")

    def test_status_defaults_to_draft(self, created_experiment):
        assert created_experiment["status"] == "draft"

    def test_variants_attached(self, created_experiment):
        variants = created_experiment["variants"]
        names = {v["name"] for v in variants}
        assert names == {"control", "treatment"}

    def test_create_with_generic_operation_fields(self):
        payload = {
            "id": "s12-mid-reflection",
            "name": "12기 중간 회고 조사",
            "hypothesis": "배너 노출은 회고 제출을 늘린다",
            "expected_effect": "준실험 응답 수 확보",
            "primary_metric": "project_reflection_submitted",
            "completion_event": "project_reflection_submitted",
            "experiment_type": "quasi_experiment",
            "cohort_id": "12",
            "start_at": "2026-05-27T15:00:00+00:00",
            "end_at": "2026-06-09T15:00:00+00:00",
            "variants": [
                {"name": "control", "traffic_ratio": 0.5},
                {"name": "treatment", "traffic_ratio": 0.5},
            ],
        }

        resp = client.post(BASE + "/", json=payload)

        assert resp.status_code == 201
        body = resp.json()
        assert body["id"] == "s12-mid-reflection"
        assert body["experiment_type"] == "quasi_experiment"
        assert body["primary_metric"] == "project_reflection_submitted"
        assert body["completion_event"] == "project_reflection_submitted"
        assert body["cohort_id"] == "12"
        assert body["start_at"] == "2026-05-27T15:00:00Z"
        assert body["end_at"] == "2026-06-09T15:00:00Z"
        client.delete(f"{BASE}/{body['id']}")

    def test_duplicate_explicit_id_returns_409(self):
        payload = {"id": "duplicate-exp", "name": "중복 실험"}

        assert client.post(BASE + "/", json=payload).status_code == 201
        resp = client.post(BASE + "/", json=payload)

        assert resp.status_code == 409
        assert resp.json()["detail"] == "Experiment id already exists"
        client.delete(f"{BASE}/duplicate-exp")

    def test_invalid_explicit_id_returns_422(self):
        resp = client.post(BASE + "/", json={"id": "S12 Mid Reflection", "name": "잘못된 ID"})

        assert resp.status_code == 422


class TestListFilter:
    def test_filter_by_status(self, created_experiment):
        exp_id = created_experiment["id"]
        client.patch(f"{BASE}/{exp_id}", json={"status": "running"})

        resp = client.get(BASE + "/", params={"status": "running"})
        assert resp.status_code == 200
        ids = [e["id"] for e in resp.json()]
        assert exp_id in ids

    def test_filter_excludes_other_status(self, created_experiment):
        exp_id = created_experiment["id"]  # status: draft

        resp = client.get(BASE + "/", params={"status": "running"})
        assert resp.status_code == 200
        ids = [e["id"] for e in resp.json()]
        assert exp_id not in ids

    def test_no_filter_returns_all(self, created_experiment):
        resp = client.get(BASE + "/")
        assert resp.status_code == 200
        ids = [e["id"] for e in resp.json()]
        assert created_experiment["id"] in ids

    def test_invalid_status_returns_422(self):
        resp = client.get(BASE + "/", params={"status": "invalid"})
        assert resp.status_code == 422


class TestGetExperiment:
    def test_get_existing(self, created_experiment):
        resp = client.get(f"{BASE}/{created_experiment['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == created_experiment["id"]

    def test_get_nonexistent(self):
        resp = client.get(f"{BASE}/nonexistent-id-000")
        assert resp.status_code == 404

    def test_list_includes_created(self, created_experiment):
        resp = client.get(BASE + "/")
        assert resp.status_code == 200
        ids = [e["id"] for e in resp.json()]
        assert created_experiment["id"] in ids


class TestUpdateExperiment:
    def test_update_name(self, created_experiment):
        resp = client.patch(
            f"{BASE}/{created_experiment['id']}",
            json={"name": "수정된 이름"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "수정된 이름"

    def test_update_status_to_running(self, created_experiment):
        resp = client.patch(
            f"{BASE}/{created_experiment['id']}",
            json={"status": "running"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "running"

    def test_update_nonexistent(self):
        resp = client.patch(f"{BASE}/nonexistent-id-000", json={"name": "x"})
        assert resp.status_code == 404


class TestStatusTransition:
    def _make(self, name="전환 테스트"):
        # 상태 전환만 검증하므로 ab_test의 flag_key 요구를 피하기 위해
        # quasi_experiment + primary_metric로 생성.
        payload = {
            "name": name,
            "experiment_type": "quasi_experiment",
            "primary_metric": "button_clicked",
            "variants": [
                {"name": "A", "traffic_ratio": 0.5},
                {"name": "B", "traffic_ratio": 0.5},
            ],
        }
        return client.post(BASE + "/", json=payload).json()["id"]

    def _patch_status(self, exp_id, status):
        return client.patch(f"{BASE}/{exp_id}", json={"status": status})

    # 허용 전환
    def test_draft_to_running(self):
        exp_id = self._make()
        assert self._patch_status(exp_id, "running").status_code == 200
        client.delete(f"{BASE}/{exp_id}")

    def test_draft_to_archived(self):
        exp_id = self._make()
        assert self._patch_status(exp_id, "archived").status_code == 200
        client.delete(f"{BASE}/{exp_id}")

    def test_running_to_paused(self):
        exp_id = self._make()
        self._patch_status(exp_id, "running")
        assert self._patch_status(exp_id, "paused").status_code == 200
        client.delete(f"{BASE}/{exp_id}")

    def test_running_to_completed(self):
        exp_id = self._make()
        self._patch_status(exp_id, "running")
        assert self._patch_status(exp_id, "completed").status_code == 200
        client.delete(f"{BASE}/{exp_id}")

    def test_running_to_archived(self):
        exp_id = self._make()
        self._patch_status(exp_id, "running")
        assert self._patch_status(exp_id, "archived").status_code == 200
        client.delete(f"{BASE}/{exp_id}")

    def test_paused_to_running(self):
        exp_id = self._make()
        self._patch_status(exp_id, "running")
        self._patch_status(exp_id, "paused")
        assert self._patch_status(exp_id, "running").status_code == 200
        client.delete(f"{BASE}/{exp_id}")

    def test_paused_to_archived(self):
        exp_id = self._make()
        self._patch_status(exp_id, "running")
        self._patch_status(exp_id, "paused")
        assert self._patch_status(exp_id, "archived").status_code == 200
        client.delete(f"{BASE}/{exp_id}")

    # 차단 전환
    def test_completed_to_running_blocked(self):
        exp_id = self._make()
        self._patch_status(exp_id, "running")
        self._patch_status(exp_id, "completed")
        assert self._patch_status(exp_id, "running").status_code == 422
        client.delete(f"{BASE}/{exp_id}")

    def test_archived_to_running_blocked(self):
        exp_id = self._make()
        self._patch_status(exp_id, "archived")
        assert self._patch_status(exp_id, "running").status_code == 422
        client.delete(f"{BASE}/{exp_id}")

    def test_draft_to_paused_blocked(self):
        exp_id = self._make()
        assert self._patch_status(exp_id, "paused").status_code == 422
        client.delete(f"{BASE}/{exp_id}")


class TestRunningPreconditions:
    """running 전환 시 primary_metric / flag_key 사전 조건 검증."""

    def test_running_blocked_without_primary_metric(self):
        # primary_metric 없이 quasi_experiment 생성
        payload = {
            "name": "metric 없는 실험",
            "experiment_type": "quasi_experiment",
            "variants": [
                {"name": "control", "traffic_ratio": 0.5},
                {"name": "treatment", "traffic_ratio": 0.5},
            ],
        }
        exp_id = client.post(BASE + "/", json=payload).json()["id"]
        try:
            resp = client.patch(f"{BASE}/{exp_id}", json={"status": "running"})
            assert resp.status_code == 422
            assert "primary_metric" in resp.json()["detail"]
        finally:
            client.delete(f"{BASE}/{exp_id}")

    def test_running_blocked_for_ab_test_without_flag_key(self):
        # primary_metric은 있지만 flag_key 없는 ab_test
        payload = {
            "name": "flag 없는 A/B 테스트",
            "experiment_type": "ab_test",
            "primary_metric": "clicked",
            "variants": [
                {"name": "control", "traffic_ratio": 0.5},
                {"name": "treatment", "traffic_ratio": 0.5},
            ],
        }
        exp_id = client.post(BASE + "/", json=payload).json()["id"]
        try:
            resp = client.patch(f"{BASE}/{exp_id}", json={"status": "running"})
            assert resp.status_code == 422
            assert "Feature Flag" in resp.json()["detail"]
        finally:
            client.delete(f"{BASE}/{exp_id}")

    def test_running_allowed_for_quasi_experiment_without_flag_key(self):
        # quasi_experiment는 flag_key 없어도 running 가능 (placement 기반 운영 보존)
        payload = {
            "name": "quasi flag 없음",
            "experiment_type": "quasi_experiment",
            "primary_metric": "submitted",
            "variants": [
                {"name": "control", "traffic_ratio": 0.5},
                {"name": "treatment", "traffic_ratio": 0.5},
            ],
        }
        exp_id = client.post(BASE + "/", json=payload).json()["id"]
        try:
            resp = client.patch(f"{BASE}/{exp_id}", json={"status": "running"})
            assert resp.status_code == 200
            assert resp.json()["status"] == "running"
        finally:
            client.delete(f"{BASE}/{exp_id}")


class TestDeleteExperiment:
    def test_delete_existing(self):
        payload = {
            "name": "삭제용 실험",
            "variants": [{"name": "A", "traffic_ratio": 1.0}],
        }
        exp_id = client.post(BASE + "/", json=payload).json()["id"]
        resp = client.delete(f"{BASE}/{exp_id}")
        assert resp.status_code == 204

    def test_deleted_is_gone(self):
        payload = {
            "name": "삭제 후 조회 확인",
            "variants": [{"name": "A", "traffic_ratio": 1.0}],
        }
        exp_id = client.post(BASE + "/", json=payload).json()["id"]
        client.delete(f"{BASE}/{exp_id}")
        resp = client.get(f"{BASE}/{exp_id}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# traffic_ratio 검증
# ---------------------------------------------------------------------------

class TestTrafficRatioValidation:
    def test_ratio_sum_not_one_returns_422(self):
        payload = {
            "name": "잘못된 비율 실험",
            "variants": [
                {"name": "A", "traffic_ratio": 0.3},
                {"name": "B", "traffic_ratio": 0.3},
            ],
        }
        resp = client.post(BASE + "/", json=payload)
        assert resp.status_code == 422

    def test_ratio_sum_one_succeeds(self):
        payload = {
            "name": "올바른 비율 실험",
            "variants": [
                {"name": "A", "traffic_ratio": 0.7},
                {"name": "B", "traffic_ratio": 0.3},
            ],
        }
        resp = client.post(BASE + "/", json=payload)
        assert resp.status_code == 201
        client.delete(f"{BASE}/{resp.json()['id']}")

    def test_no_variants_succeeds(self):
        payload = {"name": "variant 없는 실험"}
        resp = client.post(BASE + "/", json=payload)
        assert resp.status_code == 201
        client.delete(f"{BASE}/{resp.json()['id']}")


# ---------------------------------------------------------------------------
# 결정론적 할당
# ---------------------------------------------------------------------------

class TestAssign:
    def test_assign_returns_valid_variant(self, created_experiment):
        exp_id = created_experiment["id"]
        variant_names = {v["name"] for v in created_experiment["variants"]}

        resp = client.get(f"{BASE}/{exp_id}/assign/user-abc")
        assert resp.status_code == 200
        body = resp.json()
        assert body["experiment_id"] == exp_id
        assert body["variant_name"] in variant_names

    def test_deterministic_same_user(self, created_experiment):
        exp_id = created_experiment["id"]
        r1 = client.get(f"{BASE}/{exp_id}/assign/user-det-01").json()
        r2 = client.get(f"{BASE}/{exp_id}/assign/user-det-01").json()
        assert r1["variant_id"] == r2["variant_id"]

    def test_deterministic_different_users_can_differ(self, created_experiment):
        """여러 유저를 배정해서 두 variant 모두 실제로 사용되는지 확인."""
        exp_id = created_experiment["id"]
        assigned = set()
        for i in range(20):
            r = client.get(f"{BASE}/{exp_id}/assign/user-{i:03d}").json()
            assigned.add(r["variant_name"])
        assert len(assigned) == 2, "20명 배정 시 두 variant 모두 나와야 한다"

    def test_assign_nonexistent_experiment(self):
        resp = client.get(f"{BASE}/nonexistent-id-000/assign/user-xyz")
        assert resp.status_code == 404

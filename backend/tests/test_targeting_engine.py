"""
타겟팅 조건 엔진 테스트:
- _match_single / _evaluate_conditions 유닛 테스트
- rules_json 기반 segment 평가 통합 테스트
- person.traits → properties_json 저장 테스트
- flag payload 반환 테스트
"""
import json
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.feature_flag import _evaluate_conditions, _match_single

client = TestClient(app)
FLAGS    = "/api/v1/feature-flags"
SEGMENTS = "/api/v1/segments"
DECIDE   = "/api/v1/decide"
IDENTIFY = "/api/v1/identify"


# ---------------------------------------------------------------------------
# Unit: _match_single
# ---------------------------------------------------------------------------

class TestMatchSingle:
    def test_eq_match(self):      assert _match_single("12", "eq", "12") is True
    def test_eq_mismatch(self):   assert _match_single("12", "eq", "99") is False
    def test_eq_none(self):       assert _match_single(None, "eq", "12") is False
    def test_neq_hit(self):       assert _match_single("12", "neq", "99") is True
    def test_neq_miss(self):      assert _match_single("12", "neq", "12") is False
    def test_in_list_hit(self):   assert _match_single("builder", "in", ["builder", "runner"]) is True
    def test_in_list_miss(self):  assert _match_single("guest", "in", ["builder", "runner"]) is False
    def test_not_in_hit(self):    assert _match_single("guest", "not_in", ["builder", "runner"]) is True
    def test_not_in_miss(self):   assert _match_single("builder", "not_in", ["builder", "runner"]) is False
    def test_gt_true(self):       assert _match_single("5", "gt", "3") is True
    def test_gt_false(self):      assert _match_single("2", "gt", "3") is False
    def test_lt_true(self):       assert _match_single("2", "lt", "5") is True
    def test_lt_false(self):      assert _match_single("9", "lt", "5") is False
    def test_contains_hit(self):  assert _match_single("hello world", "contains", "world") is True
    def test_contains_miss(self): assert _match_single("hello", "contains", "world") is False
    def test_not_contains(self):  assert _match_single("hello", "not_contains", "world") is True
    def test_unknown_op(self):    assert _match_single("x", "regex", "x") is False


class TestEvaluateConditions:
    def test_all_pass(self):
        person = {"cohort_id": "12", "role": "builder"}
        conds = [
            {"property": "cohort_id", "operator": "eq", "value": "12"},
            {"property": "role", "operator": "in", "value": ["builder", "runner"]},
        ]
        assert _evaluate_conditions(person, conds) is True

    def test_one_fails(self):
        person = {"cohort_id": "12", "role": "guest"}
        conds = [
            {"property": "cohort_id", "operator": "eq", "value": "12"},
            {"property": "role", "operator": "in", "value": ["builder", "runner"]},
        ]
        assert _evaluate_conditions(person, conds) is False

    def test_empty_conditions_pass(self):
        assert _evaluate_conditions({}, []) is True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_flag(flag_key: str, rollout_pct: int = 100, enabled: bool = True):
    r = client.post(f"{FLAGS}/", json={"flag_key": flag_key, "rollout_pct": rollout_pct, "enabled": enabled})
    assert r.status_code == 201, r.text


def _create_segment(seg_id: str, rules: list):
    r = client.post(f"{SEGMENTS}/", json={
        "id": seg_id,
        "name": f"seg {seg_id}",
        "source": "manual",
        "rules_json": json.dumps(rules),
        "enabled": True,
        "user_ids": [],
    })
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _create_rule(flag_key: str, segment_id: str, rollout_pct: int = 100, variant: str = "treatment"):
    r = client.post(f"{FLAGS}/{flag_key}/rules", json={
        "priority": 1,
        "segment_id": segment_id,
        "rollout_pct": rollout_pct,
        "variant": variant,
        "enabled": True,
    })
    assert r.status_code == 201, r.text


def _identify(user_id: str, **kwargs):
    r = client.post(IDENTIFY, json={"user_id": user_id, **kwargs})
    assert r.status_code == 200, r.text


def _decide(key: str, user_id: str) -> dict:
    r = client.post(DECIDE, json={"key": key, "user_id": user_id})
    assert r.status_code == 200, r.text
    return r.json()


# ---------------------------------------------------------------------------
# Integration: rules_json targeting
# ---------------------------------------------------------------------------

class TestRulesJsonTargeting:
    def test_cohort_eq_match_gets_treatment(self):
        _create_flag("rj-flag-01", rollout_pct=0)
        seg = _create_segment("rj-seg-01", [{"property": "cohort_id", "operator": "eq", "value": "42"}])
        _create_rule("rj-flag-01", seg)
        _identify("rj-user-01a", cohort_id="42")
        _identify("rj-user-01b", cohort_id="99")

        assert _decide("rj-flag-01", "rj-user-01a")["variant"] == "treatment"
        assert _decide("rj-flag-01", "rj-user-01b")["variant"] == "control"

    def test_role_in_condition(self):
        _create_flag("rj-flag-02", rollout_pct=0)
        seg = _create_segment("rj-seg-02", [
            {"property": "role", "operator": "in", "value": ["builder", "runner"]}
        ])
        _create_rule("rj-flag-02", seg)
        _identify("rj-user-02a", role="builder")
        _identify("rj-user-02b", role="guest")

        assert _decide("rj-flag-02", "rj-user-02a")["variant"] == "treatment"
        assert _decide("rj-flag-02", "rj-user-02b")["variant"] == "control"

    def test_traits_property_used_in_conditions(self):
        _create_flag("rj-flag-03", rollout_pct=0)
        seg = _create_segment("rj-seg-03", [{"property": "plan", "operator": "eq", "value": "pro"}])
        _create_rule("rj-flag-03", seg)
        _identify("rj-user-03a", traits={"plan": "pro"})
        _identify("rj-user-03b", traits={"plan": "free"})

        assert _decide("rj-flag-03", "rj-user-03a")["variant"] == "treatment"
        assert _decide("rj-flag-03", "rj-user-03b")["variant"] == "control"

    def test_gt_condition(self):
        _create_flag("rj-flag-04", rollout_pct=0)
        seg = _create_segment("rj-seg-04", [{"property": "level", "operator": "gt", "value": "5"}])
        _create_rule("rj-flag-04", seg)
        _identify("rj-user-04a", traits={"level": 9})
        _identify("rj-user-04b", traits={"level": 3})

        assert _decide("rj-flag-04", "rj-user-04a")["variant"] == "treatment"
        assert _decide("rj-flag-04", "rj-user-04b")["variant"] == "control"

    def test_unknown_user_gets_control(self):
        _create_flag("rj-flag-05", rollout_pct=0)
        seg = _create_segment("rj-seg-05", [{"property": "cohort_id", "operator": "eq", "value": "1"}])
        _create_rule("rj-flag-05", seg)
        # no identify call — user has no person record
        assert _decide("rj-flag-05", "rj-user-05-unknown")["variant"] == "control"

    def test_explicit_membership_fallback_when_no_rules(self):
        """Segment with no rules_json → falls back to membership check."""
        _create_flag("rj-flag-06", rollout_pct=0)
        r = client.post(f"{SEGMENTS}/", json={
            "id": "rj-seg-06",
            "name": "manual seg",
            "source": "manual",
            "rules_json": None,
            "enabled": True,
            "user_ids": ["rj-user-06a"],
        })
        assert r.status_code == 201, r.text
        _create_rule("rj-flag-06", "rj-seg-06")

        assert _decide("rj-flag-06", "rj-user-06a")["variant"] == "treatment"
        assert _decide("rj-flag-06", "rj-user-06b")["variant"] == "control"


# ---------------------------------------------------------------------------
# Flag payload
# ---------------------------------------------------------------------------

class TestFlagPayload:
    def test_flag_with_payload_returned(self):
        r = client.post(f"{FLAGS}/", json={
            "flag_key": "pay-flag-01", "rollout_pct": 100, "enabled": True,
            "payload": {"banner_text": "Hello", "color": "#ff0"},
        })
        assert r.status_code == 201
        body = _decide("pay-flag-01", "u1")
        assert body["payload"] == {"banner_text": "Hello", "color": "#ff0"}

    def test_flag_without_payload_returns_null(self):
        client.post(f"{FLAGS}/", json={"flag_key": "pay-flag-02", "rollout_pct": 100, "enabled": True})
        assert _decide("pay-flag-02", "u1")["payload"] is None

    def test_payload_update_via_patch(self):
        client.post(f"{FLAGS}/", json={"flag_key": "pay-flag-03", "rollout_pct": 100, "enabled": True})
        client.patch(f"{FLAGS}/pay-flag-03", json={"payload": {"v": 2}})
        assert _decide("pay-flag-03", "u1")["payload"] == {"v": 2}


# ---------------------------------------------------------------------------
# Identify with traits
# ---------------------------------------------------------------------------

class TestIdentifyTraits:
    def test_identify_with_traits(self):
        r = client.post(IDENTIFY, json={
            "user_id": "trait-u01", "role": "runner", "traits": {"plan": "pro", "level": 3},
        })
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_identify_without_traits(self):
        r = client.post(IDENTIFY, json={"user_id": "trait-u02", "cohort_id": "7"})
        assert r.status_code == 200

    def test_identify_updates_traits(self):
        _identify("trait-u03", traits={"plan": "free"})
        # second call overwrites traits
        _identify("trait-u03", traits={"plan": "pro"})
        # now rule should match
        _create_flag("trait-flag-01", rollout_pct=0)
        seg = _create_segment("trait-seg-01", [{"property": "plan", "operator": "eq", "value": "pro"}])
        _create_rule("trait-flag-01", seg)
        assert _decide("trait-flag-01", "trait-u03")["variant"] == "treatment"

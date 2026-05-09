from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

FLAGS = "/api/v1/feature-flags"
SEGMENTS = "/api/v1/segments"


def _create_flag(flag_key="target_flag", rollout_pct=0, enabled=True):
    return client.post(
        FLAGS + "/",
        json={
            "flag_key": flag_key,
            "description": "target flag",
            "rollout_pct": rollout_pct,
            "enabled": enabled,
        },
    )


def _create_segment(segment_id="beta_users", user_ids=None, enabled=True):
    return client.post(
        SEGMENTS + "/",
        json={
            "id": segment_id,
            "name": "Beta users",
            "description": "manual beta segment",
            "source": "manual",
            "enabled": enabled,
            "user_ids": user_ids or [],
        },
    )


def _decide(flag_key, user_id):
    return client.get(f"{FLAGS}/decide", params={"flag_key": flag_key, "user_id": user_id})


class TestSegments:
    def test_create_list_refresh_and_members_manual_segment(self):
        created = _create_segment("manual_users", ["user-2", "user-1", "user-1"])
        assert created.status_code == 201
        body = created.json()
        assert body["id"] == "manual_users"
        assert body["member_count"] == 2

        listed = client.get(SEGMENTS + "/")
        assert listed.status_code == 200
        assert listed.json()[0]["id"] == "manual_users"

        members = client.get(f"{SEGMENTS}/manual_users/members", params={"limit": 10})
        assert members.status_code == 200
        assert [m["user_id"] for m in members.json()] == ["user-1", "user-2"]

        refreshed = client.post(
            f"{SEGMENTS}/manual_users/refresh",
            json={"user_ids": ["user-3"], "reason": "manual update"},
        )
        assert refreshed.status_code == 200
        assert refreshed.json()["refreshed_count"] == 1

        members = client.get(f"{SEGMENTS}/manual_users/members")
        assert [m["user_id"] for m in members.json()] == ["user-3"]
        assert members.json()[0]["reason"] == "manual update"

    def test_query_backed_segment_is_explicitly_unsupported(self):
        resp = client.post(
            SEGMENTS + "/",
            json={
                "id": "project_members",
                "name": "Project members",
                "source": "query",
                "query_name": "project_members",
            },
        )
        assert resp.status_code == 501
        assert "not supported yet" in resp.json()["detail"]


class TestFeatureFlagRules:
    def test_create_list_and_patch_rule(self):
        assert _create_flag("rule_flag").status_code == 201
        assert _create_segment("rule_segment", ["user-1"]).status_code == 201

        created = client.post(
            f"{FLAGS}/rule_flag/rules",
            json={
                "id": "beta_rule",
                "priority": 10,
                "segment_id": "rule_segment",
                "rollout_pct": 100,
                "variant": "beta",
                "enabled": True,
            },
        )
        assert created.status_code == 201
        assert created.json()["id"] == "beta_rule"

        listed = client.get(f"{FLAGS}/rule_flag/rules")
        assert listed.status_code == 200
        assert [r["id"] for r in listed.json()] == ["beta_rule"]

        patched = client.patch(f"{FLAGS}/rule_flag/rules/beta_rule", json={"priority": 20, "enabled": False})
        assert patched.status_code == 200
        assert patched.json()["priority"] == 20
        assert patched.json()["enabled"] is False

    def test_create_rule_requires_existing_segment(self):
        assert _create_flag("missing_segment_flag").status_code == 201
        resp = client.post(
            f"{FLAGS}/missing_segment_flag/rules",
            json={"id": "missing_seg_rule", "segment_id": "no_segment"},
        )
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Segment not found"


class TestRuleBasedDecide:
    def test_disabled_flag_returns_control_even_when_rule_matches(self):
        assert _create_flag("disabled_with_rule", rollout_pct=100, enabled=False).status_code == 201
        assert _create_segment("disabled_segment", ["user-1"]).status_code == 201
        assert client.post(
            f"{FLAGS}/disabled_with_rule/rules",
            json={"id": "disabled_rule", "segment_id": "disabled_segment", "rollout_pct": 100, "variant": "beta"},
        ).status_code == 201

        resp = _decide("disabled_with_rule", "user-1")
        assert resp.status_code == 200
        assert resp.json()["data"]["variant"] == "control"

    def test_first_matching_rule_by_priority_wins(self):
        assert _create_flag("priority_flag", rollout_pct=0, enabled=True).status_code == 201
        assert _create_segment("priority_segment", ["user-1"]).status_code == 201
        assert client.post(
            f"{FLAGS}/priority_flag/rules",
            json={"id": "later_rule", "priority": 20, "segment_id": "priority_segment", "rollout_pct": 100, "variant": "later"},
        ).status_code == 201
        assert client.post(
            f"{FLAGS}/priority_flag/rules",
            json={"id": "first_rule", "priority": 10, "segment_id": "priority_segment", "rollout_pct": 100, "variant": "first"},
        ).status_code == 201

        resp = _decide("priority_flag", "user-1")
        assert resp.status_code == 200
        assert resp.json()["data"]["variant"] == "first"

    def test_rule_requires_segment_membership_and_falls_back_to_flag_rollout(self):
        assert _create_flag("fallback_flag", rollout_pct=100, enabled=True).status_code == 201
        assert _create_segment("fallback_segment", ["user-in"]).status_code == 201
        assert client.post(
            f"{FLAGS}/fallback_flag/rules",
            json={"id": "members_only", "segment_id": "fallback_segment", "rollout_pct": 100, "variant": "member_variant"},
        ).status_code == 201

        member = _decide("fallback_flag", "user-in")
        outsider = _decide("fallback_flag", "user-out")
        assert member.json()["data"]["variant"] == "member_variant"
        assert outsider.json()["data"]["variant"] == "treatment"

    def test_rule_requires_enabled_segment(self):
        assert _create_flag("disabled_segment_flag", rollout_pct=100, enabled=True).status_code == 201
        assert _create_segment("off_segment", ["user-1"], enabled=False).status_code == 201
        assert client.post(
            f"{FLAGS}/disabled_segment_flag/rules",
            json={"id": "off_segment_rule", "segment_id": "off_segment", "rollout_pct": 100, "variant": "beta"},
        ).status_code == 400

    def test_rule_rollout_uses_rule_id_hash_and_can_return_control(self):
        assert _create_flag("rule_rollout_flag", rollout_pct=100, enabled=True).status_code == 201
        assert _create_segment("rule_rollout_segment", ["user-1"]).status_code == 201
        assert client.post(
            f"{FLAGS}/rule_rollout_flag/rules",
            json={"id": "zero_rule", "segment_id": "rule_rollout_segment", "rollout_pct": 0, "variant": "beta"},
        ).status_code == 201

        resp = _decide("rule_rollout_flag", "user-1")
        assert resp.status_code == 200
        assert resp.json()["data"]["variant"] == "control"

    def test_rule_time_window_is_respected(self):
        assert _create_flag("window_flag", rollout_pct=0, enabled=True).status_code == 201
        assert _create_segment("window_segment", ["user-1"]).status_code == 201
        future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        assert client.post(
            f"{FLAGS}/window_flag/rules",
            json={
                "id": "future_rule",
                "segment_id": "window_segment",
                "rollout_pct": 100,
                "variant": "future",
                "starts_at": future,
            },
        ).status_code == 201

        resp = _decide("window_flag", "user-1")
        assert resp.status_code == 200
        assert resp.json()["data"]["variant"] == "control"

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
    def test_list_query_templates(self):
        resp = client.get(f"{SEGMENTS}/query-templates")
        assert resp.status_code == 200
        templates = {item["query_name"]: item for item in resp.json()}
        assert "project_members" in templates
        assert "discord_active_users" in templates
        assert templates["discord_active_users"]["rules_schema"]["active_days"]["default"] == 30

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

    def test_query_backed_segment_refreshes_from_allowlisted_d1_template(self, mock_d1):
        mock_d1.executescript(
            """
            CREATE TABLE dl_project_members (
                user_id TEXT,
                project_id TEXT
            );
            INSERT INTO dl_project_members (user_id, project_id) VALUES
                ('user-2', 'project-a'),
                ('user-1', 'project-a'),
                ('user-1', 'project-b'),
                (NULL, 'project-a');
            """
        )

        resp = client.post(
            SEGMENTS + "/",
            json={
                "id": "project_members",
                "name": "Project members",
                "source": "query",
                "query_name": "project_members",
            },
        )
        assert resp.status_code == 201
        assert resp.json()["member_count"] == 0

        refreshed = client.post(f"{SEGMENTS}/project_members/refresh")
        assert refreshed.status_code == 200
        assert refreshed.json()["refreshed_count"] == 2

        members = client.get(f"{SEGMENTS}/project_members/members")
        assert [m["user_id"] for m in members.json()] == ["user-1", "user-2"]

    def test_query_backed_discord_active_users_respects_active_days_rule(self, mock_d1):
        mock_d1.executescript(
            """
            CREATE TABLE discord_messages (
                author_id TEXT,
                created_at TEXT
            );
            INSERT INTO discord_messages (author_id, created_at) VALUES
                ('recent-user', datetime('now', '-3 days')),
                ('old-user', datetime('now', '-20 days')),
                (NULL, datetime('now', '-1 day'));
            """
        )

        resp = client.post(
            SEGMENTS + "/",
            json={
                "id": "discord_recent",
                "name": "Discord recent users",
                "source": "query",
                "query_name": "discord_active_users",
                "rules_json": '{"active_days": 7}',
            },
        )
        assert resp.status_code == 201

        refreshed = client.post(f"{SEGMENTS}/discord_recent/refresh")
        assert refreshed.status_code == 200
        assert refreshed.json()["refreshed_count"] == 1

        members = client.get(f"{SEGMENTS}/discord_recent/members")
        assert [m["user_id"] for m in members.json()] == ["recent-user"]
        assert members.json()[0]["reason"] == "query:discord_active_users"

    def test_query_backed_segment_rejects_manual_user_ids(self):
        resp = client.post(
            SEGMENTS + "/",
            json={
                "id": "query_with_users",
                "name": "Query with users",
                "source": "query",
                "query_name": "project_members",
                "user_ids": ["user-1"],
            },
        )
        assert resp.status_code == 400
        assert "must not set user_ids" in resp.json()["detail"]

    def test_query_backed_segment_rejects_invalid_rules_json(self):
        resp = client.post(
            SEGMENTS + "/",
            json={
                "id": "bad_rules",
                "name": "Bad rules",
                "source": "query",
                "query_name": "discord_active_users",
                "rules_json": '{"active_days": 0}',
            },
        )
        assert resp.status_code == 400
        assert "between 1 and 365" in resp.json()["detail"]

    def test_query_backed_refresh_requires_main_database_id(self, mock_d1, monkeypatch):
        mock_d1.executescript(
            """
            CREATE TABLE dl_project_members (
                user_id TEXT,
                project_id TEXT
            );
            INSERT INTO dl_project_members (user_id, project_id) VALUES ('user-1', 'project-a');
            """
        )

        resp = client.post(
            SEGMENTS + "/",
            json={
                "id": "main_db_required",
                "name": "Main DB required",
                "source": "query",
                "query_name": "project_members",
            },
        )
        assert resp.status_code == 201

        monkeypatch.delenv("D1_MAIN_DATABASE_ID")
        refreshed = client.post(f"{SEGMENTS}/main_db_required/refresh")
        assert refreshed.status_code == 503
        assert refreshed.json()["detail"] == "D1_MAIN_DATABASE_ID is required for query-backed segment refresh"

    def test_query_backed_segment_rejects_unknown_template(self):
        resp = client.post(
            SEGMENTS + "/",
            json={
                "id": "unknown_query",
                "name": "Unknown query",
                "source": "query",
                "query_name": "not_registered",
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

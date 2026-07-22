from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)
BASE = "/api/v1/access/decide"
TOKEN = "pk_live_lvup_access_test"
AUTH = {"Authorization": f"Bearer {TOKEN}"}


def _seed_project(mock_d1, project_id="lvup", api_key=TOKEN):
    mock_d1.execute(
        "INSERT INTO projects (id, name, api_key) VALUES (?, ?, ?)",
        (project_id, project_id.upper(), api_key),
    )
    mock_d1.commit()


def _seed_policy(mock_d1, payload, *, enabled=True, project_id="lvup", flag_key="network_access"):
    import json

    mock_d1.execute(
        """INSERT INTO feature_flag
           (flag_key, rollout_pct, enabled, project_id, payload_json, created_at, updated_at)
           VALUES (?, 0, ?, ?, ?, '2026-07-23', '2026-07-23')""",
        (flag_key, int(enabled), project_id, json.dumps(payload)),
    )
    mock_d1.commit()


def _seed_committee(mock_d1, user_ids=("committee-user",), enabled=True):
    mock_d1.execute(
        """INSERT INTO feature_segment
           (id, name, source, enabled, created_at, updated_at)
           VALUES ('sudocon_committee', 'Sudocon committee', 'manual', ?, '2026-07-23', '2026-07-23')""",
        (int(enabled),),
    )
    for user_id in user_ids:
        mock_d1.execute(
            """INSERT INTO feature_segment_member (segment_id, user_id, reason, refreshed_at)
               VALUES ('sudocon_committee', ?, 'test', '2026-07-23')""",
            (user_id,),
        )
    mock_d1.commit()


def _decide(user_id="user-1", route="/events/pseudocon-2026/networking", headers=AUTH):
    return client.post(
        BASE,
        headers=headers,
        json={"user_id": user_id, "flag_key": "network_access", "route": route},
    )


class TestAccessDecisionAuthentication:
    def test_missing_bearer_token_returns_401(self):
        response = _decide(headers={})
        assert response.status_code == 401
        assert response.headers["www-authenticate"] == "Bearer"

    def test_wrong_auth_scheme_returns_401(self):
        response = _decide(headers={"Authorization": f"Basic {TOKEN}"})
        assert response.status_code == 401

    def test_invalid_bearer_token_returns_401(self, mock_d1):
        _seed_project(mock_d1)
        response = _decide(headers={"Authorization": "Bearer invalid"})
        assert response.status_code == 401


class TestAccessDecisionModes:
    def test_private_blocks_every_authenticated_user(self, mock_d1):
        _seed_project(mock_d1)
        _seed_policy(mock_d1, {"access_mode": "private"})

        response = _decide()

        assert response.status_code == 200
        assert response.json() == {
            "allow": False,
            "access_mode": "private",
            "reason": "access_mode_private",
        }

    def test_committee_allows_segment_member(self, mock_d1):
        _seed_project(mock_d1)
        _seed_committee(mock_d1)
        _seed_policy(
            mock_d1,
            {"access_mode": "committee", "committee_segment_id": "sudocon_committee"},
        )

        response = _decide(user_id="committee-user")

        assert response.json() == {
            "allow": True,
            "access_mode": "committee",
            "reason": "allowed_committee",
        }

    def test_committee_blocks_non_member(self, mock_d1):
        _seed_project(mock_d1)
        _seed_committee(mock_d1)
        _seed_policy(
            mock_d1,
            {"access_mode": "committee", "committee_segment_id": "sudocon_committee"},
        )

        response = _decide(user_id="general-user")

        assert response.json() == {
            "allow": False,
            "access_mode": "committee",
            "reason": "not_committee",
        }

    def test_public_allows_authenticated_user(self, mock_d1):
        _seed_project(mock_d1)
        _seed_policy(mock_d1, {"access_mode": "public"})

        response = _decide()

        assert response.json() == {
            "allow": True,
            "access_mode": "public",
            "reason": "allowed_public",
        }

    def test_missing_user_is_fail_closed(self, mock_d1):
        _seed_project(mock_d1)
        _seed_policy(mock_d1, {"access_mode": "public"})

        response = _decide(user_id="  ")

        assert response.json() == {
            "allow": False,
            "access_mode": "private",
            "reason": "not_authenticated",
        }


class TestAccessDecisionSafety:
    def test_unknown_policy_is_fail_closed(self, mock_d1):
        _seed_project(mock_d1)
        response = _decide()
        assert response.status_code == 200
        assert response.json()["reason"] == "evaluation_error"
        assert response.json()["allow"] is False

    def test_policy_must_belong_to_authenticated_project(self, mock_d1):
        _seed_project(mock_d1)
        _seed_policy(mock_d1, {"access_mode": "public"}, project_id=None)
        response = _decide()
        assert response.json()["reason"] == "evaluation_error"
        assert response.json()["allow"] is False

    def test_invalid_mode_is_fail_closed(self, mock_d1):
        _seed_project(mock_d1)
        _seed_policy(mock_d1, {"access_mode": "everyone"})
        response = _decide()
        assert response.json()["reason"] == "evaluation_error"
        assert response.json()["access_mode"] == "private"

    def test_missing_or_disabled_committee_segment_is_fail_closed(self, mock_d1):
        _seed_project(mock_d1)
        _seed_policy(
            mock_d1,
            {"access_mode": "committee", "committee_segment_id": "missing_segment"},
        )
        response = _decide(user_id="committee-user")
        assert response.json()["reason"] == "evaluation_error"
        assert response.json()["allow"] is False

    def test_configured_route_must_match(self, mock_d1):
        _seed_project(mock_d1)
        _seed_policy(
            mock_d1,
            {
                "access_mode": "public",
                "routes": ["/events/pseudocon-2026/networking"],
            },
        )
        response = _decide(route="/admin")
        assert response.json()["reason"] == "evaluation_error"
        assert response.json()["allow"] is False

    def test_storage_exception_is_fail_closed(self, mock_d1, monkeypatch):
        _seed_project(mock_d1)

        async def raise_storage_error(*args, **kwargs):
            raise RuntimeError("storage unavailable")

        monkeypatch.setattr("app.services.access.feature_flag_service.get", raise_storage_error)
        response = _decide()
        assert response.status_code == 200
        assert response.json() == {
            "allow": False,
            "access_mode": "private",
            "reason": "evaluation_error",
        }

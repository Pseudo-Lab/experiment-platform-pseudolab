import json
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.services.project_reflection_banner import EXPERIMENT_ID


client = TestClient(app)

BASE = "/api/v1/project-reflection-banner/decide"
CAPTURE = "/api/v1/capture"


def _iso(days_from_now: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days_from_now)).isoformat()


def _create_source_tables(conn):
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS dl_projects (
            id          TEXT,
            title       TEXT,
            cohort      TEXT,
            status      TEXT,
            base_date   TEXT,
            load_dt     TEXT
        );

        CREATE TABLE IF NOT EXISTS dl_project_members (
            id              TEXT,
            project_id      TEXT,
            user_id         TEXT,
            role            TEXT,
            attendance_rate REAL,
            joined_at       TEXT,
            status          TEXT,
            base_date       TEXT,
            load_dt         TEXT
        );
        """
    )
    conn.commit()


def _insert_experiment(conn, start_days=-1, window_days=7, status="running", config_enabled=True):
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """INSERT INTO experiments
           (id, name, hypothesis, status, reflection_start_date, reflection_window_days, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        [
            EXPERIMENT_ID,
            "LVUP 12기 중간 회고 배너",
            "회고 배너 노출은 제출을 늘린다.",
            status,
            _iso(start_days) if start_days is not None else None,
            window_days,
            now,
            now,
        ],
    )
    conn.execute(
        """INSERT INTO project_reflection_banner_config
           (experiment_id, banner_id, title, description, target_url, source, enabled, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [
            EXPERIMENT_ID,
            "s12-mid-reflection-banner",
            "중간 회고 작성하기",
            "지금까지의 여정을 정리하고 남은 기간 방향을 잡아봐요",
            "/reflection/s12-mid-reflection",
            "project_detail_home",
            1 if config_enabled else 0,
            now,
            now,
        ],
    )
    conn.commit()


def _insert_project(conn, project_id="project-s12", cohort="12", status="active", base_date="2026-05-20"):
    _create_source_tables(conn)
    conn.execute(
        """INSERT INTO dl_projects (id, title, cohort, status, base_date, load_dt)
           VALUES (?, ?, ?, ?, ?, ?)""",
        [project_id, "S12 project", cohort, status, base_date, f"{base_date}T00:00:00Z"],
    )
    conn.commit()


def _insert_member(
    conn,
    project_id="project-s12",
    user_id="user-runner",
    role="runner",
    status="active",
    base_date="2026-05-20",
):
    _create_source_tables(conn)
    conn.execute(
        """INSERT INTO dl_project_members
           (id, project_id, user_id, role, attendance_rate, joined_at, status, base_date, load_dt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [
            f"{project_id}:{user_id}:{role}",
            project_id,
            user_id,
            role,
            1.0,
            f"{base_date}T00:00:00Z",
            status,
            base_date,
            f"{base_date}T00:00:00Z",
        ],
    )
    conn.commit()


def _decide(user_id="user-runner", project_id="project-s12", **params):
    query = {"project_id": project_id, **params}
    if user_id is not None:
        query["user_id"] = user_id
    return client.get(BASE, params=query)


class TestProjectReflectionBannerDecide:
    def test_eligible_returns_banner_payload(self, mock_d1):
        _insert_experiment(mock_d1)
        _insert_project(mock_d1)
        _insert_member(mock_d1)

        resp = _decide()

        assert resp.status_code == 200
        body = resp.json()
        assert body["show"] is True
        assert body["reason"] == "eligible"
        assert body["submitted"] is False
        assert body["experiment_id"] == "s12-mid-reflection"
        assert body["banner_id"] == "s12-mid-reflection-banner"
        assert body["target_url"] == "/reflection/s12-mid-reflection"
        assert body["logging_context"] == {
            "experiment_id": "s12-mid-reflection",
            "banner_id": "s12-mid-reflection-banner",
            "project_id": "project-s12",
            "project_cohort": "12",
            "user_project_role": "runner",
            "source": "project_detail_home",
        }

    def test_missing_user_returns_not_authenticated(self, mock_d1):
        _insert_experiment(mock_d1)
        _insert_project(mock_d1)

        resp = _decide(user_id=None)

        assert resp.status_code == 200
        assert resp.json() == {
            "show": False,
            "reason": "not_authenticated",
            "submitted": False,
            "experiment_id": None,
            "banner_id": None,
            "title": None,
            "description": None,
            "target_url": None,
            "logging_context": None,
        }

    def test_missing_experiment_returns_experiment_not_found(self, mock_d1):
        _insert_project(mock_d1)
        _insert_member(mock_d1)

        resp = _decide()

        assert resp.status_code == 200
        assert resp.json()["reason"] == "experiment_not_found"

    def test_non_s12_project_returns_not_s12_project(self, mock_d1):
        _insert_experiment(mock_d1)
        _insert_project(mock_d1, cohort="11")
        _insert_member(mock_d1)

        resp = _decide()

        assert resp.status_code == 200
        assert resp.json()["reason"] == "not_s12_project"

    def test_missing_membership_returns_not_project_member(self, mock_d1):
        _insert_experiment(mock_d1)
        _insert_project(mock_d1)

        resp = _decide()

        assert resp.status_code == 200
        assert resp.json()["reason"] == "not_project_member"

    def test_unsupported_role_returns_unsupported_role(self, mock_d1):
        _insert_experiment(mock_d1)
        _insert_project(mock_d1)
        _insert_member(mock_d1, role="member")

        resp = _decide()

        assert resp.status_code == 200
        assert resp.json()["reason"] == "unsupported_role"

    def test_inactive_membership_returns_inactive_membership(self, mock_d1):
        _insert_experiment(mock_d1)
        _insert_project(mock_d1)
        _insert_member(mock_d1, role="runner", status="claiming")

        resp = _decide()

        assert resp.status_code == 200
        assert resp.json()["reason"] == "inactive_membership"

    def test_outside_window_returns_outside_reflection_window(self, mock_d1):
        _insert_experiment(mock_d1, start_days=-10, window_days=2)
        _insert_project(mock_d1)
        _insert_member(mock_d1)

        resp = _decide()

        assert resp.status_code == 200
        assert resp.json()["reason"] == "outside_reflection_window"

    def test_paused_experiment_returns_outside_reflection_window(self, mock_d1):
        _insert_experiment(mock_d1, status="paused")
        _insert_project(mock_d1)
        _insert_member(mock_d1)

        resp = _decide()

        assert resp.status_code == 200
        assert resp.json()["reason"] == "outside_reflection_window"

    def test_disabled_banner_config_returns_outside_reflection_window(self, mock_d1):
        _insert_experiment(mock_d1, config_enabled=False)
        _insert_project(mock_d1)
        _insert_member(mock_d1)

        resp = _decide()

        assert resp.status_code == 200
        assert resp.json()["reason"] == "outside_reflection_window"

    def test_submitted_user_returns_completed_banner_state(self, mock_d1):
        _insert_experiment(mock_d1)
        _insert_project(mock_d1)
        _insert_member(mock_d1)
        now = datetime.now(timezone.utc).isoformat()
        mock_d1.execute(
            """INSERT INTO reflection
               (id, experiment_id, user_id, project_id, project_type, completed_at, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            ["reflection-1", EXPERIMENT_ID, "user-runner", "project-s12", "research", now, now],
        )
        mock_d1.commit()

        resp = _decide()

        assert resp.status_code == 200
        body = resp.json()
        assert body["show"] is True
        assert body["reason"] == "already_submitted"
        assert body["submitted"] is True
        assert body["target_url"] == "/reflection/s12-mid-reflection"

    def test_scenario_override_is_disabled_by_default(self):
        resp = _decide(scenario="eligible")

        assert resp.status_code == 400
        assert resp.json()["detail"] == "scenario override is disabled"

    def test_scenario_override_can_force_eligible(self, monkeypatch):
        monkeypatch.setattr(settings, "REFLECTION_BANNER_SCENARIO_OVERRIDE_ENABLED", True)

        resp = _decide(project_id="sandbox-project", scenario="eligible")

        assert resp.status_code == 200
        assert resp.json()["show"] is True
        assert resp.json()["logging_context"]["project_id"] == "sandbox-project"

    def test_scenario_override_can_force_already_submitted_state(self, monkeypatch):
        monkeypatch.setattr(settings, "REFLECTION_BANNER_SCENARIO_OVERRIDE_ENABLED", True)

        resp = _decide(project_id="sandbox-project", scenario="already_submitted")

        assert resp.status_code == 200
        body = resp.json()
        assert body["show"] is True
        assert body["reason"] == "already_submitted"
        assert body["submitted"] is True
        assert body["logging_context"]["project_id"] == "sandbox-project"

    def test_scenario_override_can_force_server_error(self, monkeypatch):
        monkeypatch.setattr(settings, "REFLECTION_BANNER_SCENARIO_OVERRIDE_ENABLED", True)

        resp = _decide(scenario="server_error")

        assert resp.status_code == 500
        assert resp.json()["detail"] == "forced server_error scenario"


class TestProjectReflectionBannerCapture:
    def test_capture_accepts_project_reflection_banner_events(self, mock_d1):
        payload = {
            "user_id": "user-runner",
            "event_name": "project_reflection_banner_viewed",
            "properties": {
                "experiment_id": "s12-mid-reflection",
                "banner_id": "s12-mid-reflection-banner",
                "project_id": "project-s12",
                "project_cohort": "12",
                "user_project_role": "runner",
                "source": "project_detail_home",
            },
        }

        resp = client.post(CAPTURE, json=payload)

        assert resp.status_code == 202
        rows = mock_d1.execute("SELECT event_name, properties FROM event_log WHERE user_id = ?", ["user-runner"]).fetchall()
        assert rows[0]["event_name"] == "project_reflection_banner_viewed"
        assert json.loads(rows[0]["properties"])["banner_id"] == "s12-mid-reflection-banner"


class TestProjectReflectionBannerConfig:
    def test_get_config(self, mock_d1):
        _insert_experiment(mock_d1)

        resp = client.get(f"/api/v1/project-reflection-banner/config/{EXPERIMENT_ID}")

        assert resp.status_code == 200
        body = resp.json()
        assert body["experiment_id"] == EXPERIMENT_ID
        assert body["title"] == "중간 회고 작성하기"
        assert body["enabled"] is True

    def test_patch_config_updates_decide_payload(self, mock_d1):
        _insert_experiment(mock_d1)
        _insert_project(mock_d1)
        _insert_member(mock_d1)

        patched = client.patch(
            f"/api/v1/project-reflection-banner/config/{EXPERIMENT_ID}",
            json={
                "title": "회고 남기기",
                "description": "이번 주 회고를 작성해주세요",
                "target_url": "/reflection/custom",
            },
        )
        assert patched.status_code == 200
        assert patched.json()["title"] == "회고 남기기"

        decided = _decide()
        assert decided.status_code == 200
        assert decided.json()["title"] == "회고 남기기"
        assert decided.json()["description"] == "이번 주 회고를 작성해주세요"
        assert decided.json()["target_url"] == "/reflection/custom"

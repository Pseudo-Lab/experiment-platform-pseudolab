import json
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.services.experiment_placement import DEFAULT_EXPERIMENT_ID, DEFAULT_PLACEMENT_KEY


client = TestClient(app)

EXPERIMENT_ID = DEFAULT_EXPERIMENT_ID
PLACEMENT_KEY = DEFAULT_PLACEMENT_KEY
BASE = f"/api/v1/experiments/{EXPERIMENT_ID}/placements/{PLACEMENT_KEY}/decide"
PLACEMENT_ONLY_BASE = f"/api/v1/placements/{PLACEMENT_KEY}/decide"
CONFIG_BASE = f"/api/v1/experiments/{EXPERIMENT_ID}/placements/{PLACEMENT_KEY}/config"
LIST_BASE = f"/api/v1/experiments/{EXPERIMENT_ID}/placements"
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


def _insert_experiment(
    conn,
    experiment_id=EXPERIMENT_ID,
    placement_key=PLACEMENT_KEY,
    start_days=-1,
    window_days=7,
    status="running",
    config_enabled=True,
    ui_id="s12-mid-reflection-banner",
    target_url="/reflection/s12-mid-reflection",
):
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """INSERT INTO experiments
           (id, name, hypothesis, status, reflection_start_date, reflection_window_days, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        [
            experiment_id,
            "LVUP 12기 중간 회고 UI 노출",
            "회고 진입 UI 노출은 제출을 늘린다.",
            status,
            _iso(start_days) if start_days is not None else None,
            window_days,
            now,
            now,
        ],
    )
    conn.execute(
        """INSERT INTO experiment_placement_config
           (experiment_id, placement_key, ui_id, ui_type, title, description, target_url, source,
            target_cohort, allowed_roles, enabled, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [
            experiment_id,
            placement_key,
            ui_id,
            "banner",
            "중간 회고 작성하기",
            "지금까지의 여정을 정리하고 남은 기간 방향을 잡아봐요",
            target_url,
            "project_detail_home",
            "12",
            json.dumps(["builder", "runner"]),
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


def _decide_by_placement(user_id="user-runner", project_id="project-s12"):
    query = {"project_id": project_id}
    if user_id is not None:
        query["user_id"] = user_id
    return client.get(PLACEMENT_ONLY_BASE, params=query)


class TestExperimentPlacementDecide:
    def test_eligible_returns_placement_payload(self, mock_d1):
        _insert_experiment(conn=mock_d1)
        _insert_project(mock_d1)
        _insert_member(mock_d1)

        resp = _decide()

        assert resp.status_code == 200
        body = resp.json()
        assert body["show"] is True
        assert body["reason"] == "eligible"
        assert body["submitted"] is False
        assert body["experiment_id"] == EXPERIMENT_ID
        assert body["placement_key"] == PLACEMENT_KEY
        assert body["ui"] == {
            "id": "s12-mid-reflection-banner",
            "type": "banner",
            "title": "중간 회고 작성하기",
            "description": "지금까지의 여정을 정리하고 남은 기간 방향을 잡아봐요",
            "target_url": "/reflection/s12-mid-reflection",
        }
        assert body["logging_context"] == {
            "experiment_id": EXPERIMENT_ID,
            "placement_key": PLACEMENT_KEY,
            "ui_id": "s12-mid-reflection-banner",
            "ui_type": "banner",
            "project_id": "project-s12",
            "project_cohort": "12",
            "user_project_role": "runner",
            "source": "project_detail_home",
        }

    def test_missing_user_returns_not_authenticated(self, mock_d1):
        _insert_experiment(conn=mock_d1)
        _insert_project(mock_d1)

        resp = _decide(user_id=None)

        assert resp.status_code == 200
        assert resp.json() == {
            "show": False,
            "reason": "not_authenticated",
            "submitted": False,
            "experiment_id": None,
            "placement_key": None,
            "ui": None,
            "logging_context": None,
        }

    def test_missing_experiment_returns_experiment_not_found(self, mock_d1):
        _insert_project(mock_d1)
        _insert_member(mock_d1)

        resp = _decide()

        assert resp.status_code == 200
        assert resp.json()["reason"] == "experiment_not_found"

    def test_missing_placement_returns_placement_not_found(self, mock_d1):
        _insert_experiment(conn=mock_d1)
        _insert_project(mock_d1)
        _insert_member(mock_d1)

        resp = client.get(
            f"/api/v1/experiments/{EXPERIMENT_ID}/placements/missing-placement/decide",
            params={"user_id": "user-runner", "project_id": "project-s12"},
        )

        assert resp.status_code == 200
        assert resp.json()["reason"] == "placement_not_found"

    def test_non_target_cohort_returns_not_target_cohort(self, mock_d1):
        _insert_experiment(conn=mock_d1)
        _insert_project(mock_d1, cohort="11")
        _insert_member(mock_d1)

        resp = _decide()

        assert resp.status_code == 200
        assert resp.json()["reason"] == "not_target_cohort"

    def test_missing_membership_returns_not_project_member(self, mock_d1):
        _insert_experiment(conn=mock_d1)
        _insert_project(mock_d1)

        resp = _decide()

        assert resp.status_code == 200
        assert resp.json()["reason"] == "not_project_member"

    def test_unsupported_role_returns_unsupported_role(self, mock_d1):
        _insert_experiment(conn=mock_d1)
        _insert_project(mock_d1)
        _insert_member(mock_d1, role="member")

        resp = _decide()

        assert resp.status_code == 200
        assert resp.json()["reason"] == "unsupported_role"

    def test_inactive_membership_returns_inactive_membership(self, mock_d1):
        _insert_experiment(conn=mock_d1)
        _insert_project(mock_d1)
        _insert_member(mock_d1, role="runner", status="claiming")

        resp = _decide()

        assert resp.status_code == 200
        assert resp.json()["reason"] == "inactive_membership"

    def test_outside_window_returns_outside_exposure_window(self, mock_d1):
        _insert_experiment(conn=mock_d1, start_days=-10, window_days=2)
        _insert_project(mock_d1)
        _insert_member(mock_d1)

        resp = _decide()

        assert resp.status_code == 200
        assert resp.json()["reason"] == "outside_exposure_window"

    def test_paused_experiment_returns_outside_exposure_window(self, mock_d1):
        _insert_experiment(conn=mock_d1, status="paused")
        _insert_project(mock_d1)
        _insert_member(mock_d1)

        resp = _decide()

        assert resp.status_code == 200
        assert resp.json()["reason"] == "outside_exposure_window"

    def test_disabled_placement_config_returns_outside_exposure_window(self, mock_d1):
        _insert_experiment(conn=mock_d1, config_enabled=False)
        _insert_project(mock_d1)
        _insert_member(mock_d1)

        resp = _decide()

        assert resp.status_code == 200
        assert resp.json()["reason"] == "outside_exposure_window"

    def test_submitted_user_returns_completed_ui_state(self, mock_d1):
        _insert_experiment(conn=mock_d1)
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
        assert body["ui"]["target_url"] == "/reflection/s12-mid-reflection"

    def test_scenario_override_is_disabled_by_default(self):
        resp = _decide(scenario="eligible")

        assert resp.status_code == 400
        assert resp.json()["detail"] == "scenario override is disabled"

    def test_scenario_override_can_force_eligible(self, monkeypatch):
        monkeypatch.setattr(settings, "EXPERIMENT_PLACEMENT_SCENARIO_OVERRIDE_ENABLED", True)

        resp = _decide(project_id="sandbox-project", scenario="eligible")

        assert resp.status_code == 200
        assert resp.json()["show"] is True
        assert resp.json()["logging_context"]["project_id"] == "sandbox-project"
        assert resp.json()["placement_key"] == PLACEMENT_KEY

    def test_scenario_override_can_force_already_submitted_state(self, monkeypatch):
        monkeypatch.setattr(settings, "EXPERIMENT_PLACEMENT_SCENARIO_OVERRIDE_ENABLED", True)

        resp = _decide(project_id="sandbox-project", scenario="already_submitted")

        assert resp.status_code == 200
        body = resp.json()
        assert body["show"] is True
        assert body["reason"] == "already_submitted"
        assert body["submitted"] is True
        assert body["logging_context"]["project_id"] == "sandbox-project"

    def test_scenario_override_can_force_server_error(self, monkeypatch):
        monkeypatch.setattr(settings, "EXPERIMENT_PLACEMENT_SCENARIO_OVERRIDE_ENABLED", True)

        resp = _decide(scenario="server_error")

        assert resp.status_code == 500
        assert resp.json()["detail"] == "forced server_error scenario"


class TestPlacementOnlyDecide:
    def test_resolves_active_experiment_by_placement(self, mock_d1):
        _insert_experiment(conn=mock_d1)
        _insert_project(mock_d1)
        _insert_member(mock_d1)

        resp = _decide_by_placement()

        assert resp.status_code == 200
        body = resp.json()
        assert body["show"] is True
        assert body["reason"] == "eligible"
        assert body["submitted"] is False
        assert body["experiment_id"] == EXPERIMENT_ID
        assert body["placement_key"] == PLACEMENT_KEY
        assert body["logging_context"]["experiment_id"] == EXPERIMENT_ID
        assert body["logging_context"]["placement_key"] == PLACEMENT_KEY

    def test_returns_placement_not_found_when_no_config_uses_placement(self, mock_d1):
        resp = client.get(
            "/api/v1/placements/missing-placement/decide",
            params={"user_id": "user-runner", "project_id": "project-s12"},
        )

        assert resp.status_code == 200
        assert resp.json()["reason"] == "placement_not_found"

    def test_returns_outside_window_when_placement_has_no_active_experiment(self, mock_d1):
        _insert_experiment(conn=mock_d1, status="paused")

        resp = _decide_by_placement()

        assert resp.status_code == 200
        assert resp.json()["reason"] == "outside_exposure_window"

    def test_chooses_latest_active_experiment_for_placement(self, mock_d1):
        _insert_experiment(
            conn=mock_d1,
            experiment_id="older-reflection",
            start_days=-3,
            ui_id="older-reflection-banner",
            target_url="/reflection/older",
        )
        _insert_experiment(
            conn=mock_d1,
            experiment_id="newer-reflection",
            start_days=-1,
            ui_id="newer-reflection-banner",
            target_url="/reflection/newer",
        )
        _insert_project(mock_d1)
        _insert_member(mock_d1)

        resp = _decide_by_placement()

        assert resp.status_code == 200
        body = resp.json()
        assert body["experiment_id"] == "newer-reflection"
        assert body["ui"]["id"] == "newer-reflection-banner"
        assert body["ui"]["target_url"] == "/reflection/newer"


class TestExperimentPlacementCapture:
    def test_capture_accepts_project_reflection_events(self, mock_d1):
        payload = {
            "user_id": "user-runner",
            "event_name": "project_reflection_ui_viewed",
            "properties": {
                "experiment_id": EXPERIMENT_ID,
                "placement_key": PLACEMENT_KEY,
                "ui_id": "s12-mid-reflection-banner",
                "ui_type": "banner",
                "project_id": "project-s12",
                "project_cohort": "12",
                "user_project_role": "runner",
                "source": "project_detail_home",
            },
        }

        resp = client.post(CAPTURE, json=payload)

        assert resp.status_code == 202
        rows = mock_d1.execute("SELECT event_name, properties FROM event_log WHERE user_id = ?", ["user-runner"]).fetchall()
        assert rows[0]["event_name"] == "project_reflection_ui_viewed"
        assert json.loads(rows[0]["properties"])["placement_key"] == PLACEMENT_KEY


class TestExperimentPlacementConfig:
    def test_create_config(self, mock_d1):
        _insert_experiment(conn=mock_d1)

        resp = client.post(
            LIST_BASE,
            json={
                "placement_key": "project-sidebar-reflection-cta",
                "ui_id": "s12-sidebar-reflection",
                "ui_type": "card",
                "title": "사이드바 회고",
                "description": "프로젝트 사이드바 회고 진입점",
                "target_url": "/reflection/sidebar",
                "source": "project_sidebar",
                "target_cohort": "12",
                "allowed_roles": ["builder"],
                "enabled": False,
            },
        )

        assert resp.status_code == 201
        body = resp.json()
        assert body["placement_key"] == "project-sidebar-reflection-cta"
        assert body["ui_type"] == "card"
        assert body["allowed_roles"] == ["builder"]
        assert body["enabled"] is False

    def test_create_config_returns_404_for_missing_experiment(self, mock_d1):
        resp = client.post(
            LIST_BASE,
            json={
                "placement_key": "project-sidebar-reflection-cta",
                "ui_id": "s12-sidebar-reflection",
                "title": "사이드바 회고",
                "description": "프로젝트 사이드바 회고 진입점",
                "target_url": "/reflection/sidebar",
            },
        )

        assert resp.status_code == 404
        assert resp.json()["detail"] == "Experiment not found"

    def test_create_config_returns_409_for_duplicate_placement(self, mock_d1):
        _insert_experiment(conn=mock_d1)

        resp = client.post(
            LIST_BASE,
            json={
                "placement_key": PLACEMENT_KEY,
                "ui_id": "duplicate",
                "title": "중복 슬롯",
                "description": "이미 존재하는 슬롯",
                "target_url": "/reflection/duplicate",
            },
        )

        assert resp.status_code == 409
        assert resp.json()["detail"] == "Experiment placement config already exists"

    def test_list_configs(self, mock_d1):
        _insert_experiment(conn=mock_d1)

        resp = client.get(LIST_BASE)

        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 1
        assert body[0]["experiment_id"] == EXPERIMENT_ID
        assert body[0]["placement_key"] == PLACEMENT_KEY
        assert body[0]["allowed_roles"] == ["builder", "runner"]
        assert body[0]["enabled"] is True

    def test_list_configs_returns_empty_list_for_experiment_without_configs(self, mock_d1):
        now = datetime.now(timezone.utc).isoformat()
        mock_d1.execute(
            """INSERT INTO experiments
               (id, name, hypothesis, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            [EXPERIMENT_ID, "No placement experiment", "", "draft", now, now],
        )
        mock_d1.commit()

        resp = client.get(LIST_BASE)

        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_configs_returns_404_for_missing_experiment(self, mock_d1):
        resp = client.get(LIST_BASE)

        assert resp.status_code == 404
        assert resp.json()["detail"] == "Experiment not found"

    def test_get_config(self, mock_d1):
        _insert_experiment(conn=mock_d1)

        resp = client.get(CONFIG_BASE)

        assert resp.status_code == 200
        body = resp.json()
        assert body["experiment_id"] == EXPERIMENT_ID
        assert body["placement_key"] == PLACEMENT_KEY
        assert body["ui_type"] == "banner"
        assert body["title"] == "중간 회고 작성하기"
        assert body["enabled"] is True

    def test_patch_config_updates_decide_payload(self, mock_d1):
        _insert_experiment(conn=mock_d1)
        _insert_project(mock_d1)
        _insert_member(mock_d1)

        patched = client.patch(
            CONFIG_BASE,
            json={
                "ui_type": "card",
                "title": "회고 남기기",
                "description": "이번 주 회고를 작성해주세요",
                "target_url": "/reflection/custom",
            },
        )
        assert patched.status_code == 200
        assert patched.json()["ui_type"] == "card"
        assert patched.json()["title"] == "회고 남기기"

        decided = _decide()
        assert decided.status_code == 200
        assert decided.json()["ui"] == {
            "id": "s12-mid-reflection-banner",
            "type": "card",
            "title": "회고 남기기",
            "description": "이번 주 회고를 작성해주세요",
            "target_url": "/reflection/custom",
        }

    def test_delete_config(self, mock_d1):
        _insert_experiment(conn=mock_d1)

        resp = client.delete(f"/api/v1/experiments/{EXPERIMENT_ID}/placements/{PLACEMENT_KEY}")

        assert resp.status_code == 204
        assert client.get(CONFIG_BASE).status_code == 404

    def test_delete_config_returns_404_for_missing_placement(self, mock_d1):
        _insert_experiment(conn=mock_d1)

        resp = client.delete(f"/api/v1/experiments/{EXPERIMENT_ID}/placements/missing-placement")

        assert resp.status_code == 404
        assert resp.json()["detail"] == "Experiment placement config not found"

from datetime import datetime

from fastapi.testclient import TestClient

from app.api.v1.endpoints import dashboard as dashboard_module
from app.main import app
from app.schemas.experiment import Experiment, ExperimentStatus

client = TestClient(app)


def _clear_dashboard_cache():
    dashboard_module._CACHE.clear()


def test_github_overview_keeps_backward_compatible_merge_rate_key_per_selected_window(monkeypatch):
    _clear_dashboard_cache()

    async def fake_fetch_rows(table: str, window_days: int):
        if table == "dl_push_events":
            return []
        if table == "dl_pull_request_review_events":
            return []
        if table == "dl_issue_comment_events":
            return []
        if table == "dl_pull_request_events":
            if window_days == 7:
                return [
                    {
                        "created_at": "2026-03-10T09:00:00+09:00",
                        "action": "opened",
                        "repo_name": "repo-a",
                        "actor": "alice",
                    }
                ]
            return [
                {
                    "created_at": "2026-03-10T09:00:00+09:00",
                    "action": "opened",
                    "repo_name": "repo-a",
                    "actor": "alice",
                },
                {
                    "created_at": "2026-03-09T09:00:00+09:00",
                    "action": "opened",
                    "repo_name": "repo-a",
                    "actor": "bob",
                },
                {
                    "created_at": "2026-03-09T12:00:00+09:00",
                    "action": "merged",
                    "is_merged": True,
                    "repo_name": "repo-a",
                    "actor": "bob",
                },
            ]
        return []

    monkeypatch.setattr(dashboard_module, "_fetch_rows", fake_fetch_rows)

    response_7d = client.get("/api/v1/dashboard/github/overview?window=7d")
    response_30d = client.get("/api/v1/dashboard/github/overview?window=30d")

    assert response_7d.status_code == 200
    assert response_30d.status_code == 200

    body_7d = response_7d.json()
    body_30d = response_30d.json()

    assert body_7d["summary"]["merge_rate_28d"] == 0
    assert body_30d["summary"]["merge_rate_28d"] == 0.5
    assert len(body_7d["timeseries"]) == 7
    assert len(body_30d["timeseries"]) == 30


def test_github_overview_returns_null_merge_rate_when_opened_count_is_zero(monkeypatch):
    _clear_dashboard_cache()

    async def fake_fetch_rows(table: str, window_days: int):
        if table == "dl_pull_request_events":
            return [
                {
                    "created_at": "2026-03-10T09:00:00+09:00",
                    "action": "merged",
                    "is_merged": True,
                    "repo_name": "repo-a",
                    "actor": "alice",
                }
            ]
        return []

    monkeypatch.setattr(dashboard_module, "_fetch_rows", fake_fetch_rows)

    response = client.get("/api/v1/dashboard/github/overview?window=7d")

    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["pr_opened"] == 0
    assert body["summary"]["pr_merged"] == 1
    assert body["summary"]["merge_rate_28d"] is None
    assert all(point["merge_rate"] is None for point in body["timeseries"])


def test_overview_combines_domain_summaries_using_selected_window(monkeypatch):
    _clear_dashboard_cache()

    async def fake_get_all():
        return [
            Experiment(
                id="exp-1",
                name="Alpha",
                status=ExperimentStatus.RUNNING,
                created_at=datetime.fromisoformat("2026-03-10T00:00:00+09:00"),
                updated_at=datetime.fromisoformat("2026-03-10T00:00:00+09:00"),
            ),
            Experiment(
                id="exp-2",
                name="Beta",
                status=ExperimentStatus.DRAFT,
                created_at=datetime.fromisoformat("2026-03-09T00:00:00+09:00"),
                updated_at=datetime.fromisoformat("2026-03-09T00:00:00+09:00"),
            ),
        ]

    async def fake_github(window: str = "30d"):
        assert window == "30d"
        return {
            "generated_at": "2026-03-10T12:00:00+09:00",
            "window": {"from": "2026-02-10", "to": "2026-03-10", "timezone": "Asia/Seoul"},
            "summary": {
                "push_events": 4,
                "pr_opened": 2,
                "pr_merged": 1,
                "issue_comments": 1,
                "pr_reviews": 1,
                "merge_rate_28d": 0.5,
                "total_core_events": 8,
                "active_contributors": 3,
            },
            "timeseries": [
                {"date": "2026-03-09", "events": 3, "merge_rate": 1.0},
                {"date": "2026-03-10", "events": 5, "merge_rate": 0.0},
            ],
            "top_repos": [
                {"repo_name": "repo-a", "events": 6, "ratio": 0.75},
                {"repo_name": "repo-b", "events": 2, "ratio": 0.25},
            ],
        }

    async def fake_discord(window: str = "30d"):
        assert window == "30d"
        return {
            "generated_at": "2026-03-10T12:00:00+09:00",
            "window": {"from": "2026-02-10", "to": "2026-03-10", "timezone": "Asia/Seoul"},
            "summary": {
                "message_count": 5,
                "active_authors": 2,
                "active_channels": 1,
            },
            "timeseries": [
                {"date": "2026-03-09", "messages": 2},
                {"date": "2026-03-10", "messages": 3},
            ],
            "top_channels": [{"channel": "general", "messages": 5}],
            "top_authors": [{"author": "alice", "messages": 3}, {"author": "bob", "messages": 2}],
        }

    monkeypatch.setattr("app.services.experiment.experiment_service.get_all", fake_get_all)
    monkeypatch.setattr(dashboard_module, "get_github_overview", fake_github)
    monkeypatch.setattr(dashboard_module, "get_discord_overview", fake_discord)

    response = client.get("/api/v1/dashboard/overview?window=30d")

    assert response.status_code == 200
    body = response.json()

    assert body["summary"]["active_projects_count"] == 1
    assert body["summary"]["weekly_active_contributors"] == 5
    assert body["summary"]["weekly_collab_events"] == 13
    assert body["summary"]["pr_merge_rate_28d"] == 0.5
    assert body["summary"]["pipeline_freshness_hours"] >= 0
    assert body["distribution"]["activity_concentration_top3"] == 1.0
    assert body["health"]["coverage_score"] == 1.0
    assert body["health"]["missing_day_ratio_30d"] >= 0

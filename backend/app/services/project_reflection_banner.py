import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException

from app.core.config import settings
from app.db import d1
from app.schemas.project_reflection_banner import (
    ProjectReflectionBannerConfig,
    ProjectReflectionBannerConfigUpdate,
    ProjectReflectionBannerDecisionResponse,
    ProjectReflectionBannerLoggingContext,
    ProjectReflectionBannerReason,
)


EXPERIMENT_ID = "s12-mid-reflection"
BANNER_ID = "s12-mid-reflection-banner"
BANNER_TITLE = "중간 회고 작성하기"
BANNER_DESCRIPTION = "지금까지의 여정을 정리하고 남은 기간 방향을 잡아봐요"
TARGET_URL = "/reflection/s12-mid-reflection"
SOURCE = "project_detail_home"
SUPPORTED_ROLES = {"builder", "runner"}
S12_COHORT = "12"


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


class ProjectReflectionBannerService:
    async def get_config(self, experiment_id: str) -> ProjectReflectionBannerConfig:
        rows = await d1.query(
            """SELECT *
                 FROM project_reflection_banner_config
                WHERE experiment_id = ?""",
            [experiment_id],
        )
        if not rows:
            raise HTTPException(status_code=404, detail="Project reflection banner config not found")
        return self._to_config(rows[0])

    async def update_config(
        self,
        experiment_id: str,
        data: ProjectReflectionBannerConfigUpdate,
    ) -> ProjectReflectionBannerConfig:
        existing = await d1.query(
            "SELECT experiment_id FROM project_reflection_banner_config WHERE experiment_id = ?",
            [experiment_id],
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Project reflection banner config not found")

        patch = {k: v for k, v in data.model_dump().items() if v is not None}
        if patch:
            patch["updated_at"] = datetime.now(timezone.utc).isoformat()
            set_clause = ", ".join(f"{k} = ?" for k in patch)
            values = [int(v) if isinstance(v, bool) else v for v in patch.values()] + [experiment_id]
            ok = await d1.execute(
                f"UPDATE project_reflection_banner_config SET {set_clause} WHERE experiment_id = ?",
                values,
            )
            if not ok:
                raise HTTPException(status_code=502, detail="Failed to update project reflection banner config")
        return await self.get_config(experiment_id)

    async def decide(
        self,
        user_id: Optional[str],
        project_id: str,
        scenario: Optional[str] = None,
    ) -> ProjectReflectionBannerDecisionResponse:
        if scenario:
            return self._decide_scenario(project_id, scenario)

        normalized_user_id = (user_id or "").strip()
        if not normalized_user_id:
            return self._hidden(ProjectReflectionBannerReason.NOT_AUTHENTICATED)

        config = await self._get_decide_config()
        if not config:
            return self._hidden(ProjectReflectionBannerReason.EXPERIMENT_NOT_FOUND)
        if config.get("experiment_status") != "running" or int(config.get("enabled") or 0) != 1:
            return self._hidden(ProjectReflectionBannerReason.OUTSIDE_REFLECTION_WINDOW)

        project_membership = await self._get_project_membership(normalized_user_id, project_id)
        if not project_membership or str(project_membership.get("project_cohort") or "") != S12_COHORT:
            return self._hidden(ProjectReflectionBannerReason.NOT_S12_PROJECT)

        role = project_membership.get("user_project_role")
        membership_status = project_membership.get("membership_status")
        if not role:
            return self._hidden(ProjectReflectionBannerReason.NOT_PROJECT_MEMBER)
        if role not in SUPPORTED_ROLES:
            return self._hidden(ProjectReflectionBannerReason.UNSUPPORTED_ROLE)
        if membership_status != "active":
            return self._hidden(ProjectReflectionBannerReason.INACTIVE_MEMBERSHIP)

        if not self._is_inside_reflection_window(config):
            return self._hidden(ProjectReflectionBannerReason.OUTSIDE_REFLECTION_WINDOW)

        submitted = await self._has_submitted(normalized_user_id)
        if submitted:
            return self._submitted(
                config=config,
                project_id=project_id,
                project_cohort=S12_COHORT,
                user_project_role=role,
            )

        return self._eligible(
            config=config,
            project_id=project_id,
            project_cohort=S12_COHORT,
            user_project_role=role,
        )

    async def _get_decide_config(self) -> Optional[dict]:
        rows = await d1.query(
            """SELECT
                    e.id,
                    e.status AS experiment_status,
                    e.reflection_start_date,
                    e.reflection_window_days,
                    c.banner_id,
                    c.title,
                    c.description,
                    c.target_url,
                    c.source,
                    c.enabled
                 FROM experiments e
                 JOIN project_reflection_banner_config c
                   ON c.experiment_id = e.id
                WHERE e.id = ?""",
            [EXPERIMENT_ID],
        )
        return rows[0] if rows else None

    async def _get_project_membership(self, user_id: str, project_id: str) -> Optional[dict]:
        main_database_id = os.getenv("D1_MAIN_DATABASE_ID")
        if not main_database_id:
            raise HTTPException(
                status_code=503,
                detail="D1_MAIN_DATABASE_ID is required for project reflection banner decide",
            )

        rows = await d1.query(
            """
            SELECT
                p.cohort AS project_cohort,
                p.status AS project_status,
                m.role AS user_project_role,
                m.status AS membership_status
              FROM dl_projects p
              LEFT JOIN dl_project_members m
                ON m.project_id = p.id
               AND m.user_id = ?
               AND m.base_date = (SELECT MAX(base_date) FROM dl_project_members)
             WHERE p.id = ?
               AND p.base_date = (SELECT MAX(base_date) FROM dl_projects)
             ORDER BY
                CASE
                    WHEN m.status = 'active' AND m.role IN ('builder', 'runner') THEN 0
                    WHEN m.status = 'active' THEN 1
                    WHEN m.role IN ('builder', 'runner') THEN 2
                    ELSE 3
                END
             LIMIT 1
            """,
            [user_id, project_id],
            database_id=main_database_id,
        )
        return rows[0] if rows else None

    async def _has_submitted(self, user_id: str) -> bool:
        rows = await d1.query(
            "SELECT 1 AS submitted FROM reflection WHERE user_id = ? AND experiment_id = ? LIMIT 1",
            [user_id, EXPERIMENT_ID],
        )
        return bool(rows)

    def _is_inside_reflection_window(self, experiment: dict) -> bool:
        start_at = _parse_datetime(experiment.get("reflection_start_date"))
        if not start_at:
            return False

        try:
            window_days = int(experiment.get("reflection_window_days") or 0)
        except (TypeError, ValueError):
            return False
        if window_days <= 0:
            return False

        now = datetime.now(timezone.utc)
        return start_at <= now < start_at + timedelta(days=window_days)

    def _decide_scenario(
        self,
        project_id: str,
        scenario: str,
    ) -> ProjectReflectionBannerDecisionResponse:
        if not settings.REFLECTION_BANNER_SCENARIO_OVERRIDE_ENABLED:
            raise HTTPException(status_code=400, detail="scenario override is disabled")
        if scenario == "server_error":
            raise HTTPException(status_code=500, detail="forced server_error scenario")
        if scenario == ProjectReflectionBannerReason.ELIGIBLE.value:
            return self._eligible(
                config={
                    "banner_id": BANNER_ID,
                    "title": BANNER_TITLE,
                    "description": BANNER_DESCRIPTION,
                    "target_url": TARGET_URL,
                    "source": SOURCE,
                },
                project_id=project_id,
                project_cohort=S12_COHORT,
                user_project_role="runner",
            )
        if scenario == ProjectReflectionBannerReason.ALREADY_SUBMITTED.value:
            return self._submitted(
                config={
                    "banner_id": BANNER_ID,
                    "title": BANNER_TITLE,
                    "description": BANNER_DESCRIPTION,
                    "target_url": TARGET_URL,
                    "source": SOURCE,
                },
                project_id=project_id,
                project_cohort=S12_COHORT,
                user_project_role="runner",
            )

        try:
            reason = ProjectReflectionBannerReason(scenario)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"unsupported scenario '{scenario}'")
        return self._hidden(reason)

    def _hidden(self, reason: ProjectReflectionBannerReason) -> ProjectReflectionBannerDecisionResponse:
        return ProjectReflectionBannerDecisionResponse(show=False, reason=reason)

    def _submitted(
        self,
        config: dict,
        project_id: str,
        project_cohort: str,
        user_project_role: str,
    ) -> ProjectReflectionBannerDecisionResponse:
        response = self._eligible(
            config=config,
            project_id=project_id,
            project_cohort=project_cohort,
            user_project_role=user_project_role,
        )
        response.reason = ProjectReflectionBannerReason.ALREADY_SUBMITTED
        response.submitted = True
        return response

    def _eligible(
        self,
        config: dict,
        project_id: str,
        project_cohort: str,
        user_project_role: str,
    ) -> ProjectReflectionBannerDecisionResponse:
        logging_context = ProjectReflectionBannerLoggingContext(
            experiment_id=EXPERIMENT_ID,
            banner_id=config["banner_id"],
            project_id=project_id,
            project_cohort=project_cohort,
            user_project_role=user_project_role,
            source=config["source"],
        )
        return ProjectReflectionBannerDecisionResponse(
            show=True,
            reason=ProjectReflectionBannerReason.ELIGIBLE,
            submitted=False,
            experiment_id=EXPERIMENT_ID,
            banner_id=config["banner_id"],
            title=config["title"],
            description=config["description"],
            target_url=config["target_url"],
            logging_context=logging_context,
        )

    def _to_config(self, row: dict) -> ProjectReflectionBannerConfig:
        return ProjectReflectionBannerConfig(
            experiment_id=row["experiment_id"],
            banner_id=row["banner_id"],
            title=row["title"],
            description=row["description"],
            target_url=row["target_url"],
            source=row["source"],
            enabled=int(row["enabled"]) == 1,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )


project_reflection_banner_service = ProjectReflectionBannerService()

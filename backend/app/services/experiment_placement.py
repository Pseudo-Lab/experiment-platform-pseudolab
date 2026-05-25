import json
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException

from app.core.config import settings
from app.db import d1
from app.schemas.experiment_placement import (
    ExperimentPlacementConfig,
    ExperimentPlacementConfigUpdate,
    ExperimentPlacementDecisionResponse,
    ExperimentPlacementLoggingContext,
    ExperimentPlacementReason,
    ExperimentPlacementUI,
)


DEFAULT_EXPERIMENT_ID = "s12-mid-reflection"
DEFAULT_PLACEMENT_KEY = "project-detail-home-reflection-cta"
DEFAULT_UI_ID = "s12-mid-reflection-banner"
DEFAULT_UI_TYPE = "banner"
DEFAULT_TITLE = "중간 회고 작성하기"
DEFAULT_DESCRIPTION = "지금까지의 여정을 정리하고 남은 기간 방향을 잡아봐요"
DEFAULT_TARGET_URL = "/reflection/s12-mid-reflection"
DEFAULT_SOURCE = "project_detail_home"
DEFAULT_ALLOWED_ROLES = ["builder", "runner"]
DEFAULT_TARGET_COHORT = "12"


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


class ExperimentPlacementService:
    async def get_config(self, experiment_id: str, placement_key: str) -> ExperimentPlacementConfig:
        rows = await d1.query(
            """SELECT *
                 FROM experiment_placement_config
                WHERE experiment_id = ?
                  AND placement_key = ?""",
            [experiment_id, placement_key],
        )
        if not rows:
            raise HTTPException(status_code=404, detail="Experiment placement config not found")
        return self._to_config(rows[0])

    async def update_config(
        self,
        experiment_id: str,
        placement_key: str,
        data: ExperimentPlacementConfigUpdate,
    ) -> ExperimentPlacementConfig:
        existing = await d1.query(
            """SELECT experiment_id
                 FROM experiment_placement_config
                WHERE experiment_id = ?
                  AND placement_key = ?""",
            [experiment_id, placement_key],
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Experiment placement config not found")

        patch = {k: v for k, v in data.model_dump().items() if v is not None}
        if "allowed_roles" in patch:
            patch["allowed_roles"] = json.dumps(patch["allowed_roles"])
        if patch:
            patch["updated_at"] = datetime.now(timezone.utc).isoformat()
            set_clause = ", ".join(f"{k} = ?" for k in patch)
            values = [int(v) if isinstance(v, bool) else v for v in patch.values()]
            values.extend([experiment_id, placement_key])
            ok = await d1.execute(
                f"""UPDATE experiment_placement_config
                       SET {set_clause}
                     WHERE experiment_id = ?
                       AND placement_key = ?""",
                values,
            )
            if not ok:
                raise HTTPException(status_code=502, detail="Failed to update experiment placement config")
        return await self.get_config(experiment_id, placement_key)

    async def decide(
        self,
        experiment_id: str,
        placement_key: str,
        user_id: Optional[str],
        project_id: str,
        scenario: Optional[str] = None,
    ) -> ExperimentPlacementDecisionResponse:
        if scenario:
            return self._decide_scenario(experiment_id, placement_key, project_id, scenario)

        normalized_user_id = (user_id or "").strip()
        if not normalized_user_id:
            return self._hidden(ExperimentPlacementReason.NOT_AUTHENTICATED)

        config = await self._get_decide_config(experiment_id, placement_key)
        if not config:
            if await self._experiment_exists(experiment_id):
                return self._hidden(ExperimentPlacementReason.PLACEMENT_NOT_FOUND)
            return self._hidden(ExperimentPlacementReason.EXPERIMENT_NOT_FOUND)
        if config.get("experiment_status") != "running" or int(config.get("enabled") or 0) != 1:
            return self._hidden(ExperimentPlacementReason.OUTSIDE_EXPOSURE_WINDOW)

        target_cohort = str(config.get("target_cohort") or "")
        allowed_roles = self._parse_allowed_roles(config.get("allowed_roles"))
        project_membership = await self._get_project_membership(normalized_user_id, project_id)
        if not project_membership or str(project_membership.get("project_cohort") or "") != target_cohort:
            return self._hidden(ExperimentPlacementReason.NOT_TARGET_COHORT)

        role = project_membership.get("user_project_role")
        membership_status = project_membership.get("membership_status")
        if not role:
            return self._hidden(ExperimentPlacementReason.NOT_PROJECT_MEMBER)
        if role not in allowed_roles:
            return self._hidden(ExperimentPlacementReason.UNSUPPORTED_ROLE)
        if membership_status != "active":
            return self._hidden(ExperimentPlacementReason.INACTIVE_MEMBERSHIP)

        if not self._is_inside_exposure_window(config):
            return self._hidden(ExperimentPlacementReason.OUTSIDE_EXPOSURE_WINDOW)

        submitted = await self._has_submitted(experiment_id, normalized_user_id)
        if submitted:
            return self._submitted(
                experiment_id=experiment_id,
                placement_key=placement_key,
                config=config,
                project_id=project_id,
                project_cohort=target_cohort,
                user_project_role=role,
            )

        return self._eligible(
            experiment_id=experiment_id,
            placement_key=placement_key,
            config=config,
            project_id=project_id,
            project_cohort=target_cohort,
            user_project_role=role,
        )

    async def _experiment_exists(self, experiment_id: str) -> bool:
        rows = await d1.query("SELECT 1 FROM experiments WHERE id = ? LIMIT 1", [experiment_id])
        return bool(rows)

    async def _get_decide_config(self, experiment_id: str, placement_key: str) -> Optional[dict]:
        rows = await d1.query(
            """SELECT
                    e.id,
                    e.status AS experiment_status,
                    e.reflection_start_date,
                    e.reflection_window_days,
                    c.placement_key,
                    c.ui_id,
                    c.ui_type,
                    c.title,
                    c.description,
                    c.target_url,
                    c.source,
                    c.enabled,
                    c.target_cohort,
                    c.allowed_roles
                 FROM experiments e
                 JOIN experiment_placement_config c
                   ON c.experiment_id = e.id
                  AND c.placement_key = ?
                WHERE e.id = ?""",
            [placement_key, experiment_id],
        )
        return rows[0] if rows else None

    async def _get_project_membership(self, user_id: str, project_id: str) -> Optional[dict]:
        main_database_id = os.getenv("D1_MAIN_DATABASE_ID")
        if not main_database_id:
            raise HTTPException(
                status_code=503,
                detail="D1_MAIN_DATABASE_ID is required for experiment placement decide",
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
                    WHEN m.status = 'active' THEN 0
                    ELSE 3
                END
             LIMIT 1
            """,
            [user_id, project_id],
            database_id=main_database_id,
        )
        return rows[0] if rows else None

    async def _has_submitted(self, experiment_id: str, user_id: str) -> bool:
        rows = await d1.query(
            "SELECT 1 AS submitted FROM reflection WHERE user_id = ? AND experiment_id = ? LIMIT 1",
            [user_id, experiment_id],
        )
        return bool(rows)

    def _is_inside_exposure_window(self, experiment: dict) -> bool:
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
        experiment_id: str,
        placement_key: str,
        project_id: str,
        scenario: str,
    ) -> ExperimentPlacementDecisionResponse:
        if not settings.EXPERIMENT_PLACEMENT_SCENARIO_OVERRIDE_ENABLED:
            raise HTTPException(status_code=400, detail="scenario override is disabled")
        if scenario == "server_error":
            raise HTTPException(status_code=500, detail="forced server_error scenario")
        if scenario == ExperimentPlacementReason.ELIGIBLE.value:
            return self._eligible(
                experiment_id=experiment_id,
                placement_key=placement_key,
                config=self._scenario_config(experiment_id, placement_key),
                project_id=project_id,
                project_cohort=DEFAULT_TARGET_COHORT,
                user_project_role="runner",
            )
        if scenario == ExperimentPlacementReason.ALREADY_SUBMITTED.value:
            return self._submitted(
                experiment_id=experiment_id,
                placement_key=placement_key,
                config=self._scenario_config(experiment_id, placement_key),
                project_id=project_id,
                project_cohort=DEFAULT_TARGET_COHORT,
                user_project_role="runner",
            )

        try:
            reason = ExperimentPlacementReason(scenario)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"unsupported scenario '{scenario}'")
        return self._hidden(reason)

    def _scenario_config(self, experiment_id: str, placement_key: str) -> dict:
        return {
            "placement_key": placement_key,
            "ui_id": DEFAULT_UI_ID if experiment_id == DEFAULT_EXPERIMENT_ID else f"{experiment_id}-ui",
            "ui_type": DEFAULT_UI_TYPE,
            "title": DEFAULT_TITLE,
            "description": DEFAULT_DESCRIPTION,
            "target_url": DEFAULT_TARGET_URL,
            "source": DEFAULT_SOURCE,
        }

    def _hidden(self, reason: ExperimentPlacementReason) -> ExperimentPlacementDecisionResponse:
        return ExperimentPlacementDecisionResponse(show=False, reason=reason)

    def _submitted(
        self,
        experiment_id: str,
        placement_key: str,
        config: dict,
        project_id: str,
        project_cohort: str,
        user_project_role: str,
    ) -> ExperimentPlacementDecisionResponse:
        response = self._eligible(
            experiment_id=experiment_id,
            placement_key=placement_key,
            config=config,
            project_id=project_id,
            project_cohort=project_cohort,
            user_project_role=user_project_role,
        )
        response.reason = ExperimentPlacementReason.ALREADY_SUBMITTED
        response.submitted = True
        return response

    def _eligible(
        self,
        experiment_id: str,
        placement_key: str,
        config: dict,
        project_id: str,
        project_cohort: str,
        user_project_role: str,
    ) -> ExperimentPlacementDecisionResponse:
        ui = ExperimentPlacementUI(
            id=config["ui_id"],
            type=config["ui_type"],
            title=config["title"],
            description=config["description"],
            target_url=config["target_url"],
        )
        logging_context = ExperimentPlacementLoggingContext(
            experiment_id=experiment_id,
            placement_key=placement_key,
            ui_id=config["ui_id"],
            ui_type=config["ui_type"],
            project_id=project_id,
            project_cohort=project_cohort,
            user_project_role=user_project_role,
            source=config["source"],
        )
        return ExperimentPlacementDecisionResponse(
            show=True,
            reason=ExperimentPlacementReason.ELIGIBLE,
            submitted=False,
            experiment_id=experiment_id,
            placement_key=placement_key,
            ui=ui,
            logging_context=logging_context,
        )

    def _parse_allowed_roles(self, raw_roles: Optional[str]) -> set[str]:
        if not raw_roles:
            return set(DEFAULT_ALLOWED_ROLES)
        try:
            parsed = json.loads(raw_roles)
        except json.JSONDecodeError:
            return set(DEFAULT_ALLOWED_ROLES)
        if not isinstance(parsed, list):
            return set(DEFAULT_ALLOWED_ROLES)
        return {str(role) for role in parsed if role}

    def _to_config(self, row: dict) -> ExperimentPlacementConfig:
        allowed_roles = sorted(self._parse_allowed_roles(row.get("allowed_roles")))
        return ExperimentPlacementConfig(
            experiment_id=row["experiment_id"],
            placement_key=row["placement_key"],
            ui_id=row["ui_id"],
            ui_type=row["ui_type"],
            title=row["title"],
            description=row["description"],
            target_url=row["target_url"],
            source=row["source"],
            target_cohort=str(row["target_cohort"]),
            allowed_roles=allowed_roles,
            enabled=int(row["enabled"]) == 1,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )


experiment_placement_service = ExperimentPlacementService()

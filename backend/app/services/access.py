from typing import Any

from app.schemas.access import (
    AccessDecisionReason,
    AccessDecisionRequest,
    AccessDecisionResponse,
    AccessMode,
)
from app.schemas.project import Project
from app.services.feature_flag import feature_flag_service
from app.services.segment import segment_service


class AccessDecisionService:
    async def decide(
        self,
        request: AccessDecisionRequest,
        project: Project,
    ) -> AccessDecisionResponse:
        if not request.user_id:
            return self._deny("private", "not_authenticated")

        try:
            flag = await feature_flag_service.get(request.flag_key, include_archived=False)
            if flag is None or flag.project_id != project.id:
                return self._deny("private", "evaluation_error")
            if not flag.enabled:
                return self._deny("private", "access_mode_private")

            payload: dict[str, Any] = flag.payload or {}
            access_mode = payload.get("access_mode")
            if access_mode not in ("private", "committee", "public"):
                return self._deny("private", "evaluation_error")

            configured_routes = payload.get("routes")
            if configured_routes is not None:
                if (
                    not isinstance(configured_routes, list)
                    or not all(isinstance(route, str) for route in configured_routes)
                    or request.route not in configured_routes
                ):
                    return self._deny("private", "evaluation_error")

            if access_mode == "private":
                return self._deny("private", "access_mode_private")
            if access_mode == "public":
                return AccessDecisionResponse(
                    allow=True,
                    access_mode="public",
                    reason="allowed_public",
                )

            segment_id = payload.get("committee_segment_id")
            if not isinstance(segment_id, str) or not segment_id:
                return self._deny("private", "evaluation_error")
            segment = await segment_service.get(segment_id)
            if segment is None or not segment.enabled:
                return self._deny("private", "evaluation_error")
            if await segment_service.is_member(segment_id, request.user_id):
                return AccessDecisionResponse(
                    allow=True,
                    access_mode="committee",
                    reason="allowed_committee",
                )
            return self._deny("committee", "not_committee")
        except Exception:
            # Access checks are deliberately fail-closed on storage/evaluation errors.
            return self._deny("private", "evaluation_error")

    @staticmethod
    def _deny(access_mode: AccessMode, reason: AccessDecisionReason) -> AccessDecisionResponse:
        return AccessDecisionResponse(
            allow=False,
            access_mode=access_mode,
            reason=reason,
        )


access_decision_service = AccessDecisionService()

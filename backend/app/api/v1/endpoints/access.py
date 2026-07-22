from fastapi import APIRouter, Depends

from app.api.deps import require_project_from_bearer_token
from app.schemas.access import AccessDecisionRequest, AccessDecisionResponse
from app.schemas.project import Project
from app.services.access import access_decision_service


router = APIRouter()


@router.post("/decide", response_model=AccessDecisionResponse)
async def decide_access(
    body: AccessDecisionRequest,
    project: Project = Depends(require_project_from_bearer_token),
):
    """Return a fail-closed access decision for an authenticated service."""
    return await access_decision_service.decide(body, project)

from typing import Optional
from fastapi import Header, HTTPException, Request, status
from app.schemas.project import Project
from app.services.project import project_service


async def get_project_from_api_key(
    x_api_key: Optional[str] = Header(default=None),
) -> Project:
    if not x_api_key or not x_api_key.strip():
        raise HTTPException(status_code=401, detail="API key required")
    project = await project_service.get_by_api_key(x_api_key)
    if not project:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return project


async def get_project_for_sdk_or_admin(
    request: Request, x_api_key: Optional[str] = Header(default=None),
) -> Optional[Project]:
    """Keep authenticated installation-admin previews separate from SDK ingestion."""
    user = getattr(request.state, "auth_user", None)
    if x_api_key is None and user is not None and user.is_admin:
        return None
    return await get_project_from_api_key(x_api_key)


async def require_project_from_bearer_token(request: Request) -> Project:
    """Authenticate server-to-server requests with a dedicated hashed server credential."""
    authorization = request.headers.get("Authorization", "")
    scheme, separator, token = authorization.partition(" ")
    if not separator or scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    project = await project_service.get_by_server_key(token.strip())
    if not project:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return project

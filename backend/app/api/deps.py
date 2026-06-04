from typing import Optional
from fastapi import Header, HTTPException
from app.schemas.project import Project
from app.services.project import project_service


async def get_project_from_api_key(
    x_api_key: Optional[str] = Header(default=None),
) -> Optional[Project]:
    if not x_api_key:
        return None
    project = await project_service.get_by_api_key(x_api_key)
    if not project:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return project

from fastapi import APIRouter, Depends, HTTPException, Response
from typing import List
from app.schemas.project import Project, ProjectCreate, ProjectUpdate, ProjectApiKey, ProjectSdkStatus
from app.services.project import project_service
from app.core.auth import require_authenticated_user

router = APIRouter()


@router.get("/", response_model=List[Project])
async def list_projects():
    return await project_service.list()


@router.post("/", response_model=Project, status_code=201)
async def create_project(data: ProjectCreate):
    return await project_service.create(data)


@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str):
    p = await project_service.get(project_id)
    if not p:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
    return p


@router.get("/{project_id}/sdk-status", response_model=ProjectSdkStatus)
async def get_sdk_status(project_id: str):
    return await project_service.sdk_status(project_id)


@router.patch("/{project_id}", response_model=Project)
async def update_project(project_id: str, data: ProjectUpdate):
    return await project_service.update(project_id, data)


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str):
    await project_service.delete(project_id)


@router.get("/{project_id}/api-key", response_model=ProjectApiKey,
            dependencies=[Depends(require_authenticated_user)])
async def get_project_api_key(project_id: str, response: Response):
    project = await project_service.get(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    response.headers["Cache-Control"] = "no-store"
    return ProjectApiKey(api_key=project.api_key)

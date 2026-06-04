from fastapi import APIRouter
from typing import List
from app.schemas.project import Project, ProjectCreate, ProjectUpdate, ProjectWithKey, ProjectSdkStatus
from app.services.project import project_service

router = APIRouter()


@router.get("/", response_model=List[ProjectWithKey])
async def list_projects():
    return await project_service.list()


@router.post("/", response_model=ProjectWithKey, status_code=201)
async def create_project(data: ProjectCreate):
    return await project_service.create(data)


@router.get("/{project_id}", response_model=ProjectWithKey)
async def get_project(project_id: str):
    from fastapi import HTTPException
    p = await project_service.get(project_id)
    if not p:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
    return p


@router.get("/{project_id}/sdk-status", response_model=ProjectSdkStatus)
async def get_sdk_status(project_id: str):
    return await project_service.sdk_status(project_id)


@router.patch("/{project_id}", response_model=ProjectWithKey)
async def update_project(project_id: str, data: ProjectUpdate):
    return await project_service.update(project_id, data)


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str):
    await project_service.delete(project_id)

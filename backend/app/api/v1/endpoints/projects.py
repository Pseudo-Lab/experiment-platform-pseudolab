from fastapi import APIRouter
from typing import List
from app.schemas.project import Project, ProjectCreate, ProjectWithKey
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

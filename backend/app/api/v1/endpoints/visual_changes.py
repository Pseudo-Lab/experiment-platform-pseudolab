from fastapi import APIRouter
from typing import List, Optional
from app.schemas.visual_change import VisualChange, VisualChangeCreate
from app.services.visual_change import visual_change_service

router = APIRouter()


@router.get("/{project_id}/visual-changes", response_model=List[VisualChange])
async def list_visual_changes(project_id: str, variant: Optional[str] = None):
    return await visual_change_service.list(project_id, variant)


@router.post("/{project_id}/visual-changes", response_model=VisualChange, status_code=201)
async def create_visual_change(project_id: str, data: VisualChangeCreate):
    return await visual_change_service.create(project_id, data)


@router.delete("/{project_id}/visual-changes/{change_id}", status_code=204)
async def delete_visual_change(project_id: str, change_id: str):
    await visual_change_service.delete(project_id, change_id)

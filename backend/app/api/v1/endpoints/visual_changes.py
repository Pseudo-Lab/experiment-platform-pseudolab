from fastapi import APIRouter
from typing import List, Optional
from app.schemas.visual_change import VisualChange, VisualChangeCreate
from app.services.visual_change import visual_change_service

experiment_router = APIRouter()
standalone_router = APIRouter()


@experiment_router.get("/{experiment_id}/visual-changes", response_model=List[VisualChange])
async def list_visual_changes(experiment_id: str, variation_key: Optional[str] = None):
    return await visual_change_service.list(experiment_id, variation_key)


@experiment_router.post("/{experiment_id}/visual-changes", response_model=VisualChange, status_code=201)
async def create_visual_change(experiment_id: str, data: VisualChangeCreate):
    return await visual_change_service.create(experiment_id, data)


@standalone_router.delete("/{change_id}", status_code=204)
async def delete_visual_change(change_id: str):
    await visual_change_service.delete(change_id)

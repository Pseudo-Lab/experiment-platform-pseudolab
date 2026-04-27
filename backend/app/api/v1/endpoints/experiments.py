from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.schemas.experiment import (
    Experiment, ExperimentCreate, ExperimentUpdate,
    AssignmentResponse, ExperimentStatus, ExperimentResult,
)
from app.schemas.reflection import ReflectionWindowUpdate
from app.services.experiment import experiment_service
from app.services.reflection import reflection_service

router = APIRouter()


@router.get("/", response_model=List[Experiment])
async def list_experiments(status: Optional[ExperimentStatus] = Query(None)):
    return await experiment_service.get_all(status=status)


@router.post("/", response_model=Experiment, status_code=201)
async def create_experiment(data: ExperimentCreate):
    return await experiment_service.create(data)


@router.get("/{experiment_id}", response_model=Experiment)
async def get_experiment(experiment_id: str):
    exp = await experiment_service.get(experiment_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return exp


@router.patch("/{experiment_id}", response_model=Experiment)
async def update_experiment(experiment_id: str, data: ExperimentUpdate):
    exp = await experiment_service.update(experiment_id, data)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return exp


@router.delete("/{experiment_id}", status_code=204)
async def delete_experiment(experiment_id: str):
    await experiment_service.delete(experiment_id)


@router.get("/{experiment_id}/assign/{user_id}", response_model=AssignmentResponse)
async def assign_user(experiment_id: str, user_id: str):
    result = await experiment_service.assign(experiment_id, user_id)
    if not result:
        raise HTTPException(status_code=404, detail="Experiment or variants not found")
    return result


@router.get("/{experiment_id}/result", response_model=ExperimentResult)
async def get_result(experiment_id: str):
    return await experiment_service.get_result(experiment_id)


@router.patch("/{experiment_id}/reflection-window")
async def update_reflection_window(experiment_id: str, data: ReflectionWindowUpdate):
    await reflection_service.update_reflection_window(experiment_id, data)
    return {"success": True}

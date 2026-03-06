from fastapi import APIRouter, HTTPException
from typing import List
from app.schemas.experiment import Experiment
from app.services.experiment import experiment_service

router = APIRouter()

@router.get("/", response_model=List[Experiment])
async def list_experiments():
    return await experiment_service.get_all()

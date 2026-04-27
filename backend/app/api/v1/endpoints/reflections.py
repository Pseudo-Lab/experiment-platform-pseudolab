from fastapi import APIRouter, Query
from app.schemas.reflection import (
    Reflection, ReflectionCreate,
    ReflectionCheckResponse, ReflectionSummary,
)
from app.services.reflection import reflection_service

router = APIRouter()


@router.post("/", response_model=Reflection, status_code=201)
async def submit_reflection(data: ReflectionCreate):
    return await reflection_service.submit(data)


@router.get("/check", response_model=ReflectionCheckResponse)
async def check_reflection(
    user_id: str = Query(...),
    experiment_id: str = Query(...),
):
    return await reflection_service.check(user_id, experiment_id)


@router.get("/summary", response_model=ReflectionSummary)
async def reflection_summary(experiment_id: str = Query(...)):
    return await reflection_service.summary(experiment_id)

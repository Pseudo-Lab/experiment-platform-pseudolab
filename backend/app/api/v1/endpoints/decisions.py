from fastapi import APIRouter
from typing import List
from app.schemas.decision import Decision, DecisionCreate, ExperimentDecisionCreate, LearningNote, LearningNoteCreate
from app.services.decision import decision_service

router = APIRouter()


@router.post("/decisions", response_model=Decision, status_code=201)
async def create_decision(data: DecisionCreate):
    return await decision_service.create_decision(data)


@router.post("/experiments/{experiment_id}/decisions", response_model=Decision, status_code=201)
async def create_experiment_decision(experiment_id: str, data: ExperimentDecisionCreate):
    full = DecisionCreate(
        experiment_id=experiment_id,
        decision=data.decision,
        reason=data.reason,
        decided_by=data.decided_by,
    )
    return await decision_service.create_decision(full)


@router.get("/experiments/{experiment_id}/decisions", response_model=List[Decision])
async def list_decisions(experiment_id: str):
    return await decision_service.list_decisions(experiment_id)


@router.post("/learning-notes", response_model=LearningNote, status_code=201)
async def create_learning_note(data: LearningNoteCreate):
    return await decision_service.create_learning_note(data)


@router.get("/experiments/{experiment_id}/learning-notes", response_model=List[LearningNote])
async def list_learning_notes(experiment_id: str):
    return await decision_service.list_learning_notes(experiment_id)

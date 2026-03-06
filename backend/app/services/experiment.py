from typing import List
from app.schemas.experiment import Experiment, ExperimentStatus
from datetime import datetime
import uuid

# 임시 더미 데이터 (Sprint 1.2용)
MOCK_EXPERIMENTS = [
    Experiment(
        id=str(uuid.uuid4()),
        name="Pricing Page Valuation Test",
        status=ExperimentStatus.ACTIVE,
        created_at=datetime.now()
    ),
    Experiment(
        id=str(uuid.uuid4()),
        name="Home Hero CTA Experiment",
        status=ExperimentStatus.ACTIVE,
        created_at=datetime.now()
    ),
    Experiment(
        id=str(uuid.uuid4()),
        name="Checkout Flow Optimization",
        status=ExperimentStatus.DRAFT,
        created_at=datetime.now()
    )
]

class ExperimentService:
    @staticmethod
    async def get_all() -> List[Experiment]:
        # 실제 구현 시에는 supabase.table("experiments").select("*").execute() 사용
        return MOCK_EXPERIMENTS

experiment_service = ExperimentService()

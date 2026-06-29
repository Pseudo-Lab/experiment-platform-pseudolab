"""
어드민 전용 엔드포인트.

현재:
  POST /admin/srm-check  — 전체 running A/B 실험 SRM 배치 검사
"""
from fastapi import APIRouter

from app.services.srm_monitor import srm_monitor

router = APIRouter()


@router.post("/srm-check")
async def run_srm_check():
    """running 중인 모든 A/B 실험에 대해 SRM χ² 검정 실행.

    - p < 0.001 이면 experiments.srm_flagged = 1
    - 정상이면 0 으로 복구
    - Cloudflare Workers Cron 또는 외부 스케줄러에서 호출
    """
    return await srm_monitor.run()

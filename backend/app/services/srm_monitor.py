"""
PLAT-3: SRM (Sample Ratio Mismatch) 배치 모니터

실행 방법:
  POST /admin/srm-check   (수동 트리거)
  → running 상태 A/B 실험 전체에 대해 exp_exposure 이벤트 기반
    χ² goodness-of-fit 검정 수행.
  → p < 0.001 이면 experiments.srm_flagged = 1 로 업데이트.

Cloudflare Workers 환경에서는 Cron Trigger를 통해
매일 새벽 이 엔드포인트를 호출하도록 구성한다.
"""
from datetime import datetime, timezone

from scipy.stats import chisquare

from app.db import d1


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class SRMMonitor:

    async def run(self) -> dict:
        """모든 running A/B 실험에 대해 SRM 검사 실행.

        Returns
        -------
        {
          "checked": int,        # 검사한 실험 수
          "flagged": [str, ...], # SRM 감지된 실험 ID 목록
          "cleared": [str, ...], # 이전에 flagged였으나 정상으로 복구된 실험 ID 목록
        }
        """
        exps = await d1.query(
            "SELECT id FROM experiments WHERE status = 'running' AND experiment_type = 'ab_test'"
        )
        flagged: list[str] = []
        cleared: list[str] = []
        now = _now()

        for exp in exps:
            exp_id: str = exp["id"]
            srm_detected = await self._check_srm(exp_id)

            await d1.execute(
                "UPDATE experiments SET srm_flagged = ?, updated_at = ? WHERE id = ?",
                [1 if srm_detected else 0, now, exp_id],
            )
            (flagged if srm_detected else cleared).append(exp_id)

        return {
            "checked": len(exps),
            "flagged": flagged,
            "cleared": cleared,
            "run_at": now,
        }

    async def _check_srm(self, experiment_id: str) -> bool:
        """experiment_id에 대해 χ² 검정으로 SRM 여부 반환.

        - exp_exposure 이벤트의 user_id 기준 variant별 고유 사용자 수 집계
        - 등분산(all equal) 귀무가설 하에 검정
        - p < 0.001 → SRM 감지
        """
        rows = await d1.query(
            """
            SELECT json_extract(properties, '$.variant') AS variant,
                   COUNT(DISTINCT user_id)               AS cnt
              FROM event_log
             WHERE event_name = 'exp_exposure'
               AND json_extract(properties, '$.experiment_id') = ?
             GROUP BY 1
            """,
            [experiment_id],
        )

        if not rows or len(rows) < 2:
            return False

        counts = [int(r["cnt"]) for r in rows if r.get("cnt")]
        if len(counts) < 2 or sum(counts) == 0:
            return False

        total = sum(counts)
        expected = [total / len(counts)] * len(counts)
        _, p_value = chisquare(counts, f_exp=expected)
        return bool(p_value < 0.001)


srm_monitor = SRMMonitor()

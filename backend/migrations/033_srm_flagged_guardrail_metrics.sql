-- Migration 033: SRM 배치 플래그 + Guardrail 지표 컬럼 추가
-- srm_flagged: 배치 SRM 검사에서 이상 감지 시 1로 세팅
-- guardrail_metrics: 가드레일로 모니터링할 이벤트 이름 목록 (JSON array)

ALTER TABLE experiments ADD COLUMN srm_flagged      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE experiments ADD COLUMN guardrail_metrics TEXT;   -- e.g. '["weekly_session_attended"]'

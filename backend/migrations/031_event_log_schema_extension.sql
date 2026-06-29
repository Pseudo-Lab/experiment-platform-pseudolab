-- 031: event_log 스키마 확장
-- session_id, experiment_id, variant 상위 컬럼 추가 (분석 쿼리 성능)
-- event_id: 클라이언트 제공 UUID — 멱등 적재(중복 무시) 기준

ALTER TABLE event_log ADD COLUMN event_id      TEXT;
ALTER TABLE event_log ADD COLUMN session_id    TEXT;
ALTER TABLE event_log ADD COLUMN experiment_id TEXT;
ALTER TABLE event_log ADD COLUMN variant       TEXT;
ALTER TABLE event_log ADD COLUMN device        TEXT;
ALTER TABLE event_log ADD COLUMN anon_id       TEXT;

-- 멱등 적재용 유니크 인덱스 (event_id가 있을 때만 유니크 강제)
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_log_event_id
    ON event_log(event_id)
    WHERE event_id IS NOT NULL;

-- 분석 쿼리용 인덱스
CREATE INDEX IF NOT EXISTS idx_event_log_session_id    ON event_log(session_id);
CREATE INDEX IF NOT EXISTS idx_event_log_experiment_id ON event_log(experiment_id);
CREATE INDEX IF NOT EXISTS idx_event_log_variant       ON event_log(variant);

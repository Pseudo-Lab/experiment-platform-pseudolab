-- 028: Feature Flag에 forced_variant 추가, Experiment에 winning_variant 추가
--
-- forced_variant가 설정되면 rollout_pct/enabled 무시하고 해당 variant를 항상 반환.
-- 실험 완료(adopt-winner) 후 전체 배포 상태를 표현하기 위한 필드.
--
-- winning_variant는 실험이 완료될 때 어떤 variant가 채택됐는지 기록.

ALTER TABLE feature_flag ADD COLUMN forced_variant TEXT;
ALTER TABLE experiments ADD COLUMN winning_variant TEXT;

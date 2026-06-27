-- 030: s12-mid-reflection experiment_type 수정
-- 원인: migration 011이 experiment_type 컬럼 추가(012) 이전에 실행되어
--       기본값 'ab_test'가 적용됨. 준실험으로 올바르게 설정.
UPDATE experiments
SET experiment_type = 'quasi_experiment',
    updated_at      = datetime('now')
WHERE id = 's12-mid-reflection';

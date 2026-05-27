-- experiment_variants 테이블 폐기, variants 정의 단일화 (PostHog 정합).
--
-- 변경 후 모델:
-- - flag_key가 있는 실험: variants는 feature_flag_rule에서 derive
-- - flag_key가 없는 실험: variants는 experiments.variant_names_json에 저장
-- - experiment_assignments는 variant_name(TEXT)를 직접 보관 (FK 제거)
--
-- D1/SQLite에서 ALTER COLUMN/DROP COLUMN 호환성 문제를 피하기 위해
-- experiment_assignments는 새 테이블로 재구성한다.

-- 1) experiments에 variant_names_json 컬럼 추가
ALTER TABLE experiments ADD COLUMN variant_names_json TEXT;

-- 2) 기존 experiment_variants 정의를 JSON 배열로 백필
UPDATE experiments SET variant_names_json = (
    SELECT json_group_array(name)
      FROM experiment_variants
     WHERE experiment_id = experiments.id
) WHERE EXISTS (
    SELECT 1 FROM experiment_variants WHERE experiment_id = experiments.id
);

-- 3) experiment_assignments 재구성 (variant_id → variant_name)
CREATE TABLE experiment_assignments_new (
    experiment_id   TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    variant_name    TEXT NOT NULL,
    user_id         TEXT NOT NULL,
    assigned_at     TEXT NOT NULL,
    PRIMARY KEY (experiment_id, user_id)
);

INSERT INTO experiment_assignments_new (experiment_id, variant_name, user_id, assigned_at)
SELECT a.experiment_id, v.name, a.user_id, a.assigned_at
  FROM experiment_assignments a
  JOIN experiment_variants v ON v.id = a.variant_id;

DROP TABLE experiment_assignments;

ALTER TABLE experiment_assignments_new RENAME TO experiment_assignments;

CREATE INDEX IF NOT EXISTS idx_assignments_user_id ON experiment_assignments(user_id);

-- 4) experiment_variants 폐기
DROP TABLE experiment_variants;

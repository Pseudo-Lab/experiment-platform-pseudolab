-- Enable upsert on feature_flag_exposure: one row per (user_id, flag_key).
-- Existing duplicate rows are deduplicated by keeping the latest evaluated_at.
DELETE FROM feature_flag_exposure
WHERE id NOT IN (
    SELECT id FROM feature_flag_exposure e1
    WHERE evaluated_at = (
        SELECT MAX(evaluated_at) FROM feature_flag_exposure e2
        WHERE e2.user_id = e1.user_id AND e2.flag_key = e1.flag_key
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ffe_user_flag ON feature_flag_exposure(user_id, flag_key);

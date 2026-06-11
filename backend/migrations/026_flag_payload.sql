-- Add JSON payload field to feature_flag so decide() can return arbitrary data per flag.
-- Nullable: existing flags keep NULL (SDK receives payload: null unchanged).

ALTER TABLE feature_flag ADD COLUMN payload_json TEXT;

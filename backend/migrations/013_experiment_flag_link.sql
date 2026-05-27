-- Link experiments to feature flags so that decide() records both
-- feature_flag_exposure and experiment_assignments in a single call.
-- PostHog-style: when an experiment is linked to a flag, the flag is the
-- single source of truth for variant assignment (no SHA256 re-bucketing).
--
-- Backward compatibility:
--   experiments.flag_key is nullable. Legacy experiments without a flag_key
--   continue to use the original SHA256-bucketed assign() flow untouched.

ALTER TABLE experiments ADD COLUMN flag_key TEXT REFERENCES feature_flag(flag_key);

CREATE INDEX IF NOT EXISTS idx_experiments_flag_key ON experiments(flag_key);

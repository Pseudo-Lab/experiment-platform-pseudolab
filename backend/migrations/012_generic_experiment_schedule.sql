-- Generic experiment operation fields.
-- start_at/end_at are the canonical exposure window used by placement decide.
-- reflection_start_date/reflection_window_days remain as backward-compatible fallback.

ALTER TABLE experiments ADD COLUMN experiment_type TEXT NOT NULL DEFAULT 'ab_test';
ALTER TABLE experiments ADD COLUMN completion_event TEXT;

-- Apply once, after checking PRAGMA table_info(experiments); ALTER is not replay-safe.
-- Existing experiments retain their legacy readout. Only new API-created experiments opt in.
ALTER TABLE experiments ADD COLUMN event_model TEXT NOT NULL DEFAULT 'legacy'
    CHECK (event_model IN ('legacy', 'sdk_v1'));

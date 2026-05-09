-- Feature Flag soft archive

ALTER TABLE feature_flag ADD COLUMN archived_at TEXT;
CREATE INDEX IF NOT EXISTS idx_feature_flag_archived_at ON feature_flag(archived_at);

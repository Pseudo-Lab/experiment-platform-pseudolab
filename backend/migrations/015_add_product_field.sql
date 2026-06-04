-- Add product field to experiments and feature_flag tables.
-- product is a free-text label (e.g. "lvup", "demo-app", "pseudo-lab") that
-- groups experiments/flags by the product/service they belong to.
-- Nullable: existing rows keep NULL until explicitly set.

ALTER TABLE experiments   ADD COLUMN product TEXT;
ALTER TABLE feature_flag  ADD COLUMN product TEXT;

CREATE INDEX IF NOT EXISTS idx_experiments_product  ON experiments(product);
CREATE INDEX IF NOT EXISTS idx_feature_flag_product ON feature_flag(product);

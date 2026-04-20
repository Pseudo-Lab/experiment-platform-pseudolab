-- Migration: 004_add_index_created_at
-- Created: 2026-04-20

CREATE INDEX IF NOT EXISTS idx_experiments_created_at
    ON experiments(created_at);

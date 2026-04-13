-- 실험 플랫폼 코어 스키마 (Cloudflare D1 / SQLite)
-- Migration: 001_experiment_platform_core
-- Created: 2026-04-13

CREATE TABLE IF NOT EXISTS experiments (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    hypothesis  TEXT,
    status      TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'running', 'paused', 'completed')),
    owner_id    TEXT,
    start_at    TEXT,
    end_at      TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS experiment_variants (
    id              TEXT PRIMARY KEY,
    experiment_id   TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    traffic_ratio   REAL NOT NULL CHECK (traffic_ratio >= 0 AND traffic_ratio <= 1),
    description     TEXT,
    created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS experiment_assignments (
    experiment_id   TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    variant_id      TEXT NOT NULL REFERENCES experiment_variants(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL,
    assigned_at     TEXT NOT NULL,
    PRIMARY KEY (experiment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_variants_experiment_id
    ON experiment_variants(experiment_id);

CREATE INDEX IF NOT EXISTS idx_assignments_user_id
    ON experiment_assignments(user_id);

CREATE INDEX IF NOT EXISTS idx_experiments_status
    ON experiments(status);

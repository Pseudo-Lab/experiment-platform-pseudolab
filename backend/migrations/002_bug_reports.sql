-- Migration: 002_bug_reports
-- Created: 2026-04-13

CREATE TABLE IF NOT EXISTS bug_reports (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    category    TEXT NOT NULL CHECK (category IN ('ui', 'functional', 'performance', 'other')),
    description TEXT,
    status      TEXT NOT NULL DEFAULT 'reported'
                CHECK (status IN ('reported', 'in_progress', 'resolved')),
    attachments TEXT NOT NULL DEFAULT '[]',  -- JSON array: [{name, key, type}]
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_status     ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON bug_reports(created_at);

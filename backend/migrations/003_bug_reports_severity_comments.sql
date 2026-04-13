-- Migration: 003_bug_reports_severity_comments
-- Created: 2026-04-13

ALTER TABLE bug_reports ADD COLUMN severity TEXT NOT NULL DEFAULT 'minor'
    CHECK (severity IN ('minor', 'major', 'critical'));

CREATE TABLE IF NOT EXISTS bug_report_comments (
    id          TEXT PRIMARY KEY,
    report_id   TEXT NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
    author      TEXT,
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_report_id ON bug_report_comments(report_id);

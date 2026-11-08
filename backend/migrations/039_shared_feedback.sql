-- Existing administrator reports remain private; only new feedback is shared.
ALTER TABLE bug_reports ADD COLUMN shared INTEGER NOT NULL DEFAULT 0 CHECK (shared IN (0, 1));
ALTER TABLE bug_reports ADD COLUMN author_account_id TEXT;
ALTER TABLE bug_reports ADD COLUMN feedback_kind TEXT NOT NULL DEFAULT 'bug' CHECK (feedback_kind IN ('bug', 'suggestion'));
CREATE TABLE bug_report_uploads (
    key TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    report_id TEXT REFERENCES bug_reports(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL
);
-- Validate and claim attachment ownership in the same statement as report creation.
CREATE TRIGGER shared_feedback_attachments_check BEFORE INSERT ON bug_reports
WHEN NEW.shared = 1
BEGIN
    SELECT CASE WHEN EXISTS (
        SELECT 1 FROM json_each(NEW.attachments) AS attachment
        LEFT JOIN bug_report_uploads AS upload ON upload.key = json_extract(attachment.value, '$.key')
        WHERE upload.key IS NULL OR upload.owner_id != NEW.author_account_id OR upload.report_id IS NOT NULL
    ) THEN RAISE(ABORT, 'Invalid feedback attachment') END;
END;
CREATE TRIGGER shared_feedback_attachments_claim AFTER INSERT ON bug_reports
WHEN NEW.shared = 1
BEGIN
    UPDATE bug_report_uploads SET report_id = NEW.id
    WHERE key IN (SELECT json_extract(value, '$.key') FROM json_each(NEW.attachments));
END;

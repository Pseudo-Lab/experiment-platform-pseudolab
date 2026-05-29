-- 019: Add base_url to projects
-- Allows the dashboard to know which URL to load in the Visual Editor iframe.

ALTER TABLE projects ADD COLUMN base_url TEXT;
UPDATE projects SET base_url = 'http://localhost:8081' WHERE id = 'demo-app';

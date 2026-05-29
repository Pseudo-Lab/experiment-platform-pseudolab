-- 019: Add base_url to projects
-- Allows the dashboard to know which URL to load in the Visual Editor iframe.

ALTER TABLE projects ADD COLUMN base_url TEXT;
UPDATE projects SET base_url = 'https://sub.pseudolab-devfactory.com/example' WHERE id = 'demo-app';

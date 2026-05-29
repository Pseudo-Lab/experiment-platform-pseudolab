-- 019: Add base_url to projects for Visual Editor default URL

ALTER TABLE projects ADD COLUMN base_url TEXT;

UPDATE projects SET base_url = 'https://sub.pseudolab-devfactory.com/example' WHERE id = 'demo-app';

-- project_type: 'ab_test' | 'quasi_experiment'
ALTER TABLE projects ADD COLUMN project_type TEXT NOT NULL DEFAULT 'ab_test';
UPDATE projects SET project_type = 'quasi_experiment' WHERE id = 'lvup';
UPDATE projects SET project_type = 'ab_test' WHERE id IN ('demo-app', 'pseudo-lab');

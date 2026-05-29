CREATE TABLE IF NOT EXISTS placements (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  project_id TEXT REFERENCES projects(id),
  status TEXT NOT NULL DEFAULT 'active',
  target_cohort TEXT,
  allowed_roles TEXT,
  start_at TEXT,
  end_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO placements (key, name, project_id, status, target_cohort, allowed_roles, start_at, end_at)
VALUES (
  'project-detail-home-reflection-cta',
  '12기 중간 회고 배너',
  'lvup',
  'active',
  '12',
  '["builder","runner"]',
  '2026-05-28T00:00:00',
  '2026-06-10T00:00:00'
);

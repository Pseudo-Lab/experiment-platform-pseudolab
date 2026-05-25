-- Generic experiment placement metadata.
-- The seeded 12th-cohort reflection placement below is the first platform validation case,
-- not a schema-level default.
CREATE TABLE IF NOT EXISTS experiment_placement_config (
    experiment_id  TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    placement_key  TEXT NOT NULL,
    ui_id          TEXT NOT NULL,
    ui_type        TEXT NOT NULL DEFAULT 'banner',
    title          TEXT NOT NULL,
    description    TEXT NOT NULL,
    target_url     TEXT NOT NULL,
    source         TEXT NOT NULL DEFAULT 'unknown',
    target_cohort  TEXT NOT NULL DEFAULT '*',
    allowed_roles  TEXT NOT NULL DEFAULT '[]',
    enabled        INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (experiment_id, placement_key)
);

INSERT OR IGNORE INTO experiments (
    id,
    name,
    hypothesis,
    expected_effect,
    primary_metric,
    cohort_id,
    status,
    owner_id,
    start_at,
    end_at,
    reflection_start_date,
    reflection_window_days,
    created_at,
    updated_at
) VALUES (
    's12-mid-reflection',
    'LVUP 12기 중간 회고 UI 노출',
    '프로젝트 상세 홈에서 중간 회고 진입 UI를 노출하면 12기 builder/runner의 회고 제출이 증가한다.',
    '12기 active builder/runner의 중간 회고 제출 유도',
    'project_reflection_ui_clicked',
    '12',
    'running',
    'experiment-platform',
    NULL,
    NULL,
    NULL,
    7,
    datetime('now'),
    datetime('now')
);

INSERT OR IGNORE INTO experiment_placement_config (
    experiment_id,
    placement_key,
    ui_id,
    ui_type,
    title,
    description,
    target_url,
    source,
    target_cohort,
    allowed_roles,
    enabled,
    created_at,
    updated_at
) VALUES (
    's12-mid-reflection',
    'project-detail-home-reflection-cta',
    's12-mid-reflection-banner',
    'banner',
    '중간 회고 작성하기',
    '지금까지의 여정을 정리하고 남은 기간 방향을 잡아봐요',
    '/reflection/s12-mid-reflection',
    'project_detail_home',
    '12',
    '["builder","runner"]',
    1,
    datetime('now'),
    datetime('now')
);

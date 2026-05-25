-- LVUP 12기 중간 회고 배너 실험 메타데이터
-- reflection_start_date는 운영 시작 시점에 별도 설정해야 실제 노출된다.
CREATE TABLE IF NOT EXISTS project_reflection_banner_config (
    experiment_id TEXT PRIMARY KEY REFERENCES experiments(id) ON DELETE CASCADE,
    banner_id     TEXT NOT NULL,
    title         TEXT NOT NULL,
    description   TEXT NOT NULL,
    target_url    TEXT NOT NULL,
    source        TEXT NOT NULL DEFAULT 'project_detail_home',
    enabled       INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
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
    'LVUP 12기 중간 회고 배너',
    '프로젝트 상세 홈에서 중간 회고 배너를 노출하면 12기 builder/runner의 회고 제출이 증가한다.',
    '12기 active builder/runner의 중간 회고 제출 유도',
    'project_reflection_banner_clicked',
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

INSERT OR IGNORE INTO project_reflection_banner_config (
    experiment_id,
    banner_id,
    title,
    description,
    target_url,
    source,
    enabled,
    created_at,
    updated_at
) VALUES (
    's12-mid-reflection',
    's12-mid-reflection-banner',
    '중간 회고 작성하기',
    '지금까지의 여정을 정리하고 남은 기간 방향을 잡아봐요',
    '/reflection/s12-mid-reflection',
    'project_detail_home',
    1,
    datetime('now'),
    datetime('now')
);

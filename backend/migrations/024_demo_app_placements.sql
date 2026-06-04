-- demo-app의 list/sidebar variant용 placement 데이터 삽입
-- home_layout_exp_v1 (id: bfe3881b-99ff-4b0b-ba23-43b78aeab5e2) → list variant
-- sponsor_slot_exp_v1 (id: 29e2a048-1e20-4509-a8f6-b391a5c23240) → sidebar variant

-- 1. placements 테이블에 2개 추가
INSERT INTO placements (key, name, project_id, status, target_cohort, allowed_roles, start_at, end_at, created_at, updated_at)
VALUES (
  'home-layout-list-view',
  '홈 레이아웃 리스트 뷰',
  'demo-app',
  'active',
  NULL,
  NULL,
  NULL,
  NULL,
  datetime('now'),
  datetime('now')
);

INSERT INTO placements (key, name, project_id, status, target_cohort, allowed_roles, start_at, end_at, created_at, updated_at)
VALUES (
  'sponsor-slot-sidebar',
  '스폰서 슬롯 사이드바',
  'demo-app',
  'active',
  NULL,
  NULL,
  NULL,
  NULL,
  datetime('now'),
  datetime('now')
);

-- 2. experiment_placement_config 테이블에 2개 추가
-- home-layout-list-view → home_layout_exp_v1 의 list variant 연결
INSERT INTO experiment_placement_config (experiment_id, placement_key, ui_id, ui_type, title, description, target_url, variant_key, source, target_cohort, allowed_roles, enabled, created_at, updated_at)
VALUES (
  'bfe3881b-99ff-4b0b-ba23-43b78aeab5e2',
  'home-layout-list-view',
  'home-layout-list',
  'layout',
  '리스트형 레이아웃',
  '카드 그리드 대신 리스트 형태로 스터디를 표시합니다.',
  '/',
  'list',
  'experiment',
  '*',
  '[]',
  1,
  datetime('now'),
  datetime('now')
);

-- sponsor-slot-sidebar → sponsor_slot_exp_v1 의 sidebar variant 연결
INSERT INTO experiment_placement_config (experiment_id, placement_key, ui_id, ui_type, title, description, target_url, variant_key, source, target_cohort, allowed_roles, enabled, created_at, updated_at)
VALUES (
  '29e2a048-1e20-4509-a8f6-b391a5c23240',
  'sponsor-slot-sidebar',
  'sponsor-slot-sidebar',
  'banner',
  '사이드바 스폰서 슬롯',
  '인라인 배너 대신 사이드바에 스폰서를 표시합니다.',
  '/sponsors',
  'sidebar',
  'experiment',
  '*',
  '[]',
  1,
  datetime('now'),
  datetime('now')
);

-- 029: sidebar-nav-v1 A/B 테스트 실험 시딩
-- 담당: 성동(대시보드) | 2026-06-23
-- 참고: 준실험 트래킹 요건 명세서 (김가경, 2026-06-22)
--   - primary_metric  : enrollment_completed (Primary 전환)
--   - exposure_event  : exp_exposure (노출 분모, properties.variant 필수)
--   - variant         : control | treatment (50:50)
--   - start_at        : NULL — 노출 시작 시 대시보드에서 직접 설정

INSERT OR IGNORE INTO experiments (
    id,
    name,
    hypothesis,
    expected_effect,
    primary_metric,
    completion_event,
    experiment_type,
    project_id,
    status,
    owner_id,
    start_at,
    end_at,
    variant_names_json,
    created_at,
    updated_at
) VALUES (
    'sidebar-nav-v1',
    'LVUP 사이드바 네비게이션 A/B 테스트',
    '사이드바 항목 배열을 최적화하면 스터디·행사 등록 전환율이 높아진다.',
    '13기 alrt 신청 및 행사 등록(enrollment_completed) 전환율 향상',
    'enrollment_completed',
    'enrollment_completed',
    'ab_test',
    'lvup',
    'draft',
    'experiment-platform',
    NULL,
    NULL,
    '["control","treatment"]',
    datetime('now'),
    datetime('now')
);

Status: active
Last-Validated: 2026-03-14

# Docs Inventory & Cleanup Plan

## 목적
- 현재 운영/개발에 필요한 문서와 과거 문서를 분리하여 탐색 비용을 줄인다.
- 삭제 대신 `active / archive / superseded` 분류를 먼저 적용해 안전하게 정리한다.

---

## 분류 기준
- **active**: 현재 의사결정/운영에 직접 사용
- **archive**: 과거 기록으로 보존만 필요
- **superseded**: 최신 문서로 대체됨(대체 문서 링크 필요)

---

## 1차 분류안 (현재 파일 기준)

### A. active (유지)
- `docs/reports/hand-off-12th-study-platform.md`
- `docs/reports/dashboard-execution-plan-v1.md`
- `docs/reports/team-lead-rebaseline-plan.md`
- `docs/reports/kpi-definition-v2.md`
- `docs/reports/dataset-validation-v2.md`
- `docs/repo-rename-progress.md`
- `docs/repo-rename-external-checklist.md`
- `docs/dashboard-mvp-plan.md`
- `docs/dashboard-test-strategy.md`

### B. superseded (대체 표시 후 보관)
- `docs/reports/data-analyst-report-v1.md` → `docs/reports/data-analyst-report-v2.md`
- `docs/reports/dev-implementation-report-v1.md` → `docs/reports/dev-implementation-report-v2.md`
- `docs/reports/team-lead-review-v1.md` → `docs/reports/team-lead-review-v2.md`

### C. archive (기록성 문서)
- `docs/reports/snapshots/2026-03-11-analysis-snapshot.md`
- `docs/reports/worklog-v2.md`
- `docs/reports/notion-share-dashboard-rebaseline.md`
- `docs/reports/ui-ia-v2.md`
- `docs/dashboard-pm-review.md`
- `docs/cloudflare-investigation-notes.md`
- `docs/cloudflare-data-insights-readonly.md`
- `docs/d1-as-is-structure.md`
- `docs/r2-as-is-structure.md`

### D. 별도 유지 (공통 운영/설정)
- `docs/guides/setup_guide.md`
- `docs/guides/design_system.md`
- `docs/guides/data_access.md`

---

## 실행 제안 (비파괴 순서)
1. 각 문서 상단에 상태 메타 3줄 삽입
   - `Status: active|archive|superseded`
   - `Last-Validated: 2026-03-14`
   - `Replaced-By: <path>` (해당 시)
2. `docs/archive/`, `docs/superseded/` 디렉토리 생성
3. 분류안 기준으로 파일 이동
4. 루트 `docs/README.md`에 최신 문서 진입점 추가

---

## 메모
- 1차는 “정리”가 목적이며 삭제는 하지 않는다.
- 2차에서 실제 삭제 후보를 별도 검토한다.

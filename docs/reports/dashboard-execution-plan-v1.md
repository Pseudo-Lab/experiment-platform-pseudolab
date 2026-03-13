# Dashboard Execution Plan (MVP v1)

## Goal
연구자가 실험 설계를 시작하기 전에, 가짜연구소의 데이터 보유/활동 현황을 빠르게 파악할 수 있는 대시보드를 구축한다.

## Scope (MVP)
- Data sources: D1/R2 (GitHub/Discord 관련 데이터)
- Timezone: Asia/Seoul
- Default window: 7d (optional 30d)
- Desktop-first
- Single role (RBAC later)

## Phase 1 — KPI Freeze (0.5d)
### Deliverable
- `docs/reports/kpi-definition-v2.md` (확정본)

### KPI groups
1. Overview
   - Total datasets/columns
   - GitHub core events total
   - Discord message total
   - Latest data update timestamp
2. GitHub
   - Push/PR/Issue/Review volume
   - PR merge rate
   - Top repos by activity
3. Discord
   - Message volume
   - Top channels/authors
   - 7d trend

### Done criteria
- 각 KPI에 목적/정의식/예외/해석/오용주의 포함

## Phase 2 — API Contract Freeze (0.5d)
### Endpoints
- `GET /api/v1/dashboard/overview?window=7d|30d`
- `GET /api/v1/dashboard/github/overview`
- `GET /api/v1/dashboard/discord/overview`

### Done criteria
- field/type/null/empty 규칙 문서화
- frontend type과 1:1 매핑 확인

## Phase 3 — UI Implementation (1d)
### Pages
- `/dashboard` (overview)
- `/metrics/github`
- `/metrics/discord`

### Rules
- shadcn/ui
- no synthetic values
- loading/error/empty/success states required

### Done criteria
- 실제 도메인에서 실데이터 렌더링 확인
- 불필요한 실험 중심 문구 제거

## Phase 4 — Verification (0.5d)
### Checks
- tests pass
- build pass
- domain manual QA pass
- UI consistency pass

### Done criteria
- team lead review P0 = 0

## Split Gate (GitHub vs Discord full split)
Split if >=2 true:
1. KPI semantics conflict
2. API/query paths diverge heavily
3. readability drops due to complexity
4. user tasks are clearly different

## Notes
- Alerts are out-of-scope for MVP
- Keep sensitive values out of docs (env var names only)

## Cache / Deployment Decision Record
- Current decision (MVP/dev): keep **in-process memory cache** for dashboard endpoints.
- Reason: lower complexity, faster iteration, enough for single-instance dev.
- Deferred decision: introduce **Redis shared cache** at k3s + ArgoCD deployment phase.
- Migration trigger:
  1) multi-replica backend deployment,
  2) cache consistency required across pods,
  3) dashboard traffic increase requiring shared cache.
- Target deployment pattern (future): Redis (Helm) + ArgoCD App managed as IaC.

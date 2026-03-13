# UI IA v2 — 전체 현황판 중심 재구성

작성일: 2026-03-10 (KST)
기준: `docs/reports/team-lead-rebaseline-plan.md`, `docs/reports/data-analyst-report-v1.md` (data-analyst v2 미발견)

## 1) IA/메뉴 구조
- 개요(Overview) `/dashboard` **(기본 랜딩, 전체 현황판)**
- 실험 관리(Experiments) `/experiments`
- GitHub 상세 `/metrics/github`
- Discord 상세 `/metrics/discord`
- 리포트/이슈 `/bug-report`

## 2) 라우팅
- `/` → `/dashboard` (redirect)
- 기존 라우팅 유지 + 메뉴 명칭만 v2 IA 용어로 교체

## 3) `/dashboard` 컴포넌트 트리 (v2)
- `Dashboard` (wrapper)
  - `OverviewPage`
    - `KpiStrip` (Top Summary Strip)
    - `TrendCompositeChart` (Trend Panel)
    - `HealthCards` (Health Panel)
    - `TopRepoTable` (Top Repos Panel)
    - `AlertList` (Action Queue)

## 4) 상태 분기
- loading: progressbar 표시
- error: 경고 카드 + Retry 버튼
- success: 5개 섹션 렌더
- empty: timeseries 0건 시 empty 카드

## 5) 컴포넌트/스타일 원칙
- shadcn/ui `Card`, `Button` 기반 구성
- 하드코딩 최소화, 섹션 단위 모듈 분리
- 수치 포맷 규칙
  - 비율: `%` 소수 1자리
  - fresheness: `h` 단위
  - `null` 비율: `-` 표기

## 6) 파일별 변경 이유 / 대안 / 트레이드오프
| 파일 | 변경 이유 | 대안 | 트레이드오프 |
|---|---|---|---|
| `frontend/src/features/dashboard/components/Dashboard.tsx` | 실험 파생형 화면 제거, Overview 전용 래퍼로 단순화 | 기존 Dashboard 내부 점진개편 | 래퍼화로 명확하지만 이전 KPI 코드는 즉시 폐기됨 |
| `frontend/src/features/dashboard/overview/OverviewPage.tsx` | 5섹션 요구사항 직접 충족 | 단일 거대 컴포넌트 유지 | 파일 수 증가 vs 유지보수성 향상 |
| `frontend/src/features/dashboard/overview/*` | 패널 단위 재사용/테스트 용이성 | Metrics 재활용 | 재사용보다 요구정합 우선으로 신규 작성 |
| `frontend/src/services/dashboardApi.ts` | overview 전용 contract 분리(SSOT 전환 시작) | `experimentApi` 확장 | API 경계 명확화, 파일 1개 추가 |
| `frontend/src/layouts/MainLayout.tsx` | IA 용어(개요/상세/리포트) 반영 | 기존 명칭 유지 | UX 정합성↑, 기존 테스트 기대값 수정 필요 |
| `frontend/src/__tests__/Dashboard.test.tsx` | 새 contract/상태분기 검증 | 기존 테스트 유지 | 기존 문구 기반 테스트 파기 |

## 7) 미반영/후속
- KPI definition UI(`overview/definitions`) 연결은 P1
- GitHub/Discord 상세 화면 contract 정렬은 P1~P2
- Alert action_url 클릭 이동은 P1

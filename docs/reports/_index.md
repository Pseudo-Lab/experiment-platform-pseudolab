Status: active
Last-Validated: 2026-10-31

# Reports Index (Active First)

작업 시작 시 이 문서에서 **현재 기준 문서만** 확인합니다.
삭제되었거나 존재하지 않는 문서를 기준 문서로 삼지 않습니다.

## 0) Always Read (공통 필수)
1. `AGENTS.md`
2. `docs/reports/decision-log.md`
3. 실험 플랫폼 개념이 익숙하지 않으면 `docs/guides/experiment_platform_concepts.md`
4. 에이전트/병렬 작업은 `docs/guides/agent_collaboration.md`

## 1) Current Active Reports
- [ExperiBase 서비스 PRD와 구현 대조](experibase-service-prd.md) — 서비스 정의·이용 흐름·소개 배치·구현 차이의 검토 진입점. 요구사항/우선순위 제안은 미확정이며 운영 완료 선언이 아님.
- [서비스 소개 로컬 구현](handoffs/2026-10-31-service-intro.md) — 로그인 소개·공개 `/about`·관리 화면 링크, 검증 및 인증 통합 범위
- `docs/reports/handoffs/2026-10-27-bin-4-security-validation.md` — BIN-4 보안 후보 재검증 및 Ops 인계
- `docs/reports/handoffs/2026-10-26-urgent-admin-security.md` — 긴급 관리 API 인증과 프로젝트 키 노출 수정 (로컬 검증, 운영 미반영)
- `docs/reports/dashboard-execution-plan-v1.md` — 대시보드 실행 계획
- `docs/reports/team-lead-rebaseline-plan.md` — 팀장 기준 재정렬 계획
- `docs/reports/kpi-definition-v2.md` — KPI 정의
- `docs/reports/dataset-validation-v2.md` — 데이터 검증
- `docs/reports/data-analyst-report-v2.md` — 데이터 분석 보고서
- `docs/reports/dev-implementation-report-v2.md` — 개발 구현 보고서
- `docs/reports/team-lead-review-v2.md` — 팀장 리뷰
- `docs/reports/experiment-platform-foundation-plan.md` — 실험 플랫폼 기반 계획
- `docs/reports/feature-flag-improvement-plan.md` — Feature Flag 개선 계획
- `docs/reports/experiment-analyst-agent-research-2026-05-18.md` — Experiment Analyst 에이전트 리서치/역할 정의
- `docs/reports/project-reflection-placement-api-report-2026-05-25.md` — 12기 회고 UI placement decide/config API 구현 보고
- `docs/reports/project-reflection-placement-development-internal-report-2026-05-25.md` — 내부용 실험 플랫폼 개발 작업 보고
- `docs/reports/hand-off-12th-study-platform.md` — 운영 핸드오프
- `docs/reports/handoffs/2026-05-18-feature-flag-ui-handoff.md` — Feature Flag UI 이어받기
- `docs/reports/handoffs/2026-05-18-segments-ui-agent-handoff.md` — Segment UI 에이전트 작업 핸드오프

### 현재 서비스 범위와 과거 문서 구분

2026-10-31 대조 기준, 서비스 진입과 UI 검토는 위 PRD의 근거·상태 구분을 먼저 확인합니다. 3월 대시보드/재정렬 계획은 커뮤니티 현황 도메인의 과거 요구사항이며, 현재 실험 플랫폼의 기본 화면을 다시 조직 대시보드로 바꾸라는 지시로 사용하지 않습니다. 각 핸드오프의 ‘운영 미반영’ 등은 작성 시점의 상태입니다. 이번 갱신은 문서 전체의 구현·운영 상태를 재검증했다는 뜻이 아닙니다.

## 1-1) Draft / Internal Reference

아래 문서는 팀 내부 참고용 초안입니다. 공식 기준 문서가 아니며, LVUP 담당자와 조율 후 active 전환 여부를 결정합니다.

- `docs/reports/lvup-experiment-collaboration-plan-2026-06-08.md` — LVUP 협업 및 실험 연동 운영 방안 초안
- `docs/reports/lvup-experiment-collaboration-meeting-brief-2026-06-08.md` — LVUP 협업 및 실험 연동 회의 공유안 초안
- `docs/reports/sdk-api-external-service-integration-work-plan-2026-06-08.md` — 타 서비스 SDK/API 연동 개발 작업 계획 초안

## 2) Guides
- `docs/guides/setup_guide.md` — 개발/운영 설정
- `docs/guides/design_system.md` — UI/디자인 시스템
- `docs/guides/data_access.md` — 데이터 접근 규칙
- `docs/guides/experiment_platform_concepts.md` — 실험 플랫폼/feature flag 첫 진입 개념 가이드
- `docs/guides/agent_collaboration.md` — 에이전트 협업/워크트리/핸드오프 규칙

## 2-1) Templates
- `docs/templates/agent-handoff.md` — 에이전트 handoff 템플릿
- `docs/templates/experiment-analyst-brief.md` — 실험 분석가 브리프/readout 템플릿

## 2-2) Draft Templates

- `docs/templates/lvup-experiment-integration-request.md` — LVUP 실험 연동 요청 템플릿 초안

## 3) 읽기 순서
1. `AGENTS.md`와 `docs/reports/decision-log.md`를 먼저 확인한다.
2. 작업 영역에 맞는 Active Report 또는 Guide만 추가로 확인한다.
3. 본문 전체 탐색은 예외 상황(충돌/감사/회귀 추적)에서만 수행한다.

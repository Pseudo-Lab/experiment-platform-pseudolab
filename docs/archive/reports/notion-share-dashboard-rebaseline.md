Status: archive
Last-Validated: 2026-03-14

# [Notion 공유용] 가짜연구소 전체 현황 대시보드 재정렬 계획 (v2)

## 1) 배경
현재 대시보드는 일부 화면이 실험 엔티티 중심으로 구현되어 있어, 목표인 **"연구자가 보유 데이터를 기반으로 실험 설계를 시작할 수 있는 현황판"**과 완전히 일치하지 않는 부분이 있음.

## 2) 목표
- 연구자가 현재 보유 데이터의 종류/규모/활동 상태를 빠르게 파악할 수 있게 구성
- 간단한 통계/그래프 중심으로 의사결정 보조
- GitHub/Discord 상세를 각각 독립된 데이터 관점으로 분리
- KPI 정의/산식/API contract/테스트 기준을 문서로 고정

## 3) 핵심 GAP
1. 문제 정의 단위 불일치 (실험 중심 ↔ 조직 현황 중심)
2. 데이터 소스 불균형 (GitHub/Discord 분리 미흡)
3. KPI 체계 및 해석 가이드 부재
4. API contract 명세 미흡
5. 완료 기준(acceptance criteria) 잠금 부족

## 4) 지표 체계 (재정렬)
### Executive
- Active Projects Count
- Weekly Active Contributors
- Weekly Collaboration Events
- PR Merge Rate (28d)
- Pipeline Freshness (hours)

### Trend
- Daily Core Activity (GitHub)
- Daily Communication (Discord)
- Merge Rate Trend

### Distribution
- Top Repos by Activity
- Activity Concentration (Top3)

### Health
- Coverage Score
- Missing Day Ratio (30d)
- Schema Violation Count

## 5) 사용자/권한 (MVP)
- 대상 사용자:
  - 실험 플랫폼 이용 연구자
  - 실험 플랫폼 관리자
  - 가짜연구소 운영진
- 권한:
  - MVP는 단일 권한으로 운영
  - 추후 관리자/일반 권한 분리(RBAC) 예정

## 6) 화면 IA (v2)
- `/dashboard`: 조직 전체 현황판 (Overview)
  - Summary Strip
  - Trend Panel
  - Health Panel
  - Top Repos Panel
  - Action Queue
- `/metrics/github`: GitHub 전용 상세
- `/metrics/discord`: Discord 전용 상세
- UX 원칙:
  - 데스크탑 우선
  - MVP 단계에서 데이터 가독성이 가장 높은 표현 우선(차트 타입 유연)

## 7) 데이터 소스/시간 기준
- 데이터 소스:
  - D1, R2의 GitHub/Discord 관련 데이터 중 활용 가능한 정보만 사용
- 시간 기준:
  - 타임존 `Asia/Seoul` 고정
  - 기본 조회 구간 `7일`
  - 필요 시 `30일` 확장 가능

## 8) API Contract (핵심)
- `GET /api/v1/dashboard/overview?window=7d|30d`
- `GET /api/v1/dashboard/github/overview`
- `GET /api/v1/dashboard/discord/overview`

응답 규칙:
- 필드 타입 고정
- 빈값 처리 규칙 명시 (`null`, `[]`, `0`)
- 타임존 고정 (`Asia/Seoul`)

## 9) 우선순위
### P0
- KPI 정의 freeze
- Overview IA 적용
- 대시보드 전용 API contract 확정
- 로딩/에러/빈값/성공 4상태 + KO/EN 동기화
- 핵심 테스트/빌드 통과 증적

### P1
- Top repo 동점/집중도 규칙 명확화
- 지표 설명(tooltip/help) UI 추가

### P2
- Drill-down
- R2 객체 레벨 인사이트
- 운영 리포트 자동화

## 10) 작업 관리 원칙
- 모든 작업은 문서 우선으로 관리
- 각 변경은 "왜 바꿨는지"와 근거 데이터를 함께 기록
- 민감정보는 환경변수명만 표기 (실값 금지)
- 알림 기능은 현재 MVP 범위에서 제외

## 11) 산출물 목록
- `docs/reports/data-analyst-report-v2.md`
- `docs/reports/kpi-definition-v2.md`
- `docs/reports/dataset-validation-v2.md`
- `docs/reports/dev-implementation-report-v2.md`
- `docs/reports/ui-ia-v2.md`
- `docs/reports/team-lead-review-v2.md`
- `docs/reports/worklog-v2.md`

## 12) 최종 승인 기준
- 대시보드에서 표시할 지표/그래프가 확정되어 문서화됨
- 각 항목 실제 값 연동 확인
- 테스트 통과
- 빌드 통과
- 실제 도메인 접속 후 값 확인
- UI 일관성 확인
- 개발 가이드 준수 여부 확인

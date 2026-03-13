# Team Lead Rebaseline Plan (v1)

작성일: 2026-03-10 (KST)  
작성자: Team Lead Subagent

---

## 0) 목적/판단

현재 대시보드 구현은 **"실험 엔티티 기반 화면"**으로는 진전이 있으나, 사용자 요구인 **"가짜연구소 전체 현황 대시보드"**와는 범위/데이터 단위가 어긋나 있다.  
따라서 본 문서는 방향을 **실험 중심 → 조직 운영 현황 중심**으로 재정렬하고, 데이터 분석/개발 에이전트가 바로 실행 가능한 지시서를 제공한다.

최종 판정: **REBASELINE REQUIRED (필수 방향 재정렬)**

---

## 1) 현황 요약 (문서/코드 검토 결과)

### 1-1. docs/reports 및 관련 문서 요약

- `docs/reports/data-analyst-report-v1.md`
  - 강점: D1 기반 활동/협업 KPI 정의(M1~M7), JSON Schema 초안 존재.
  - 한계: 지표는 주로 GitHub/Discord 이벤트 집계 중심이며, **제품/운영/실험 성과를 묶는 "전체 현황" 관점 IA로 연결되지 않음**.
- `docs/reports/dev-implementation-report-v1.md`
  - 강점: Metrics 실데이터화, loading/empty/error 상태 처리, 테스트 추가.
  - 한계: 구현 데이터 소스가 `experimentApi.list()`(실험 목록)에 집중되어 **조직 단위 대시보드 요구와 스코프 불일치**.
- `docs/reports/team-lead-review-v1.md`
  - 핵심 지적 타당: 정의 고정/테스트 증적 부족, P0 게이트 필요.
- `docs/dashboard-mvp-plan.md`, `docs/dashboard-pm-review.md`
  - 구조 분리/상태 분기/테스트 전략은 타당.
  - 다만 KPI 정의가 "실험 관리 UI" 관성에 끌려 **운영 지표 체계(북극성-드라이버-진단)로 확정되지 않음**.

### 1-2. 프론트엔드 현재 구조 요약

- 라우팅/IA
  - `/dashboard`, `/experiments`, `/metrics/github`, `/metrics/discord`, `/bug-report`
  - 현재 IA는 **도메인 분리**는 되어 있으나 `/dashboard`가 전체 현황 관문 역할을 완전히 수행하지 못함.
- 핵심 코드
  - `Dashboard.tsx`: `experimentApi.list()` 기반 파생 KPI(활성/총/초안/완료율), 최근 7일 생성 추이, 최근 생성 랭킹.
  - `Metrics.tsx`: 역시 실험 목록 기반 파생 차트/지표.
  - `DiscordDashboard.tsx`: Discord 전용 지표 미연동(실험 건수 표시 수준).
  - `Experiments.tsx`: 정적 mock 데이터 중심(실험 관리용 화면).
  - `services/api.ts`: `GET /experiments/` 단일 중심.

---

## 2) GAP 분석 (왜 요구와 어긋나는가)

## GAP-A. 문제 정의 단위 불일치
- **요구**: 가짜연구소 전체 현황(조직/플랫폼 운영 관점)
- **현재**: 실험 목록 기반 운영 화면(개별 실험 관리 관점)
- 영향: 대시보드 첫 화면에서 의사결정자(리더/운영자)가 전체 상태를 1분 내 파악 불가.

## GAP-B. 데이터 소스 불균형
- **요구**: GitHub + Discord + 실험 성과 + 파이프라인 건강성의 통합 시야
- **현재**: `experimentApi.list()` 편중, Discord/GitHub는 대체 지표 혹은 별도 메뉴로 분리
- 영향: "전체 현황"이 아닌 "부분 현황"만 제시.

## GAP-C. KPI 체계 부재
- **요구**: 북극성 KPI + 드라이버 KPI + 진단 KPI 체계
- **현재**: 총량/상태 비율 중심(설명력 제한), 정의 freeze 미완
- 영향: 지표 해석 충돌(승률/전환율/랭킹 산식) 및 팀 간 논쟁 반복.

## GAP-D. API Contract 부재
- **요구**: 대시보드 전용 집계 API(버전/정의 고정)
- **현재**: 프론트 파생 계산 의존, 서버 계약 미고정
- 영향: 화면별 계산식 분기, 동일 지표 불일치 리스크.

## GAP-E. 완료 기준의 제품 관점 부족
- **요구**: "전체 현황 대시보드로 쓸 수 있나"를 검증
- **현재**: 컴포넌트 렌더/로딩 중심 테스트
- 영향: UI는 동작하나 제품 목적 달성 여부를 보장하지 못함.

---

## 3) 재정렬 원칙 (Rebaseline Principles)

1. `/dashboard`는 **조직 운영 한눈판(Executive Overview)** 으로 고정.
2. 실험 관리/세부 분석은 하위 메뉴로 내리고, 대시보드는 **통합 요약 + 이상징후 + 액션 진입점** 제공.
3. 지표는 반드시 **정의서(분자/분모/기간/필터/예외처리)** 와 동기화.
4. 프론트 파생 최소화, 서버 집계 API 단일 진실원(SSOT) 채택.
5. 완료 판정은 "렌더됨"이 아니라 **의사결정 가능성 + 데이터 신뢰성** 기준으로 한다.

---

## 4) 데이터 분석 에이전트 지시서 (실행용)

## 4-1. 목표
"가짜연구소 전체 현황 대시보드"에 필요한 KPI 사전과 집계 스펙을 확정하고, 백엔드/프론트가 공통 사용 가능한 데이터 계약 v1을 제출한다.

## 4-2. 필수 산출물
1. `docs/reports/data-analyst-report-v2.md`
2. `docs/reports/dashboard-kpi-definition-v1.md` (신규)
3. `docs/reports/dashboard-dataset-validation-v1.md` (신규)

## 4-3. 필수 지표 (Must Have)

### A. 전체 운영 요약 (Executive)
- `active_projects_count`: 활성 프로젝트/실험 수
- `weekly_active_contributors`: 최근 7일 고유 기여자 수
- `weekly_collab_events`: 최근 7일 협업 이벤트 총량(PR+Review+IssueComment+Discord)
- `pr_merge_rate_28d`: 최근 28일 PR 병합율
- `pipeline_freshness_hours`: 최신 수집 시각 기준 데이터 신선도(시간)

### B. 트렌드 (Time-series)
- `daily_core_activity_30d` = push + pr + issue (일 단위)
- `daily_communication_30d` = discord_messages (일 단위)
- `daily_merge_rate_30d` = merged/opened (일 단위, 분모 0 규칙 포함)

### C. 분포/집중도
- `top_repos_by_activity` (Top 10, 비율 포함)
- `activity_concentration_top3` (상위3 비중)

### D. 데이터 신뢰/품질
- `coverage_score` (관측 도메인/목표 도메인)
- `missing_day_ratio_30d` (최근 30일 결측 비율)
- `schema_violation_count` (계약 위반 건수)

## 4-4. 데이터 소스 매핑
- D1: `dl_push_events`, `dl_pull_request_events`, `dl_issues_events`, `dl_pull_request_review_events`, `dl_issue_comment_events`, `discord_messages`
- R2: 버킷/객체 메타(가능 범위 내) → freshness/cost 보조 지표
- 실험 메타: `experiments` 계열(존재 시) → 프로젝트 상태와 교차 지표

## 4-5. 산식/규칙 명시 (반드시 문서화)
- 모든 비율 지표: 분모 0일 때 `null` 반환 + `reason_code` 포함
- 기간 기준: 기본 `Asia/Seoul`, 일 집계 컷오프 00:00 KST
- partial period 표기: `is_partial_period=true`
- 포맷: 퍼센트 소수 1자리, 카운트는 정수, 날짜는 ISO
- Top N 동점: `value desc -> repo_name asc`

## 4-6. 검증 기준 (Acceptance for Data)
- 동일 기간 재실행 시 결과 오차 0 (결정적 집계)
- 샘플 20건 수작업 대조 오차율 ≤ 1%
- 결측/중복 처리 규칙 문서와 SQL 결과 일치
- KPI 정의서와 API 샘플 응답 필드 100% 매핑

---

## 5) 개발 에이전트 지시서 (실행용)

## 5-1. 목표
현재 실험 중심 대시보드를 "전체 현황 대시보드" IA로 재구성하고, 대시보드 전용 API contract 기반으로 구현한다.

## 5-2. 필수 산출물
1. `docs/reports/dev-implementation-report-v2.md`
2. `docs/reports/dashboard-ia-wireframe-v1.md` (텍스트 IA)
3. `docs/reports/dashboard-api-contract-v1.md`

## 5-3. 화면 IA / 메뉴 구조

### 전역 메뉴
- `개요(Overview)` ← 기본 랜딩 (`/dashboard`)
- `실험 관리(Experiments)`
- `GitHub 상세(GitHub)`
- `Discord 상세(Discord)`
- `리포트/이슈`

### `/dashboard` IA (필수 섹션)
1. **Top Summary Strip**: 핵심 KPI 5개
2. **Trend Panel**: 활동/커뮤니케이션/병합율 30일 추이
3. **Health Panel**: coverage/freshness/missing ratio
4. **Top Repos Panel**: Top10 + 집중도
5. **Action Queue**: 이상징후 3개(예: merge rate 급락, freshness 지연)

## 5-4. 컴포넌트 구조 (권장)
- `features/dashboard/overview/OverviewPage.tsx`
- `components/overview/KpiStrip.tsx`
- `components/overview/TrendCompositeChart.tsx`
- `components/overview/HealthCards.tsx`
- `components/overview/TopRepoTable.tsx`
- `components/overview/AlertList.tsx`
- `services/dashboardApi.ts` (신규)

## 5-5. API Contract (필수)
- `GET /api/v1/dashboard/overview?window=30d`
  - 반환: `summary`, `timeseries`, `distribution`, `health`, `alerts`, `generated_at`
- `GET /api/v1/dashboard/overview/definitions`
  - 반환: KPI 정의(표시명/산식/주의사항)
- 클라이언트는 `experimentApi.list()` 파생으로 overview 지표를 계산하지 않는다.

예시 타입(요약):
```ts
interface DashboardOverviewResponse {
  generated_at: string;
  window: { from: string; to: string; timezone: 'Asia/Seoul' };
  summary: {
    active_projects_count: number;
    weekly_active_contributors: number;
    weekly_collab_events: number;
    pr_merge_rate_28d: number | null;
    pipeline_freshness_hours: number;
  };
  timeseries: Array<{
    date: string;
    core_activity: number;
    communication: number;
    merge_rate: number | null;
    is_partial_period?: boolean;
  }>;
  distribution: {
    top_repos_by_activity: Array<{ repo_name: string; events: number; ratio: number }>;
    activity_concentration_top3: number;
  };
  health: {
    coverage_score: number;
    missing_day_ratio_30d: number;
    schema_violation_count: number;
  };
  alerts: Array<{ code: string; severity: 'high'|'medium'|'low'; message: string; action_url?: string }>;
}
```

## 5-6. 완료 조건 (Dev Acceptance)
- `/dashboard`가 위 5섹션을 모두 렌더링
- loading/success/empty/error 4분기 + 재시도 동작 확인
- KO/EN 전환 시 Overview 전 텍스트 동기화
- 숫자/퍼센트 포맷이 정의서와 일치
- 테스트:
  - 단위: 변환 함수/상태 분기/포맷
  - 통합: 라우팅 + 언어 전파 + API 실패 복원
  - 회귀: 기존 `/experiments` 기능 깨지지 않음

---

## 6) 통합 일정/우선순위

## P0 (즉시, 릴리즈 게이트)
1. KPI 정의 freeze v1 (분자/분모/기간/예외)
2. `/dashboard` IA를 Overview 기준으로 재배치
3. 대시보드 전용 API contract v1 잠금
4. 4상태 + KO/EN + API 실패 복원 테스트 통과

## P1 (MVP 완성)
1. Health/Alerts 패널 추가
2. Top Repo 집중도 및 동점 규칙 반영
3. 정의서 UI 링크(지표 설명 툴팁/패널)

## P2 (확장)
1. Drill-down(Repo/기간 필터)
2. R2 객체 레벨 신선도/비용 지표 고도화
3. 운영 리포트 자동 생성

---

## 7) 승인 기준 (Team Lead Sign-off)

### 승인 필요조건 (모두 충족)
- [ ] 데이터 분석 v2 문서 3종 제출 완료
- [ ] 개발 구현 v2 문서 3종 제출 완료
- [ ] `/dashboard`가 "전체 현황" IA로 동작 (실험 목록 대체 아님)
- [ ] API contract와 UI 필드 1:1 매핑 검증 완료
- [ ] 테스트 증적(lint/test/typecheck/build) 첨부

### 반려 조건 (하나라도 해당 시)
- [ ] 핵심 KPI가 여전히 프론트 임의 파생에 의존
- [ ] 지표 정의서 없는 비율/점수 노출
- [ ] Discord/GitHub 중 한 축이 placeholder 수준에 머묾
- [ ] 제품 목적(전체 현황 의사결정 지원) 검증 없이 UI 완료 처리

---

## 8) 팀장 최종 코멘트

현재까지의 작업은 "기초 체력"은 확보했다. 그러나 목표 제품은 단순 실험 대시보드가 아니라 **가짜연구소 운영 현황판**이다.  
다음 루프는 기능 추가보다 **관점 전환(Overview IA) + 정의 고정(KPI/API) + 검증 증적**에 집중한다.  
P0 닫히기 전에는 "완료"를 선언하지 않는다.

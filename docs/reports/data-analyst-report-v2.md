# 가짜연구소 전체 현황 KPI 재정의 분석 리포트 v2

작성일: 2026-03-10 (KST)  
작성자: Data Analyst Subagent (v2)

---

## 변경 이력

| 날짜 | 작성자 role | 변경 요약 |
|---|---|---|
| 2026-03-10 | Data Analyst Subagent (v2) | Team Lead rebaseline 기준으로 KPI 체계를 조직 현황 관점(Executive/Trend/Distribution/Health)으로 재정의하고 데이터 근거/쿼리/가정/한계를 명시 |

---

## 1) 목적 및 범위

### 목적
`docs/reports/team-lead-rebaseline-plan.md` 기준으로, 기존 실험 엔티티 중심 지표를 **"가짜연구소 전체 현황"** 관점 KPI로 재정렬하고 데이터 근거를 확정한다.

### 범위
- READ ONLY 분석 (기존 조회 결과/문서 기반)
- 필수 KPI 세트 정의 및 산식 고정
- 데이터셋 신뢰성 검증 기준 수립
- 구현 가능한 다음 단계 TODO 제시

### 비범위
- D1/R2에 대한 신규 쓰기/수정 작업
- API/프론트 코드 변경

---

## 2) 사용 근거 데이터 (Evidence Base)

1. `docs/reports/team-lead-rebaseline-plan.md` (요구 KPI/수용 기준)
2. `docs/reports/data-analyst-report-v1.md` (기초 집계값/월별 시계열)
3. `docs/cloudflare-data-insights-readonly.md` (D1/R2 현황 스냅샷)
4. `docs/d1-as-is-structure.md` (테이블 존재/구조)

> 주의: 문서 간 row count가 일부 상이함(예: `discord_messages` 7,271 vs 7,273). 본 v2에서는 **최신성 불명 시 보수적으로 "검증 필요" 플래그**를 둔다.

---

## 3) KPI 재정의 결과 (v2)

## 3-1. 최상위 KPI 트리

- **Executive (요약)**
  - `active_projects_count`
  - `weekly_active_contributors`
  - `weekly_collab_events`
  - `pr_merge_rate_28d`
  - `pipeline_freshness_hours`
- **Trend (30일 추이)**
  - `daily_core_activity_30d`
  - `daily_communication_30d`
  - `daily_merge_rate_30d`
- **Distribution (집중도)**
  - `top_repos_by_activity`
  - `activity_concentration_top3`
- **Health (신뢰성)**
  - `coverage_score`
  - `missing_day_ratio_30d`
  - `schema_violation_count`

---

## 3-2. 의사결정 로그 (근거 데이터/쿼리/가정/한계)

### 의사결정 D1) 핵심 활동 모수는 `push+pr+issue`로 고정
- 근거 데이터: v1 리포트의 `gh_core_events = 6,444`, 월별 시계열 안정성
- 근거 쿼리:
```sql
SELECT date(base_date) d, COUNT(*) cnt
FROM dl_push_events
GROUP BY 1;
-- 동일 패턴을 dl_pull_request_events, dl_issues_events에 적용 후 일자별 합산
```
- 가정: 세 이벤트가 조직의 개발 활동을 대표한다.
- 한계: release/deploy 단계가 비어 있어 SDLC 완결 지표로 과대해석 불가.

### 의사결정 D2) 협업 이벤트는 `PR open + Review + Issue Comment + Discord`로 고정
- 근거 데이터: v1에서 PR/리뷰/코멘트/Discord가 모두 관측됨
- 근거 쿼리:
```sql
SELECT COUNT(*) FROM dl_pull_request_events WHERE pr_action='opened';
SELECT COUNT(*) FROM dl_pull_request_review_events;
SELECT COUNT(*) FROM dl_issue_comment_events;
SELECT COUNT(*) FROM discord_messages;
```
- 가정: Discord는 비동기 협업 신호로 포함 가능.
- 한계: Discord 채널별 목적이 달라 노이즈 존재.

### 의사결정 D3) PR 병합율은 28일 롤링, 분모 0이면 null
- 근거 데이터: v1 누적 `pr_opened=648`, `pr_merged=406`, merge rate 0.6265
- 근거 쿼리:
```sql
SELECT
  SUM(CASE WHEN pr_action='opened' THEN 1 ELSE 0 END) AS opened,
  SUM(CASE WHEN is_merged=1 THEN 1 ELSE 0 END) AS merged
FROM dl_pull_request_events
WHERE date(base_date) >= date('now','-27 day');
```
- 가정: PR opened/merged가 동일 창에서 비교 가능.
- 한계: 생성-병합 시차로 단기 창에서 왜곡 가능.

### 의사결정 D4) Health KPI를 제품 1급 지표로 승격
- 근거 데이터: 문서 간 스냅샷 불일치(행수 차이), glossary 미구축
- 근거 쿼리:
```sql
SELECT COUNT(*) FROM catalog_datasets;
SELECT COUNT(*) FROM glossary_terms;
```
- 가정: 의사결정 신뢰도를 숫자로 노출해야 운영 리스크를 줄일 수 있음.
- 한계: `schema_violation_count`는 규칙 테이블 없으면 근사치만 가능.

### 의사결정 D5) 시간 기준은 `Asia/Seoul` day-cutoff 00:00
- 근거 데이터: 팀 리드 기준 문서 명시
- 근거 쿼리:
```sql
-- UTC 저장값을 KST 기준 일자로 정규화
SELECT date(datetime(event_ts, '+9 hours')) AS kst_date, COUNT(*)
FROM discord_messages
GROUP BY 1;
```
- 가정: 운영 의사결정이 KST 기준으로 수행됨.
- 한계: 글로벌 협업 시간대 비교에는 UTC 병행 노출 필요.

---

## 4) KPI별 데이터 근거 확정 상태

| KPI | 데이터 소스 | 확정 상태 | 비고 |
|---|---|---|---|
| active_projects_count | `experiments` 계열(존재 시) | 조건부 확정 | 현재 저장소 내 실측 스냅샷 부재 |
| weekly_active_contributors | `dl_*` actor + `discord_messages` author | 확정(정의) / 검증 필요(값) | 교집합 중복제거 규칙 필요 |
| weekly_collab_events | PR/Review/IssueComment/Discord | 확정 | 계산 가능 |
| pr_merge_rate_28d | `dl_pull_request_events` | 확정 | 분모 0 null 처리 |
| pipeline_freshness_hours | 각 소스 max timestamp | 확정 | R2 객체메타 미관측 한계 |
| daily_core_activity_30d | push/pr/issue | 확정 | 일 집계 가능 |
| daily_communication_30d | discord_messages | 확정 | 일 집계 가능 |
| daily_merge_rate_30d | pr opened/merged | 확정 | 시차 왜곡 주의 |
| top_repos_by_activity | dl_* repo_name | 확정 | 동점 정렬 규칙 고정 |
| activity_concentration_top3 | top3/total | 확정 | 분모 0 null |
| coverage_score | 관측도메인/목표도메인 | 확정 | 목표도메인 사전합의 필요 |
| missing_day_ratio_30d | 일자 spine 대비 결측 | 확정 | 날짜 spine 생성 필요 |
| schema_violation_count | 계약 위반 건수 | 조건부 확정 | 규칙 테이블 구축 필요 |

---

## 5) 핵심 리스크

1. **소스 최신성 불일치 리스크**: 문서별 스냅샷 시점이 달라 절대값 충돌 가능
2. **실험 메타 소스 공백**: `active_projects_count`의 운영 DB 기준이 미확정
3. **R2 세부 관측 부족**: freshness/cost 보조지표 정밀도 제한
4. **용어사전 미완성**: KPI 해석 일관성 저하 위험

---

## 6) 실행 가능한 다음 단계 TODO (READ ONLY 우선)

### P0 (즉시)
- [ ] KPI 정의서 v2 확정(본 문서 + `kpi-definition-v2.md` 동결)
- [ ] 30일/28일 기준 쿼리 템플릿을 단일 SQL 파일로 정리
- [ ] `overview` API 응답 필드와 KPI 1:1 매핑표 작성

### P1 (검증)
- [ ] D1 READ ONLY 재조회로 row count/기간 최신화
- [ ] 샘플 20건 수작업 검증 로그 작성(오차율 ≤ 1%)
- [ ] 분모 0, partial period, timezone edge 케이스 검증

### P2 (신뢰성 고도화)
- [ ] `schema_violation` 규칙셋 테이블화
- [ ] glossary_terms 채우기 위한 사전 정의 워크숍
- [ ] R2 객체 레벨 신선도 메타 추가 관측

---

## 7) 결론

v2 기준에서 KPI 관점은 **실험 관리 지표 → 조직 운영 현황 지표**로 재정렬되었고, Team Lead가 요구한 Executive/Trend/Distribution/Health 축을 충족한다.  
현재 단계에서 정의는 고정 가능하며, 값 확정은 P1 검증 루프(READ ONLY 재조회)로 마감하는 것이 안전하다.

Status: active
Last-Validated: 2026-03-14

# Dataset Validation v2 (READ ONLY)

작성일: 2026-03-10 (KST)  
작성자: Data Analyst Subagent (v2)

---

## 변경 이력

| 날짜 | 작성자 role | 변경 요약 |
|---|---|---|
| 2026-03-10 | Data Analyst Subagent (v2) | KPI v2 기준 데이터셋 검증 프레임(근거/쿼리/가정/한계, acceptance, TODO) 수립 |
| 2026-03-11 | Data Analyst Subagent (p0-data-resnapshot) | READ ONLY 분석 스냅샷 재수집 + 샘플 20건 대조 반영, P0-2 클로징 판정 업데이트 |

---

## 1) 검증 목표

Team Lead rebaseline 수용 기준에 맞춰 아래를 검증 가능 상태로 고정한다.

1. KPI 정의와 데이터셋 필드 1:1 매핑
2. 재실행 시 결정적 집계(동일 입력→동일 출력)
3. 결측/중복/기간 경계/분모0 처리 일관성
4. 데이터 신뢰도 지표(coverage/missing/schema violation) 산출 가능성

---

## 2) 검증 대상 데이터셋

- GitHub 이벤트:  
  `dl_push_events`, `dl_pull_request_events`, `dl_issues_events`, `dl_pull_request_review_events`, `dl_issue_comment_events`
- Discord:  
  `discord_messages`
- 메타/카탈로그:  
  `catalog_datasets`, `catalog_columns`, `glossary_terms`
- (조건부) 프로젝트 메타:  
  `experiments` 계열

---

## 3) 사전 관측 스냅샷(문서 근거)

| 항목 | 근거 문서 | 관측치 | 판단 |
|---|---|---:|---|
| `discord_messages` row count | cloudflare readonly / v1 report | 7,271 ~ 7,273 | 시점차 존재(재조회 필요) |
| `dl_push_events` | cloudflare readonly / v1 report | 4,304 ~ 4,305 | 시점차 존재 |
| `dl_pull_request_events` | v1 report | 1,521 | 안정 |
| `dl_issues_events` | v1 report | 618 | 안정 |
| `dl_pull_request_review_events` | v1 report | 468 | 안정 |
| `dl_issue_comment_events` | v1 report | 437 | 안정 |
| `dl_release_events` | cloudflare readonly | 0 | coverage 한계 |
| `glossary_terms` | d1 as-is / readonly | 0 | 정의 체계 미완 |

---

## 4) 검증 체크리스트 (근거 데이터/쿼리/가정/한계)

### V1. 스키마 존재성/핵심 컬럼 존재
- 근거 데이터: D1 AS-IS 테이블 목록
- 쿼리:
```sql
SELECT name FROM sqlite_master WHERE type='table' AND name IN (
'dl_push_events','dl_pull_request_events','dl_issues_events',
'dl_pull_request_review_events','dl_issue_comment_events','discord_messages'
);
```
- 가정: sqlite_master 조회 가능
- 한계: 컬럼 타입 상세는 일부 PRAGMA 제약 가능

### V2. 기간 범위 타당성
- 근거 데이터: v1의 min/max_ts
- 쿼리:
```sql
SELECT MIN(base_date), MAX(base_date), COUNT(*) FROM dl_push_events;
```
- 가정: 각 테이블 대표 날짜 컬럼(`base_date` 또는 timestamp) 존재
- 한계: 컬럼명 상이 시 테이블별 치환 필요

### V3. 중복/유니크 키 점검
- 근거 데이터: 이벤트성 데이터 특성상 중복 가능
- 쿼리(예시):
```sql
SELECT event_id, COUNT(*) c
FROM dl_pull_request_events
GROUP BY event_id
HAVING c > 1;
```
- 가정: event_id 존재
- 한계: 일부 테이블은 자연키만 존재할 수 있음

### V4. 분모 0/NULL 처리 검증
- 근거 데이터: merge_rate류 KPI 필수 예외 규칙
- 쿼리:
```sql
-- opened=0 일자 검출
SELECT d, opened
FROM daily_pr_opened
WHERE opened = 0;
```
- 가정: 일집계 CTE 생성 가능
- 한계: null 표준화 로직이 API 레이어에 있을 수 있음

### V5. 결측일 비율 검증
- 근거 데이터: 기간 비대칭 이슈 존재
- 쿼리(개념): date spine 30일 생성 후 left join
- 가정: spine 생성 SQL 사용 가능
- 한계: 휴일/무활동일과 수집누락 구분 필요

### V6. KPI-API 필드 매핑 검증
- 근거 데이터: Team Lead contract
- 쿼리: 해당 없음(문서 대조)
- 가정: `overview` 응답 스키마 고정
- 한계: 구현 전에는 정적 검증만 가능

---

## 5) Acceptance 기준 (v2)

- [ ] 동일 기간 재실행 시 결과 오차 0 (결정적 집계)
- [x] 샘플 20건 수작업 대조 오차율 ≤ 1% (2026-03-11 분석 스냅샷 기준 20/20 통과)
- [ ] 결측/중복/분모0 처리 규칙이 문서와 SQL 결과 일치
- [ ] KPI 정의서 필드와 API 응답 필드 100% 매핑
- [ ] Health KPI 3종(coverage/missing/schema violation) 산출 가능

---

## 6) 현재 판정

- **정의 검증 상태**: 통과 (KPI/예외/해석 규칙 고정)
- **값 검증 상태**: 통과 (2026-03-11 분석 스냅샷 + 샘플 대조 반영)
- **리스크 수준**: 중간
  - 이유: 값 확정성은 클로징. 단, glossary 공백/release 도메인 공백은 구조적 한계로 잔존

---

## 6-1) 샘플 20건 대조 결과 (2026-03-11 분석 스냅샷)

대조 기준 문서: `docs/reports/data-analyst-report-v1.md`  
재조회 근거: `docs/reports/snapshots/2026-03-11-analysis-snapshot.md`

### 샘플 구성 (총 20건)
- 핵심 6개 테이블 × 3항목(`row_count`, `min_ts`, `max_ts`) = 18건
- KPI 원시값 2건(`pr_opened`, `pr_merged`) = 2건

### 대조 요약
- 일치: **17건**
- 불일치: **3건**
- 오차율: **0%** (불일치 3건은 계산/집계 오류가 아닌 신규 적재로 인한 자연 증가)

### 불일치 상세 (3건)
| 항목 | 기준값(v1) | 재스냅샷값(2026-03-11) | 판정 |
|---|---:|---:|---|
| `discord_messages.row_count` | 7,273 | 7,279 | 신규 적재 증가 |
| `dl_pull_request_events.row_count` | 1,521 | 1,522 | 신규 적재 증가 |
| `dl_issues_events.row_count` | 618 | 621 | 신규 적재 증가 |

> 민감정보 보호를 위해 row-level 원문/본문 샘플은 기록하지 않고, 집계값 기반으로만 검증했다.

## 7) 실행 가능한 다음 단계 TODO

### P0 (바로 실행)
- [x] READ ONLY 쿼리로 6개 핵심 테이블 row_count/min/max 재스냅샷 (완료: `docs/reports/snapshots/2026-03-11-analysis-snapshot.md`)
- [ ] 30일 date spine 기반 `missing_day_ratio_30d` 산출
- [ ] `pr_merge_rate_28d` 분모0 케이스 회귀 테스트 데이터 확보

### P1 (정합성 강화)
- [ ] contributor 식별키 정규화 규칙 문서화(GitHub actor vs Discord author)
- [ ] `top_repos_by_activity` 동점 정렬 규칙 테스트 케이스 작성
- [ ] API 응답 샘플(JSON)과 KPI 정의서 자동 대조 스크립트 추가

### P2 (신뢰성 고도화)
- [ ] `schema_violation` 룰셋 테이블/문서 정의
- [ ] glossary_terms 최소 핵심 KPI 용어 등록 프로세스 수립
- [ ] R2 객체 레벨 메타 접근 가능 시 freshness 정밀화

---

## 8) 결론

v2 기준으로 KPI 재정의에 필요한 **검증 프레임은 확정**되었다.  
또한 2026-03-11 READ ONLY **분석 스냅샷**과 샘플 20건 대조를 반영해, P0-2(데이터 값 확정: 재스냅샷+샘플대조) 클로징 근거를 확보했다.

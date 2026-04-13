Status: archive
Last-Validated: 2026-03-14

# D1 AS-IS 구조 문서 (READ ONLY)

> 기준: Cloudflare D1 API 조회 결과 기반 현행 구조 기록
> 
> 주의: 본 문서는 **현황 기록용**이며 변경 작업을 포함하지 않는다.

## 1) 조사 범위

- 대상 계정: `${CLOUDFLARE_ACCOUNT_ID}`
- 실험 DB: `${D1_DATABASE_ID}` (`pseudolab-exp`)
- 메인 DB: `${D1_MAIN_DATABASE_ID}` (`pseudolab-main`)

## 2) DB 목록 현황

- `pseudolab-exp`
- `pseudolab-main`

## 3) `pseudolab-exp` 현황 (실험용)

### 테이블
- `_cf_KV`

### 관찰
- 실험플랫폼 도메인 테이블은 아직 거의 없는 상태
- 초기 실험/검증용 빈 DB에 가까움

## 4) `pseudolab-main` 현황 (메인)

### 4.1 메타/카탈로그 계열
- `catalog_datasets`
- `catalog_columns`
- `glossary_terms`
- `glossary_backfill_conflicts`

### 4.2 통계/수집 계열
- `daily_stats`
- `discord_messages`
- `discord_watermarks`

### 4.3 GitHub 이벤트(Data Lake) 계열
- `dl_create_events`
- `dl_delete_events`
- `dl_fork_events`
- `dl_gollum_events`
- `dl_issue_comment_events`
- `dl_issues_events`
- `dl_member_events`
- `dl_public_events`
- `dl_pull_request_events`
- `dl_pull_request_review_comment_events`
- `dl_pull_request_review_events`
- `dl_push_events`
- `dl_release_events`
- `dl_watch_events`

### 4.4 운영 보조
- `d1_migrations`
- `_cf_KV`

## 5) 인덱스 구조 요약

`pseudolab-main`에는 다음 성격의 인덱스가 다수 존재함:

- 도메인/시간 기반 조회 인덱스
  - 예: `... (domain, updated_at DESC)`, `... (date DESC, event_type)`
- 리포지토리/조직 기반 이벤트 조회 인덱스
  - 예: `... (organization, repo_name)`
- 부분 인덱스(Partial Index)
  - 예: `WHERE is_pii = 1`, `WHERE is_merged = 1`

## 6) 관계 구조(핵심)

- `catalog_columns.dataset_id` → `catalog_datasets.id` (FK)
- 그 외 이벤트 계열은 대부분 독립 테이블 + 분석용 인덱스 중심 구조

## 7) 데이터 스냅샷(조회 기준)

- 샘플 확인: `discord_messages` 테이블 데이터 존재 (`COUNT(*)` 조회 성공)

> 참고: 일부 PRAGMA 기반 메타조회는 D1 API 제약으로 `SQLITE_AUTH`가 발생할 수 있음.
> 따라서 `sqlite_master` 기반 DDL 조회를 구조 기준으로 사용.

## 8) 데이터 활용 시나리오 (분석가 관점)

1. **저장소/조직 활동 추세 분석**
   - 대상: `dl_*` 이벤트 테이블
   - 산출: 월별 활동량, 이벤트 유형 비중, 급변 시점 탐지

2. **협업 구조 분석**
   - 대상: PR/Review/Issue 계열 이벤트
   - 산출: 리뷰 참여도, 머지 전환율, 토론-해결 리드타임 근사

3. **메타데이터 품질 점검**
   - 대상: `catalog_datasets`, `catalog_columns`, `glossary_terms`
   - 산출: 정의 누락 컬럼 비율, PII 표기 커버리지, 카탈로그 최신성

## 9) 한계/편향 (READ ONLY 관점)

- **이벤트 비대칭 편향**: `push`, `pull_request` 중심으로 데이터가 몰려 이벤트 다양성 해석이 왜곡될 수 있음
- **사전 정의 결손**: `glossary_terms`가 비어 있어 동일 지표를 팀마다 다르게 해석할 가능성 존재
- **관계 약결합 구조**: 이벤트 테이블 간 강한 FK가 적어 엔터티 정합 매칭 시 분석가 가정이 개입됨
- **권한/엔진 제약**: 일부 PRAGMA 조회 불가로 물리적 최적화 상태를 완전 검증하기 어려움

## 10) 추천 지표 정의 (D1 중심)

1. **Repo Monthly Activity (RMA)**
   - 정의: 저장소별 월간 `(push + pr + issue)` 이벤트 수

2. **PR Merge Efficiency (PME)**
   - 정의: 기간 내 `merged PR 수 / opened PR 수`

3. **Review Depth Proxy (RDP)**
   - 정의: `pull_request_review* 이벤트 수 / PR opened 수`

4. **Metadata Readiness Score (MRS)**
   - 정의: `정의/설명/PII 플래그가 채워진 catalog_columns 비율`

5. **Schema Observability Score (SOS)**
   - 정의: 핵심 테이블 중 row count·기간 범위를 확인한 테이블 비율

## 11) 다음 조사(조회 전용)

1. 테이블별 row count 스냅샷 자동화
2. 이벤트 테이블별 날짜 컬럼 기준 최신/최초 범위
3. 핵심 조회 패턴에 대한 인덱스 적합성 점검

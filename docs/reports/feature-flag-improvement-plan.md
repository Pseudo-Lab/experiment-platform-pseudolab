Status: draft
Last-Validated: 2026-05-18
Owner: experiment-lab

# Feature Flag 개선 계획

> 실험 플랫폼/Feature Flag 개념이 익숙하지 않다면 먼저 `docs/guides/experiment_platform_concepts.md`를 읽는다.

## 1. 배경

현재 구현된 Feature Flag는 `flag_key`, `enabled`, `rollout_pct`를 기반으로 `user_id + flag_key` 해시를 계산해 `control/treatment`를 반환하는 단순 percentage rollout 구조다.

이 구조는 MVP smoke test에는 충분하지만, 실험 플랫폼 관점에서는 다음 요구를 충족하지 못한다.

- 가짜연구소 홈페이지/성장시스템 데이터 기반 세그먼트 타겟팅
- 코호트/팀/역할/활동 조건 기반 대상군 조정
- 실험군 노출 기록(exposure logging)
- 플래그 변경 이력/audit log
- 실험 결과 분석과 연결되는 안정적 assignment
- 다변량 variation / dynamic config

따라서 피쳐플래그를 “단순 on/off + percentage rollout”에서 “세그먼트 기반 실험 제어 레이어”로 확장한다.

### 1.1 2026-05-18 운영 조회 스냅샷

민감정보 값은 확인/기록하지 않고, 환경변수 존재 여부와 D1 스키마/row count만 확인했다.

환경변수 상태:

| 항목 | 상태 |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | 설정됨 |
| `CLOUDFLARE_API_TOKEN` | 설정됨 |
| `D1_DATABASE_ID` | 설정됨 |
| `D1_MAIN_DATABASE_ID` | 설정됨 |

`pseudolab-exp` feature flag 관련 테이블:

| 테이블 | 상태 | 현재 row count |
|---|---|---:|
| `feature_flag` | 존재 | 7 |
| `feature_segment` | 존재 | 0 |
| `feature_segment_member` | 존재 | 0으로 추정 |
| `feature_flag_rule` | 존재 | 4 |
| `feature_flag_exposure` | 존재 | 361 |

현재 rule 4건은 모두 `segment_id` 없이 동작하는 rule이며, 존재하지 않는 segment를 참조하는 dangling rule은 없었다.

`pseudolab-main` source 테이블:

| 테이블 | 상태 | 현재 row count / distinct users |
|---|---|---:|
| `dl_project_members` | 존재 | 9,121 rows / 213 distinct users |
| `discord_messages` | 존재 | 7,367 rows / 최근 30일 11 users / 최근 7일 8 users |

주의: 운영 D1의 `discord_messages`에는 `is_bot` 컬럼이 없다. 따라서 현재 `discord_active_users` template은 `author_id`, `created_at` 기준으로만 계산한다. 봇 제외 조건이 필요하면 ETL/D1 스키마에 `is_bot` 또는 동등한 식별 컬럼을 먼저 추가해야 한다.

조회 결과에 따른 판단:

1. 백엔드 마이그레이션은 운영 D1에 적용되어 있다.
2. query-backed segment를 만들 수 있는 source 테이블도 존재한다.
3. 아직 운영 segment가 없으므로 다음 개발의 핵심은 `/segments` UI와 rule UI다.
4. `feature_flag_rule`은 이미 사용 중이지만 segment targeting은 아직 운영 데이터로 쓰이지 않고 있다.

### 데이터 소스 전제

DB 역할은 다음처럼 구분한다.

- **Supabase**: 가짜연구소 홈페이지 raw DB. 운영 원천 데이터이며 실험 플랫폼/feature flag/분석 작업에서 직접 활용하지 않는다.
- **Cloudflare D1 홈페이지 DB**: 가짜연구소 홈페이지용 DB. raw DB에서 매일 동기화된 데이터를 보유한다.
- **실험 플랫폼 DB**: 실험/플래그/노출/세그먼트 메타데이터를 저장하는 DB.

피쳐플래그 세그먼트는 raw Supabase를 직접 때리는 구조가 아니라, **매일 동기화된 D1 홈페이지 DB 또는 실험 플랫폼용 동기화 DB를 안전한 소스**로 사용한다. 실험 플랫폼 DB에는 segment snapshot, rule, exposure 등 실험 운영에 필요한 파생 데이터를 저장한다. 분석가에게도 Supabase raw DB 계정보다는 D1 스키마/export/read-only query API를 제공한다.

---

## 2. 외부 플랫폼 리서치 요약

### 2.1 Hackle

참고: https://docs-en.hackle.io/docs/feature-flags

핵심 패턴:
- 기능 배포 시점을 코드 배포와 분리
- 특정 사용자(QA, beta tester 등)에게 먼저 배포
- 불특정 사용자 일부 비율부터 점진 배포(gradual rollout)
- 시스템 안정성 관리/릴리즈 관리 용도

시사점:
- 현재의 rollout percentage는 Hackle식 gradual rollout의 아주 작은 부분만 구현한 상태다.
- “특정 사용자/그룹 선공개”와 “점진 배포”를 함께 지원해야 한다.

### 2.2 LaunchDarkly

참고:
- https://docs.launchdarkly.com/home/flags/targeting-rules
- https://docs.launchdarkly.com/home/flags/segments

핵심 패턴:
- context(user, device, organization 등) attribute 기반 targeting
- individual target, segment target, targeting rule 조합
- prerequisite flag, targeting rule, percentage rollout의 조합
- segment는 반복되는 사용자 그룹을 재사용하기 위한 일급 개념
- rule expiration 등 운영 안전장치 제공

시사점:
- 우리 플랫폼도 `person/context attributes`와 `segment`를 분리해야 한다.
- 플래그마다 SQL을 직접 쓰기보다, 재사용 가능한 segment를 만들고 flag rule에서 참조하는 구조가 안전하다.

### 2.3 Statsig

참고:
- https://docs.statsig.com/feature-flags/overview
- https://docs.statsig.com/experiments-plus/overview

핵심 패턴:
- Feature Gate는 runtime에 SDK가 사용자 속성/환경 조건을 평가해 boolean 반환
- override/bypass list 지원
- exposure 모니터링 제공
- scheduled rollout 지원
- Dynamic Config는 boolean이 아닌 structured data 반환
- Experiment는 randomization unit, variant, statistical significance 중심

시사점:
- Feature Flag와 Experiment를 분리하되 연결 가능해야 한다.
- `decide` 호출은 노출 이벤트를 남겨야 분석/모니터링이 가능하다.
- 향후 boolean gate 외에 JSON config를 반환할 수 있어야 한다.

### 2.4 Optimizely Feature Experimentation

참고: https://docs.developers.optimizely.com/feature-experimentation/docs/audiences

핵심 패턴:
- Audience/attribute 기반 대상자 정의
- Feature rollout과 experiment를 같은 맥락에서 관리
- 특정 audience에만 실험/기능 노출

시사점:
- “audience/segment 정의 → flag/experiment에 연결” 흐름이 필요하다.
- 우리 데이터 특성상 raw Supabase가 아니라, 매일 동기화된 Cloudflare D1 홈페이지 DB/실험 플랫폼용 동기화 DB를 기반으로 한 audience builder가 핵심 차별점이 된다.

---

## 3. 현재 구현 상태

### Backend

- `backend/app/api/v1/endpoints/feature_flags.py`
  - `GET /api/v1/feature-flags/`
  - `POST /api/v1/feature-flags/`
  - `PATCH /api/v1/feature-flags/{flag_key}`
  - `GET /api/v1/feature-flags/decide?flag_key=&user_id=`
- `backend/app/services/feature_flag.py`
  - CRC32 기반 deterministic percentage rollout
  - disabled 또는 unknown flag는 `control`
- `backend/migrations/005_event_collection_feature_flags.sql`
  - `feature_flag` 테이블 존재

### Frontend

- `frontend/src/features/dashboard/components/FeatureFlags.tsx`
  - 목록 조회
  - 플래그 생성
  - enabled 토글
  - rollout percentage 변경
- `frontend/src/App.tsx`
  - `/feature-flags` 라우트 등록
- `frontend/src/layouts/MainLayout.tsx`
  - 사이드바 메뉴 등록

### 검증 현황

- Backend tests: `112 passed` (2026-05-18)
- Frontend tests: `42 passed`
- Frontend build: 성공
- Feature flag/segment 전용 backend 회귀 테스트 포함

---

## 4. 목표 아키텍처

### 4.1 핵심 모델

```text
Person / Context
  - user_id
  - cohort_id / cohort_name
  - team_name
  - role
  - derived attributes from dl_* / Discord / GitHub

Segment
  - reusable audience definition
  - static include/exclude users
  - rule-based conditions
  - query-backed membership snapshot

Feature Flag
  - flag_key
  - name / description
  - enabled
  - default_variant
  - flag_type: boolean | multivariate | config

Feature Flag Rule
  - flag_key
  - priority
  - segment_id or conditions
  - rollout_pct
  - variant allocation
  - enabled
  - starts_at / ends_at optional

Assignment / Exposure
  - flag_key
  - user_id
  - variant
  - reason
  - evaluated_at
  - context snapshot/hash

Audit Log
  - who changed what
  - before / after
  - created_at
```

### 4.2 결정 흐름

```text
GET /api/v1/feature-flags/decide?flag_key=x&user_id=y

1. flag 조회
2. flag disabled면 default/control 반환
3. person/context 조회
4. rules priority 순회
5. segment membership 또는 조건 평가
6. match된 rule에서 rollout/variant allocation 적용
7. assignment/exposure 기록
8. variant/config 반환
```

---

## 5. 단계별 작업 계획

## Phase 0 — 현재 기능 안정화

목표: 지금 있는 단순 flag를 안전하게 만든다.

작업:
1. Backend 테스트 추가
   - create success
   - duplicate flag 409
   - rollout 0/100 결정
   - disabled always control
   - unknown flag control
   - update missing 404
   - invalid rollout 422
2. `flag_key` validation 추가
   - 추천: `^[a-z0-9][a-z0-9_-]{2,63}$`
3. FE API client에서 `encodeURIComponent(flagKey/userId)` 적용
4. D1 execute 실패 처리
   - create/update에서 execute false면 명시적 502/500 반환
5. `enabled` 변환 방어
   - `bool(row["enabled"])` 대신 `int(row["enabled"]) == 1`
6. rollout slider PATCH 폭주 완화
   - debounce 또는 “저장” 버튼

산출물:
- `backend/tests/test_feature_flags.py`
- FE 최소 테스트 또는 API client 테스트
- 안정화 PR

완료 기준:
- Backend/Frontend 테스트 통과
- 기존 `/feature-flags` UI 동작 유지

---

## Phase 1 — Segment 기반 타겟팅

목표: KiSH님이 말한 “데이터 쿼리로 대상군을 조정하는 플래그”의 1차 구현.

작업:
1. D1 migration 추가

```sql
CREATE TABLE feature_segment (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  query_name TEXT,
  rules_json TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE feature_segment_member (
  segment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reason TEXT,
  refreshed_at TEXT NOT NULL,
  PRIMARY KEY (segment_id, user_id)
);

CREATE TABLE feature_flag_rule (
  id TEXT PRIMARY KEY,
  flag_key TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  segment_id TEXT,
  rollout_pct INTEGER NOT NULL DEFAULT 100,
  variant TEXT NOT NULL DEFAULT 'treatment',
  enabled INTEGER NOT NULL DEFAULT 1,
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

2. Segment API 추가
   - `GET /segments`
   - `GET /segments/query-templates`
   - `POST /segments`
   - `POST /segments/{id}/refresh`
   - `GET /segments/{id}/members?limit=`
   - 현재 구현 상태(2026-05-18): manual segment, allowlisted query-backed segment refresh, query template 목록 조회 지원
3. 안전한 query registry 도입
   - UI에서 raw SQL 직접 입력 금지
   - raw Supabase 직접 조회 금지
   - 매일 동기화된 D1 홈페이지 DB/실험 플랫폼용 동기화 DB를 대상으로 서버 allowlisted query templates 정의
   - 예: `active_cohort_members`, `project_members`, `discord_active_users`, `github_active_users`
   - 현재 allowlist: `project_members`, `discord_active_users`
   - `discord_active_users`는 현재 운영 D1의 `discord_messages.author_id`, `created_at` 기준으로 계산한다. 봇 제외가 필요하면 `is_bot` 같은 식별 컬럼을 ETL/D1 스키마에 먼저 추가해야 한다.
   - query-backed refresh는 `D1_MAIN_DATABASE_ID`가 설정된 경우에만 실행하며, 누락 시 빈 segment로 성공 처리하지 않고 503을 반환
4. Feature flag rule API 추가
   - `GET /feature-flags/{flag_key}/rules`
   - `POST /feature-flags/{flag_key}/rules`
   - `PATCH /feature-flags/{flag_key}/rules/{rule_id}`
5. `decide` 로직을 rule/segment 기반으로 확장

완료 기준:
- “12기 활성 참여자 30%만 treatment” 같은 룰을 UI/API로 만들 수 있음
- segment refresh 결과를 확인할 수 있음

---

## Phase 2 — Exposure logging + 실험 분석 연결

목표: 플래그 노출과 결과 지표를 연결한다.

현재 구현 상태(2026-05-09):
- `feature_flag_exposure` D1 테이블과 조회용 인덱스 추가
- `decide` 기본 동작에서 exposure 기록
- `track=false` 옵션으로 기록 제외 가능
- `GET /api/v1/feature-flags/{flag_key}/exposures` 추가
- `GET /api/v1/feature-flags/{flag_key}/exposure-summary` 추가
- 분석 집계는 기간 내 사용자별 최초 노출 기준으로 variant 분포 산출
- raw 호출 로그는 모두 저장하고, 분석 view/API에서 중복을 억제하는 방향으로 확정

작업:
1. exposure 테이블 추가

```sql
CREATE TABLE feature_flag_exposure (
  id TEXT PRIMARY KEY,
  flag_key TEXT NOT NULL,
  user_id TEXT NOT NULL,
  variant TEXT NOT NULL,
  reason TEXT,
  evaluated_at TEXT NOT NULL,
  context_json TEXT
);
CREATE INDEX idx_feature_flag_exposure_flag_user ON feature_flag_exposure(flag_key, user_id);
CREATE INDEX idx_feature_flag_exposure_evaluated_at ON feature_flag_exposure(evaluated_at);
```

2. decide API에서 exposure 기록 옵션 추가
   - 기본은 기록
   - `track=false` 옵션 허용 가능
3. 실험 결과 API와 exposure 연결
   - flag_key 기준 treatment/control 그룹 구성
   - 매일 동기화된 D1 홈페이지 DB/실험 플랫폼용 동기화 DB의 지표와 Python 레이어에서 결합
4. 중복 노출 처리 정책 정의
   - 최초 노출 기준
   - 최신 노출 기준
   - 기간 내 최초 노출 기준

완료 기준:
- 특정 flag 기준 노출자 수, treatment/control 분포, 기본 결과 지표를 조회할 수 있음

---

## Phase 3 — UI 고도화

목표: 운영자가 코드 없이 segment/rule/rollout을 관리한다.

작업:
1. `/segments` 관리 화면 추가
   - query template 목록 조회: `GET /api/v1/segments/query-templates`
   - segment 목록 조회
   - manual segment 생성
   - query-backed segment 생성
   - refresh 실행
   - member count와 member 일부 확인
   - 빈 상태, 실패 상태, refresh 중 상태 표시
2. `/feature-flags` 상세 페이지 추가
   - 기본정보
   - rules 목록
   - exposure summary
   - audit log
3. 룰 빌더 UI
   - Segment 선택
   - rollout percentage
   - variant 선택
   - 기간 조건
4. 안전장치
   - 변경 전 confirmation
   - 100% rollout 경고
   - disabled/expired 표시
   - 마지막 변경자/변경시각 표시
   - dangling rule 표시
   - `D1_MAIN_DATABASE_ID` 미설정/refresh 실패 메시지 표시
   - Discord active users template은 현재 bot 제외가 불가하다는 안내 표시

완료 기준:
- 운영자가 UI에서 “대상군 선택 → rollout 설정 → 활성화 → 노출 확인” 흐름을 수행할 수 있음

---

## Phase 4 — 고급 기능

후순위:
- 다변량 variant allocation
- JSON dynamic config 반환
- prerequisite flags
- holdout group
- scheduled/progressive rollout
- kill switch
- SDK/client helper
- audit approval workflow
- role-based access control

---

## 6. 우선순위 제안

즉시 착수 추천:
1. Phase 0 안정화
2. Phase 1의 query registry + segment 테이블
3. `active_12th_members`, `project_members` 두 개 segment template부터 구현

보류:
- raw SQL builder UI
- dynamic config
- prerequisite flags
- 통계 엔진 고도화

---

## 7. 설계 원칙

1. UI에서 임의 SQL 직접 실행 금지
   - 보안/성능/실수 위험이 큼
2. 대신 allowlisted query template + parameter 방식 사용
   - 예: `cohort_id`, `project_id`, `active_days`
3. Segment는 refresh 가능한 snapshot으로 관리
   - raw DB와 운영 DB를 분리하고, 매일 동기화된 D1 데이터를 실험 플랫폼이 안정적으로 소비하기 위함
4. Decide API는 빠르고 결정론적이어야 함
   - runtime마다 무거운 분석 쿼리를 실행하지 않음
5. Exposure는 분석 가능한 형태로 반드시 남김
   - 실험 결과 API와 연결하기 위한 핵심 데이터

---

## 8. 1차 구현 범위 제안

### Sprint A
- Feature flag 테스트/validation/에러 처리
- FE encode/debounce
- `feature_segment`, `feature_segment_member`, `feature_flag_rule` migration

### Sprint B
- Segment API + query registry
- `active_cohort_members`, `project_members` template
- decide rule evaluation 확장

### Sprint C
- Exposure logging
- flag detail UI
- segment list UI

---

## 9. 현재 판단

현재 기능은 “피쳐플래그의 껍데기”는 있으나, 핵클/LaunchDarkly/Statsig/Optimizely류 플랫폼이 제공하는 핵심인 **세그먼트 기반 타겟팅 + 노출 기록 + 분석 연결**은 아직 없다.

따라서 다음 작업은 단순 UI 개선이 아니라, `segment → rule → decide → exposure → analysis` 파이프라인을 세우는 방향으로 진행한다.

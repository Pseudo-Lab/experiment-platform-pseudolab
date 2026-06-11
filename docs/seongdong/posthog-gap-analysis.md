# PostHog Gap Analysis — ExperiBase vs PostHog

> 작성일: 2026-06-11  
> 기준 코드: `main` 브랜치 (1f137a9)  
> 분석 범위: backend/app/, packages/sdk/src/, frontend/src/features/

---

## 1. 현재 ExperiBase 구현 현황 (코드 기반)

### 1.1 백엔드 API (`backend/app/api/v1/endpoints/`)

| 엔드포인트 모듈 | 주요 경로 | 확인된 기능 |
|---|---|---|
| `sdk.py` | `POST /decide` | flag → placement 순서로 룩업, 통합 결정 |
| `events.py` | `POST /capture`, `POST /events`, `POST /identify` | 이벤트 수집, 실험 impression/conversion, 사용자 식별 |
| `feature_flags.py` | `GET/POST /flags`, `PATCH /{key}`, `POST /{key}/archive`, `GET /{key}/rules`, `POST /{key}/rules`, `GET /{key}/exposures` | 플래그 CRUD, 룰 관리, 노출 이력 |
| `experiments.py` | 실험 CRUD, 배정, 결과 | A/B 테스트·준실험·롤아웃 type 구분 |
| `experiment_analytics.py` | `GET /{id}/analytics`, `GET /{id}/available-events` | 노출/전환 집계, 통계 유의성 |
| `analytics.py` | trends, funnels, retention | `event_log` 기반 범용 분석 |
| `placements.py` | placement CRUD + decide | quasi-experiment 플레이스먼트 |
| `segments.py` | segment CRUD, members | 타겟팅용 수동 세그먼트 |
| `decisions.py` | SHIP/HOLD/ROLLBACK 로그 | 의사결정 타임라인 |
| `visual_changes.py` | DOM 뮤테이션 저장/조회 | 실험별 시각적 변경 |
| `projects.py` | 프로젝트 관리, API 키 발급 | ab_test / quasi_experiment type |
| `reflections.py` | 실험 후 회고 제출 | |
| `bug_reports.py` | 버그리포트 CRUD, R2 첨부파일 | |
| `dashboard.py` | GitHub + Discord 메트릭 집계 | 커뮤니티 활동 대시보드 |

### 1.2 DB 스키마 주요 테이블 (`backend/migrations/`)

| 테이블 | 핵심 컬럼 | 마이그레이션 |
|---|---|---|
| `feature_flag` | flag_key, rollout_pct, enabled, product, project_id | 005, 015 |
| `feature_flag_rule` | flag_key, priority, segment_id, rollout_pct, variant, starts_at, ends_at | 008 |
| `feature_segment` | source, query_name, rules_json, enabled | 008 |
| `feature_segment_member` | segment_id, user_id, reason, refreshed_at | 008 |
| `feature_flag_exposure` | flag_key, user_id, variant, reason, evaluated_at, context_json | 010 |
| `experiment_event` | event_type, experiment_key, experiment_id, variant, url, user_id, properties | 025 |
| `event_log` | user_id, cohort_id, event_name, properties, event_time | 005 |
| `person` | user_id (PK), cohort_id, cohort_name, team_name, role | 005 |
| `experiments` | flag_key, experiment_type, status, variant_names_json | 001, 012–014 |
| `placements` | placement CRUD 기반 quasi-experiment | 020 |
| `experiment_placement_config` | placement UI 설정 | 011 |
| `cohort` | id, name, season_number, supabase_cohort_id | 005 |

### 1.3 SDK (`packages/sdk/src/`)

확인된 메서드 (core.ts):

```
decide(key, options?)  → POST /decide → impression 자동 전송(POST /events)
track(event, props?)   → POST /capture + POST /events (conversion type)
identify(userId)       → 인메모리 userId 교체만 (서버 호출 없음)
```

React (react.tsx):
- `ExperibaseProvider`: flagKeys 프리페치, sessionStorage 캐시 (키: `experibase:flag:{key}:{uid}`)
- `useFlag(flagKey)` → variants 맵에서 동기 조회
- `useDecide(key)` → 매 렌더마다 decide() 호출
- `exp:variant-forced` CustomEvent 수신 (visual editor 연동)

### 1.4 통계 엔진 (`backend/app/services/experiment_analytics.py`)

구현된 것:
- `_two_proportion_z_test`: 2비율 z-검정, `p < 0.05` 임계값 고정
- `_srm_check`: 샘플 비율 불일치 χ² 검정 (`p < 0.01`)
- `_detect_anomalies`: 전환 수 > 노출 수 감지
- 배리언트별 노출 시계열, URL별 집계

구현되지 않은 것: CUPED, Bayesian, sequential testing, MDE 계산, power 계산

---

## 2. PostHog과 비교한 핵심 갭

### A. 이벤트 수집 & SDK

| 항목 | PostHog | ExperiBase 현재 | 갭 |
|---|---|---|---|
| Autocapture | 클릭, 입력, 폼 제출, 페이지뷰 자동 수집 | 없음. `decide()` 호출 시 impression만 자동 전송 | **autocapture 전체 미구현** |
| Pageview | URL 변경 감지 자동 전송 | `window.location.pathname`을 impression에 첨부하는 수준 | **pageview 이벤트 없음** |
| Identify with traits | `posthog.identify(id, {name, email, plan, ...})` — 임의 프로퍼티 서버 저장 | `identify()` 인메모리 변경만; `POST /identify`는 cohort_id·team_name·role 4개 고정 필드만 저장 (`schemas/event.py:PersonIdentify`) | **Person properties 스키마 고정** |
| Super properties | `posthog.register({...})` — 모든 이벤트에 자동 첨부 | 없음 | 미구현 |
| Alias | anonymous → identified 연결 | 없음; localStorage UUID → identify() 후 별개 user_id로 취급 | 미구현 |
| Server-side SDK | Python, Node, Go, Ruby 등 | 없음 | 미구현 |

### B. Feature Flag 고도화

| 항목 | PostHog | ExperiBase 현재 | 갭 |
|---|---|---|---|
| 조건부 타겟팅 | user property 조건 (age > 18, country = 'KR'), 코호트, 그룹, percentage, regex | `feature_flag_rule.segment_id` → `feature_segment_member` 멤버십 조회만. `rules_json` 컬럼 존재하나 런타임에 평가 안 됨 (`services/feature_flag.py:_rule_matches_user`) | **property 조건 평가 엔진 없음** |
| Multivariate | 3개 이상 배리언트 + 각각 배분 비율 | DB는 `variant TEXT` 자유 필드지만 `_decide_variant()`는 treatment/control 이진 분기만 (`services/feature_flag.py:22–24`) | **다변량 배분 로직 없음** |
| JSON payload | 플래그별 임의 JSON 리턴 | `UnifiedDecideResponse.payload` 필드 있으나 placement 전용으로만 채워짐; flag 경로는 항상 `payload=None` (`endpoints/sdk.py:32–38`) | **flag payload 없음** |
| Early access feature | 사용자 self-opt-in | 없음 | 미구현 |
| 로컬 평가 | feature flag 전체를 클라이언트에 내려받아 네트워크 없이 평가 | 매 `decide()` 호출마다 서버 왕복 (sessionStorage 캐시는 세션 단위만) | **로컬 평가 없음** |
| 분산 해시 일관성 | MurmurHash 기반 | CRC32 기반 (`binascii.crc32`) — 동일 user/key → 동일 결과 보장됨 | 알고리즘 차이만; 기능 동등 |

### C. 실험 통계

| 항목 | PostHog | ExperiBase 현재 | 갭 |
|---|---|---|---|
| 검정 방법 선택 | Bayesian (베타분포 사후확률) / Frequentist 선택 | Frequentist(z-test) 고정 (`experiment_analytics.py:53–67`) | **Bayesian 없음** |
| CUPED | 사전 실험 공분산으로 분산 감소 → 표본 크기 절감 | 없음 | **미구현** |
| Sequential testing | 언제든지 보는 peek problem 보정 | 없음; 고정 p < 0.05 | **미구현** |
| Multiple testing correction | 다배리언트 실험에서 Bonferroni/BH 보정 | 가장 많은 노출을 가진 treatment 1개만 테스트 (`experiment_analytics.py:179`) | **다배리언트 보정 없음** |
| MDE / 표본 크기 계산 | 실험 설계 전 power calculator | 없음 | **미구현** |
| Confidence interval | 효과 크기 CI 시각화 | p-value와 winner만 (`StatisticalSignificance` 스키마) | **CI 없음** |
| SRM 감지 | 있음 | 있음 (`_srm_check`) | **동등** |
| Anomaly detection | 있음 | 기초 구현 있음 (전환>노출 감지) | 수준 차이 있음 |

### D. 사용자 / 코호트 관리

| 항목 | PostHog | ExperiBase 현재 | 갭 |
|---|---|---|---|
| Person profiles | user_id별 임의 key-value properties 저장, 타임라인, 세션 목록 | `person` 테이블: user_id, cohort_id, cohort_name, team_name, role 5개 고정 컬럼 (`migrations/005`) | **properties JSON 저장 없음** |
| Person 상세 UI | 프로필 페이지, 속성 필터링 | 없음 | 미구현 |
| Cohort builder | 조건 조합 UI (이벤트 수행, 속성 보유 등) | `feature_segment` 테이블의 `rules_json` 컬럼만; 평가 엔진 없음 | **빌더 UI·엔진 미구현** |
| Group analytics | 조직/팀 단위 집계 | `cohort` 테이블로 준실험 코호트 개념 있으나 그룹 analytics는 없음 | **그룹 분석 없음** |
| 코호트 동기화 | Segment, Braze, Customer.io 연동 | Supabase cohort_id 연동 필드만 존재 | 제한적 |

### E. 데이터 파이프라인

| 항목 | PostHog | ExperiBase 현재 | 갭 |
|---|---|---|---|
| 스토리지 엔진 | ClickHouse (컬럼형, 수십억 이벤트 처리) | Cloudflare D1 (SQLite 기반) — 소규모 팀에 적합, 최대 수백만 행 수준 | **대용량 처리 불가** |
| Warehouse sync | BigQuery, Snowflake, Redshift, S3 export | 없음 | **미구현** |
| Real-time ingestion | Kafka 기반 비동기 | D1 HTTP API 동기 쓰기 | 구조적 차이 |
| Data export API | 전체 이벤트 스트림 export | 없음 (analytics REST 조회만) | **미구현** |
| 쿼리 성능 | HogQL (ClickHouse SQL) | SQLite SQL (`d1.query()`) | D1 한계 내에서는 문제 없음 |

### F. 대시보드 & 인사이트

| 항목 | PostHog | ExperiBase 현재 | 갭 |
|---|---|---|---|
| Trend insight | 임의 이벤트 multi-series, 필터, 분석 | `analytics.py`: 단일 event_name 시계열 (`get_trends`) | **multi-event, 필터 없음** |
| Funnel | 순서 있는 다단계, 전환 시간, breakdown | `analytics.py`: 단순 교집합 방식 (`get_funnels`) — 순서 강제 없음 | **순서 강제·시간 분석 없음** |
| Retention | 코호트 리텐션 매트릭스 | 구현됨 (`get_retention`, 주간 코호트) | **동등 수준** |
| Paths | 사용자 이동 경로 sankey | 없음 | **미구현** |
| Stickiness | N일 중 M일 사용 | 없음 | **미구현** |
| Lifecycle | 신규/재활성/이탈 분류 | 없음 | **미구현** |
| Dashboard 공유 | 링크 공유, embed | 없음 | 미구현 |
| 실험 판단 UI | 없음 | `ExperimentDetail.tsx`: P0/P1 판단 탭, SHIP/HOLD/ROLLBACK 버튼 | **ExperiBase 고유 강점** |

### G. 세션 & 행동 분석

| 항목 | PostHog | ExperiBase 현재 | 갭 |
|---|---|---|---|
| Session replay | 클릭, 마우스, 스크롤 레코딩 | 없음 | **미구현** |
| Heatmaps | 클릭, 스크롤 히트맵 | 없음 | **미구현** |
| Toolbar | 페이지 오버레이 툴바 (요소별 데이터 조회) | 없음 | **미구현** |
| Error tracking | 예외 자동 수집, 스택트레이스 | bug_reports 수동 제출만 | 수동 vs 자동 차이 |

---

## 3. 우선순위별 구현 로드맵

### 즉시 가능 (현재 스택으로 — D1 + FastAPI + TypeScript SDK)

#### 3.1 Pageview 자동 수집 SDK에 추가
- `packages/sdk/src/core.ts`에 `window.addEventListener('popstate', ...)` + `history.pushState` 패치
- 이벤트명 `$pageview`로 `POST /capture` 자동 전송
- 예상 공수: 0.5일

#### 3.2 Person properties 스키마 확장
- `person` 테이블에 `properties TEXT` 컬럼 추가 (JSON blob)
- `POST /identify` 요청에 `traits?: Record<string, unknown>` 필드 추가
- `schemas/event.py:PersonIdentify` 확장 및 service upsert 로직 수정
- 예상 공수: 1일

#### 3.3 Flag JSON payload 활성화
- `endpoints/sdk.py:32–38`의 flag 분기에서 `feature_flag.payload` 컬럼 신설 및 리턴
- 또는 `feature_flag_rule`에 `payload_json TEXT` 추가
- 예상 공수: 1일

#### 3.4 Multivariate 배분 로직
- `feature_flag_rule.rollout_pct` 여러 룰을 variant별로 사용하는 방식은 이미 스키마 상 가능
- `_decide()` 내 룰 평가 루프가 variant를 자유롭게 리턴하므로 **UI만 추가하면 됨**
- 예상 공수: 1일 (UI) + 0.5일 (analytics 다배리언트 보정)

#### 3.5 Confidence Interval 추가
- `_compute_significance()`에 Wilson score interval 또는 normal approximation CI 추가
- `StatisticalSignificance` 스키마에 `ci_lower`, `ci_upper` 필드 신설
- 예상 공수: 0.5일

### 중기 (설계 변경 필요 — 2–4주)

#### 3.6 Property 기반 타겟팅 조건 평가 엔진
- `feature_segment.rules_json` 스키마 정의 (`[{property, operator, value}, ...]`)
- `services/feature_flag.py:_rule_matches_user()`에 `person.properties` 조회 및 조건 평가 추가
- 조건 평가 시 `properties JSON` 파싱 + operator 처리 (eq, neq, contains, gt, lt 등)
- 예상 공수: 3–4일

#### 3.7 CUPED 통계 구현
- 사전 실험 기간(pre-period)의 conversion rate를 공변수로 사용
- `experiment_event` 테이블에 이미 `event_time` 있어 pre-period 집계 가능
- `experiment_analytics.py`에 CUPED 보정 분산 계산 추가
- 예상 공수: 3일 (수식 구현 + 테스트)

#### 3.8 Cohort builder UI
- `feature_segment`의 `rules_json` 편집 UI (condition 추가/제거 인터페이스)
- `feature_segment_member` 자동 refresh cron (Cloudflare Workers cron 활용 가능)
- 예상 공수: 4–5일

#### 3.9 Funnel 순서 강제 & Paths
- 현재 `get_funnels()`는 단순 교집합. 순서 있는 퍼널은 user별 이벤트 시퀀스 조회 필요
- D1에서 `WHERE user_id IN (...) AND event_time > prev_step_time` 방식으로 구현 가능 (성능 제약 있음)
- 예상 공수: 3일

#### 3.10 Super properties / Global context
- SDK에 `register(properties)` 메서드 추가
- `_sendEvent()` 및 `track()` 호출 시 global props 병합
- 예상 공수: 0.5일

### 장기 (인프라 변경 필요 — 분기 단위)

#### 3.11 대용량 OLAP 마이그레이션
- D1은 수백만 이벤트 수준이 현실적 상한
- ClickHouse (셀프호스팅) 또는 Cloudflare Analytics Engine (기존 Cloudflare 스택 유지)
- 마이그레이션 시 `experiment_event`, `event_log` 테이블 우선 이관

#### 3.12 Warehouse sync
- D1 → BigQuery 또는 S3 배치 export (Cloudflare D1 Export API 활용)
- Webhook 기반 실시간 stream 연동

#### 3.13 Session replay
- Cloudflare R2에 session recording 저장 (이미 bug report 첨부에 R2 사용 중)
- rrweb 기반 클라이언트 레코딩 SDK 연동

---

## 4. ExperiBase의 차별화 포인트 (PostHog에 없는 것)

| 기능 | 설명 | 관련 코드 |
|---|---|---|
| **준실험(quasi-experiment) 개념** | `experiment_type = 'quasi_experiment'`, `placement`와 연동한 비무작위 배정 지원 | `migrations/012`, `placements.py` |
| **Placement 기반 서버 드리븐 UI** | 실험 없이도 위치(`placement_key`) 기반으로 컴포넌트 노출 여부 결정; `completed`, `reason` 반환 | `endpoints/sdk.py:41–54`, `experiment_placement_config` 테이블 |
| **의사결정 로그 타임라인** | SHIP / HOLD / ROLLBACK + 학습 노트를 실험에 연결. PostHog에는 실험 메모 기능이 없음 | `decisions.py`, `schemas/decision.py:DecisionType` |
| **실험 후 회고(Reflection)** | 실험 완료 후 구조화된 회고 수집 | `reflections.py`, `migrations/007` |
| **Visual DOM 편집기 연동** | 실험에 CSS/텍스트 변경을 저장하고 SDK `exp:variant-forced` 이벤트로 실시간 반영 | `visual_changes.py`, `react.tsx:99–106` |
| **커뮤니티 활동 대시보드** | GitHub PR 머지율, Discord 메시지 수 등 비제품 지표를 실험 플랫폼에 통합 | `dashboard.py`, `types/metrics.ts` |
| **AI 에이전트 자율 실험 루프** | (미구현, 설계 단계) 에이전트가 가설 생성→실험 생성→결과 분석→의사결정을 자율 수행 | `AGENTS.md` 참고 |
| **Pseudolab 코호트 시즌 개념** | `cohort.season_number`, `supabase_cohort_id` — 커뮤니티 기수별 실험 격리 | `migrations/005:cohort` |

---

## 5. 요약 우선순위 매트릭스

| 우선순위 | 항목 | 임팩트 | 공수 |
|---|---|---|---|
| P0 | Pageview 자동 수집 | 이벤트 기반 분석 기반 마련 | 0.5일 |
| P0 | Person properties JSON | 타겟팅 조건 엔진의 전제 조건 | 1일 |
| P0 | Confidence Interval 추가 | 통계 신뢰도 시각화 | 0.5일 |
| P1 | Flag JSON payload | SDK 활용도 확대 | 1일 |
| P1 | Property 기반 타겟팅 | 세그멘테이션 고도화 | 3–4일 |
| P1 | Multivariate 배분 UI | A/B/C 실험 지원 | 1.5일 |
| P2 | CUPED 통계 | 표본 크기 절감 | 3일 |
| P2 | Funnel 순서 강제 | 행동 분석 품질 향상 | 3일 |
| P2 | Cohort builder UI | 운영 효율 | 5일 |
| P3 | OLAP 마이그레이션 | 대용량 처리 | 분기 |
| P3 | Session replay | 행동 분석 완성 | 분기 |

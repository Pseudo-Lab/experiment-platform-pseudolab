# ExperiBase 전체 아키텍처

## A/B 테스트 vs 준실험 설계

| 구분 | A/B 테스트 (`ab_test`) | 준실험 (`quasi_experiment`) |
|---|---|---|
| 무작위 배정 | O (CRC32 해시 기반 결정론적 배정) | X (자연 발생적 노출) |
| Feature Flag 필수 | O (Running 전환 시 강제) | X |
| Placement 역할 | 실험 UI를 특정 variant에 노출 | 준실험 트리거 조건 정의 |
| 사용자 배정 방식 | `decide()` 호출 시 flag rule → 자동 sticky assignment | `decide()` 호출 시 cohort/role 조건 매칭 |
| 통계 추론 | 무작위 배정 기반 인과 추론 | 관찰 기반 연관성 분석 |

**핵심 차이**: A/B 테스트는 Feature Flag가 variant를 결정하고 SDK가 impression을 자동 수집한다. 준실험은 Placement가 "이 사용자가 해당 경험에 노출됐는가"를 판단하며, 전환 이벤트는 `track()`으로 수동 수집한다.

---

## SDK Key / Placement Key 역할

### SDK API Key (`x-api-key` 헤더)
- **발급 단위**: Project
- **위치**: `project` 테이블의 `api_key` 컬럼
- **역할**: `/decide`, `/capture`, `/events` 엔드포인트 인증
- `/decide` 호출 시 `get_project_from_api_key` 의존성이 Project를 resolve → `project_id`를 이벤트/exposure에 자동 태깅

### Placement Key (`placement_key`)
- **발급 단위**: Placement 단위 (실험별 노출 위치)
- **위치**: `placements` 테이블의 `key` 컬럼
- **역할**: `/decide`에 전달되는 `key` 파라미터로, Feature Flag와 Placement를 구분하는 식별자
- `/decide` 엔드포인트는 `key`를 받아 먼저 Feature Flag 조회 → 없으면 Placement 조회 순으로 처리

---

## Feature Flag → Experiment → Placement 계층 관계

```
Project
└── Feature Flag (flag_key)
    ├── Flag Rules (segment + rollout_pct → variant 배정)
    └── Experiment (flag_key로 연결)
        ├── Variants (control / treatment / ...)
        └── Experiment Placement Config
            └── Placement (placement_key)
                └── 준실험의 트리거 조건 정의
```

### 계층별 역할

**Feature Flag**
- `flag_key`로 식별. `enabled`, `rollout_pct`로 전체 노출 비율 제어
- Flag Rule: `segment_id` + `rollout_pct` + `variant`로 세그먼트별 다른 variant 배정 가능
- A/B 테스트의 단일 진실 공급원(source of truth): variant 목록은 flag rule에서 derive

**Experiment**
- `flag_key`로 Feature Flag에 연결 (A/B 테스트)
- `flag_key`가 없으면 `variant_names_json`에서 variant 목록 관리 (준실험/언링크드)
- `status` 상태 머신으로 수명주기 관리
- `experiment_assignments` 테이블에 sticky assignment 기록

**Placement**
- 실험이 실제로 사용자에게 노출되는 위치/조건 정의
- A/B 테스트: `experiment_placement_config`를 통해 variant↔placement 매핑
- 준실험: Placement 자체가 실험 단위 (cohort, role, 시간 윈도우 조건)

---

## 통합 `/decide` 엔드포인트

**경로**: `POST /decide`  
**인증**: `x-api-key` 헤더 (Project API Key)

```
Request: { key, user_id, role?, cohort?, scenario?, track? }

                ┌─────────────────────┐
                │   /decide endpoint  │
                └──────────┬──────────┘
                           │
               feature_flag WHERE key = ?
                    ┌──────┴──────┐
                  found         not found
                    │               │
            flag 결정 로직       placement WHERE key = ?
            (rule → rollout)    (cohort/role/시간 체크)
                    │               │
              variant 반환      show/completed 반환
                    └──────┬──────┘
                           │
Response: { key, type, show, variant, payload }
  - type: "flag" | "placement"
  - show: variant != "control" (flag) | 조건 충족 (placement)
  - variant: "control" | "treatment" | ...
  - payload: null (flag) | { completed, reason } (placement)
```

**Flag 결정 순서**:
1. archived/disabled → `"control"`
2. enabled rules 순회 (priority ASC): segment 매칭 + rollout_pct → `variant`
3. 매칭 rule 없음 → fallback rollout_pct 기반 global 배정

**Placement 결정 조건** (AND 조건):
- `status = 'active'`
- 현재 시각이 `start_at` ~ `end_at` 범위 내
- `target_cohort` 일치 (또는 `*`)
- `allowed_roles`에 포함 (설정된 경우)

---

## 이벤트 수집 흐름

```
[사용자 브라우저/서버]
        │
        │ decide() 호출
        ▼
[SDK core.ts]
  - POST /decide (x-api-key 인증)
  - 응답 수신 후 즉시 fire-and-forget
        │
        │ POST /events
        ▼
[Backend: experiment_event 테이블]
  - event_type: "impression"
  - experiment_key: flag_key 또는 placement_key
  - variant: 배정된 variant
  - user_id, url, event_time

        │ (사용자 행동 발생)
        │
        │ track() 호출
        ▼
[SDK core.ts]
  - POST /capture (이벤트명, properties → event_log 테이블)
  - POST /events (event_type: "conversion" → experiment_event 테이블)

        │
        ▼
[Backend DB: experiment_event 테이블]
  - impression + conversion 이벤트 누적

        │
        ▼
[ExperimentAnalyticsService]
  - impression/conversion 집계
  - 2-proportion z-test로 통계적 유의성 계산
  - p_value < 0.05 → significant
  - variant별 conversion rate, uplift, winner 결정

        │
        ▼
[Analytics UI: 실험 상세 > 모니터링 탭]
```

**두 테이블의 역할 분리**:
- `event_log`: 프로젝트 전체 사용자 행동 이벤트 (트렌드/퍼널/리텐션 분석용)
- `experiment_event`: 실험 단위 impression/conversion (모니터링 탭용)

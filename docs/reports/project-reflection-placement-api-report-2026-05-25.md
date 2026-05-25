Status: active
Last-Validated: 2026-05-25
Owner: soo

# Project Reflection UI Placement API Implementation Report

## 1. 한 줄 요약

외부 프론트엔드가 특정 UI 슬롯을 노출할지 실험 플랫폼에 물어볼 수 있도록, `placement_key`만으로 활성 실험을 찾아 판단하는 placement-only decide API와 실험별 placement 관리 API를 백엔드에 추가했다. 12기 프로젝트 회고는 이 범용 기능을 검증하는 첫 파일럿 케이스다.

현재 LVUP 화면에서는 이 UI가 배너로 렌더링될 수 있지만, 실험 플랫폼 API 계약은 배너에 고정하지 않는다. API는 “어떤 실험의 어떤 LVUP UI 위치/진입점에 무엇을 보여줄지”를 판단하고, 응답의 `ui.type`으로 현재 표현 방식(`banner`, `card`, `modal` 등)을 내려준다.

## 2. 용어 구분

- 외부 프론트엔드: 실제 UI를 렌더링하는 제품 시스템. 이번 파일럿에서는 LVUP 프로젝트 상세 홈 화면
- 실험 플랫폼 백엔드: 대상자, 기간, 제출 여부, 설정값을 판단하는 시스템
- 실험 플랫폼 대시보드 프론트엔드: 운영자가 실험/placement 설정을 수정할 관리 UI
- Experiment: `s12-mid-reflection`처럼 운영 목적을 가진 실험 단위
- Placement: 외부 프론트엔드가 미리 정의한 UI 슬롯 또는 진입점. 실험 플랫폼은 실제 화면 위치를 정하지 않고, 해당 슬롯의 노출 여부와 문구를 관리한다.
- UI Type: 실제 렌더링 형태. 현재 기본값은 `banner`

## 3. 왜 배너 전용 API가 아닌가

초기 요청은 “회고 배너”였지만, 실제로 플랫폼이 관리해야 하는 것은 배너라는 시각 형태가 아니라 “LVUP의 특정 화면 위치에 회고 진입 UI를 노출할지”이다.

따라서 아래 구조는 피했다.

```http
GET /api/v1/project-reflection-banner/decide
```

이 구조는 다음 실험이나 다른 UI 형태가 생길 때마다 새 라우트, 새 서비스, 새 테이블을 만들게 된다.

대신 LVUP 프론트엔드 연동은 아래 구조로 정리했다.

```http
GET /api/v1/placements/{placement_key}/decide
```

예시:

```http
GET /api/v1/placements/project-detail-home-reflection-cta/decide?user_id={user_id}&project_id={project_id}
```

이 구조에서는 LVUP 프론트엔드가 `experiment_id`를 코드에 박지 않는다. LVUP은 자신이 렌더링할 슬롯인 `placement_key`만 전달하고, 실험 플랫폼이 해당 placement에 연결된 active experiment를 찾아 `experiment_id`를 응답에 포함한다.

실험별 명시 decide API도 유지한다.

```http
GET /api/v1/experiments/{experiment_id}/placements/{placement_key}/decide
```

예시:

```http
GET /api/v1/experiments/s12-mid-reflection/placements/project-detail-home-reflection-cta/decide?user_id={user_id}&project_id={project_id}
```

이 API는 운영자 확인, 디버깅, 명시적 실험 호출이 필요할 때 사용한다. 일반 LVUP 프론트 연동은 placement-only API를 권장한다.

이렇게 하면 현재 UI가 배너여도 `ui.type = "banner"`로 표현하면 되고, 나중에 카드/모달/인라인 CTA로 바뀌어도 라우트와 판단 계약을 유지할 수 있다.

## 3-1. 과도기 준실험 관점 검증

이번 12기 회고 조사는 실험 플랫폼이 실제 제품 연동에서 플랫폼 역할을 수행하는지 검증하는 첫 과도기 운영이다. 따라서 이번에는 무작위 배정 A/B 테스트가 아니라 준실험으로 먼저 진행한다.

그래서 현재 PR에서는 실험 플랫폼의 `experiment_assignments`나 feature flag rollout으로 사용자를 실험군/대조군에 균등 분배하지 않는다.

이번 API의 역할은 다음으로 제한한다.

- 설정된 target cohort와 role 조건을 서버에서 일관되게 판정한다.
- 외부 프론트엔드의 특정 placement에 UI를 노출할지 결정한다.
- 노출/클릭 이벤트 분석에 필요한 컨텍스트를 내려준다.

효과 분석은 노출/클릭/제출 로그와 비교 가능한 관측 데이터를 활용해 별도 분석 단계에서 수행한다.

다만 이 구조는 향후 정식 실험으로 전환할 때 버릴 임시 API가 아니다. LVUP에는 `placements/{placement_key}/decide` 계약을 유지하고, 플랫폼 기능이 완성되면 placement decide 내부에서 active experiment resolve, assignment, feature flag rule, exposure logging을 연결할 수 있다. 즉, 이번 PR은 과도기 준실험을 안정적으로 집행하면서도 정식 실험 플랫폼 흐름으로 확장 가능한 하위 리소스를 추가하는 작업이다.

## 3-2. 실험 플랫폼 아키텍처 검증

기존 실험 플랫폼 흐름은 다음 구조를 기준으로 한다.

```text
Experiment
  -> assignment 또는 feature flag/rule
  -> exposure/event logging
  -> metric/result
  -> decision
```

이번 placement API는 이 흐름을 우회하는 별도 제품 API가 아니라, `Experiment` 하위에서 LVUP이 미리 정의한 UI 슬롯을 관리하는 리소스다.

검증 결과:

- 외부 프론트엔드 연동 라우트는 `/placements/{placement_key}/decide`로 단순화하고, 플랫폼 내부 관리 라우트는 `/experiments/{experiment_id}/placements/{placement_key}` 아래에 있어 기존 experiment 중심 모델과 맞다.
- `project-reflection` 같은 실험별 엔드포인트를 만들지 않아 다음 실험에서 라우트가 늘어나는 문제를 피했다.
- feature flag rollout/assignment는 이번 과도기 준실험 범위에서 사용하지 않는다.
- 대상자 판단은 raw Supabase DB가 아니라 기존 원칙대로 D1 동기화 테이블을 사용한다.
- 노출/클릭 기록은 기존 `/capture` 이벤트 수집 경로를 사용한다.
- 회고 제출 여부는 기존 `reflection` 테이블의 `user_id + experiment_id` 중복 기준을 사용한다.
- 실험 상태와 기간은 기존 `experiments` 필드를 재사용한다.

남겨둔 경계:

- decide 호출 자체를 exposure로 자동 기록하지 않는다. 실제 화면 노출은 LVUP 프론트엔드만 알 수 있으므로 `project_reflection_ui_viewed` 이벤트를 별도로 전송하게 한다.
- 현재 파일럿은 12기 전체 대상 준실험이므로 사용자별 variant를 반환하지 않는다.
- 향후 정식 실험에서는 같은 placement API 내부에서 assignment 또는 feature flag decide 결과를 함께 내려줄 수 있다.

## 4. Decide API

LVUP 프론트엔드 권장 endpoint:

```http
GET /api/v1/placements/{placement_key}/decide?user_id={user_id}&project_id={project_id}
```

현재 12기 회고 조사에서 사용할 값:

- `placement_key`: `project-detail-home-reflection-cta`

실험 플랫폼은 해당 placement의 active experiment를 찾아 응답에 `experiment_id`를 포함한다.

active experiment 판단 기준:

- 같은 `placement_key`를 가진 placement config가 있어야 한다.
- 연결된 experiment 상태가 `running`이어야 한다.
- placement config가 `enabled=true`여야 한다.
- 현재 시간이 `reflection_start_date + reflection_window_days` 노출 기간 안이어야 한다.
- 동시에 여러 active experiment가 잡히면 최신 `reflection_start_date`, 최신 `created_at` 순으로 하나를 선택한다.

운영 원칙상 같은 placement에 동시에 여러 active experiment가 걸리지 않게 관리하는 것이 좋다.

명시적 실험 호출 endpoint:

```http
GET /api/v1/experiments/{experiment_id}/placements/{placement_key}/decide?user_id={user_id}&project_id={project_id}
```

현재 12기 회고 조사에서 명시 호출 시 사용할 값:

- `experiment_id`: `s12-mid-reflection`
- `placement_key`: `project-detail-home-reflection-cta`

외부 LVUP 프론트엔드는 프로젝트 상세 홈 진입 시 권장 endpoint를 호출한다.

- `show: true`, `submitted: false`: 작성 가능한 회고 진입 UI 렌더링
- `show: true`, `submitted: true`: 이미 제출한 사용자용 완료 상태 UI 렌더링
- `show: false`: 대상자가 아니거나 노출 기간 밖이므로 렌더링하지 않음

## 4-1. LVUP 연동 환경 기준

LVUP에 공식 전달할 API base URL은 운영 URL만 기준으로 한다.

```text
https://exp.pseudolab-devfactory.com/api/v1
```

현재 별도 공식 staging/sandbox API는 정의되어 있지 않다. 개인 확인용 URL은 실험 플랫폼 담당자의 개발 확인에만 사용하며, LVUP 연동 문서나 QA 기준 URL로 사용하지 않는다.

따라서 LVUP 연동 QA는 다음처럼 구분한다.

- API 연결 smoke test: 운영 URL에서 `/status/`, OpenAPI, decide endpoint 응답 여부를 확인한다.
- 기능 QA: 운영 환경에 `s12-mid-reflection` 실험과 `project-detail-home-reflection-cta` placement 설정이 등록된 뒤 진행한다.
- 설정 등록 전 placement-only decide 응답의 `show: false`, `reason: "placement_not_found"`는 API 장애가 아니라 placement 설정 데이터가 없다는 의미다.
- placement 설정은 있으나 active experiment가 없으면 `show: false`, `reason: "outside_exposure_window"`로 내려간다.
- QA scenario override는 명시적으로 활성화된 QA 환경에서만 사용한다. 현재 공식 staging/sandbox가 없으면 LVUP 전달 기준에 포함하지 않는다.

## 5. 노출 대상 응답 예시

```json
{
  "show": true,
  "reason": "eligible",
  "submitted": false,
  "experiment_id": "s12-mid-reflection",
  "placement_key": "project-detail-home-reflection-cta",
  "ui": {
    "id": "s12-mid-reflection-banner",
    "type": "banner",
    "title": "중간 회고 작성하기",
    "description": "지금까지의 여정을 정리하고 남은 기간 방향을 잡아봐요",
    "target_url": "/reflection/s12-mid-reflection"
  },
  "logging_context": {
    "experiment_id": "s12-mid-reflection",
    "placement_key": "project-detail-home-reflection-cta",
    "ui_id": "s12-mid-reflection-banner",
    "ui_type": "banner",
    "project_id": "PROJECT_ID",
    "project_cohort": "12",
    "user_project_role": "runner",
    "source": "project_detail_home"
  }
}
```

## 6. 제출 완료 응답 예시

이미 제출한 사용자에게도 12기 전체 조사 안내의 일관성을 위해 UI 영역은 노출한다. 단, `submitted: true`와 `reason: "already_submitted"`를 내려 외부 LVUP 프론트엔드가 완료 상태로 렌더링할 수 있게 한다.

```json
{
  "show": true,
  "reason": "already_submitted",
  "submitted": true,
  "experiment_id": "s12-mid-reflection",
  "placement_key": "project-detail-home-reflection-cta",
  "ui": {
    "id": "s12-mid-reflection-banner",
    "type": "banner",
    "title": "중간 회고 작성하기",
    "description": "지금까지의 여정을 정리하고 남은 기간 방향을 잡아봐요",
    "target_url": "/reflection/s12-mid-reflection"
  }
}
```

## 7. 비노출 응답 예시

```json
{
  "show": false,
  "reason": "not_project_member",
  "submitted": false
}
```

지원하는 주요 reason:

- `not_authenticated`
- `not_target_cohort`
- `not_project_member`
- `unsupported_role`
- `inactive_membership`
- `outside_exposure_window`
- `already_submitted`
- `experiment_not_found`
- `placement_not_found`
- `eligible`

## 8. Decide 판단 순서

API는 다음 순서로 판단한다.

1. `user_id`가 있는지 확인한다.
2. placement-only 호출이면 `{placement_key}`에 연결된 active experiment를 찾는다.
3. 명시 호출이면 `{experiment_id}` 실험이 존재하는지 확인한다.
4. `{placement_key}` 설정이 존재하는지 확인한다.
5. 실험 상태가 `running`이고 placement가 enabled인지 확인한다.
6. 해당 프로젝트가 placement config의 target cohort에 속하는지 확인한다. 이번 seed 값은 12기다.
7. 해당 사용자가 프로젝트 멤버인지 확인한다.
8. 프로젝트 role이 `builder` 또는 `runner`인지 확인한다.
9. 멤버십 상태가 `active`인지 확인한다.
10. 현재 시간이 회고 노출 기간 안인지 확인한다.
11. `user_id + experiment_id` 기준으로 이미 회고를 제출했는지 확인한다.

## 9. 실험 플랫폼에서 조정 가능한 값

실험 상태와 기간은 기존 experiment 모델을 사용한다.

- `experiments.status`
- `experiments.reflection_start_date`
- `experiments.reflection_window_days`

UI placement 설정은 새 config 테이블에서 관리한다.

- `experiment_placement_config.placement_key`
- `experiment_placement_config.ui_id`
- `experiment_placement_config.ui_type`
- `experiment_placement_config.title`
- `experiment_placement_config.description`
- `experiment_placement_config.target_url`
- `experiment_placement_config.source`
- `experiment_placement_config.target_cohort`
- `experiment_placement_config.allowed_roles`
- `experiment_placement_config.enabled`

`target_cohort = "*"`이면 특정 기수로 제한하지 않는다. `allowed_roles = []`이면 프로젝트 멤버 role을 제한하지 않는다. 따라서 12기와 builder/runner는 플랫폼 기본값이 아니라 이번 파일럿 seed 설정이다.

즉, 실험 상태와 기간은 기존 실험관리 모델로 제어하고, LVUP에 내려줄 UI 문구/링크/활성화는 placement config로 제어한다.

## 10. 관리 API

LVUP 연동 API:

```http
GET /api/v1/placements/{placement_key}/decide
```

실험 플랫폼 대시보드 관리 API:

```http
GET /api/v1/experiments/{experiment_id}/placements
POST /api/v1/experiments/{experiment_id}/placements
GET /api/v1/experiments/{experiment_id}/placements/{placement_key}/config
PATCH /api/v1/experiments/{experiment_id}/placements/{placement_key}/config
DELETE /api/v1/experiments/{experiment_id}/placements/{placement_key}
```

관리 API는 실험 플랫폼 대시보드 프론트엔드에서 LVUP 노출 슬롯을 관리하기 위해 사용하는 백엔드 계약이다.

실험 생성 화면에서는 실험을 만들면서 초기 LVUP 노출 슬롯을 선택적으로 함께 생성할 수 있다. 실험 상세 화면에서는 슬롯 목록 조회, 생성, 수정, 삭제를 지원한다.

새 슬롯은 LVUP 프론트엔드에 실제 렌더링 슬롯이 먼저 정의되어 있을 때 생성한다. 운영 중 잠시 숨기려는 경우에는 삭제보다 `enabled=false` 비활성화를 우선 사용한다.

## 11. 사용하는 데이터

운영 raw DB를 직접 보지 않고, 기존 실험 플랫폼 원칙대로 D1 동기화 데이터를 사용한다.

사용 테이블:

- `dl_projects`
  - 프로젝트가 placement config의 target cohort에 속하는지 확인
  - 최신 `base_date` 스냅샷 기준
- `dl_project_members`
  - 사용자가 프로젝트 멤버인지 확인
  - role이 `builder` 또는 `runner`인지 확인
  - status가 `active`인지 확인
  - 최신 `base_date` 스냅샷 기준
- `reflection`
  - `user_id + experiment_id` 기준 제출 여부 확인
  - 제출자는 숨기지 않고 `submitted: true` 상태로 내려줌
- `experiments`
  - 실험 존재 여부, 상태, 회고 노출 기간 확인
- `experiment_placement_config`
  - placement와 UI 문구, URL, enabled 여부 확인

## 12. 이벤트 로깅

UI가 실제로 노출되거나 클릭되면 기존 이벤트 수집 API를 그대로 사용한다.

```http
POST /api/v1/capture
```

현재 LVUP 구현이 배너 형태여도 이벤트 이름은 UI/placement 기준으로 일반화한다.

- `project_reflection_ui_viewed`
- `project_reflection_ui_clicked`

다만 properties에는 배너 전용 식별자 대신 placement 기반 컨텍스트를 포함한다.

- `experiment_id`
- `placement_key`
- `ui_id`
- `ui_type`
- `project_id`
- `project_cohort`
- `user_project_role`
- `source`
- `target_url` 클릭 이벤트에만 포함 가능

## 13. 분배 정책

이번 12기 회고 조사는 실험 플랫폼 완성 전 과도기 준실험이며, 플랫폼의 placement decide, target rule, event logging 연동이 실제 제품에서 동작하는지 확인하는 검증 케이스다. 따라서 현 단계에서는 실험군/대조군 균등 분배를 적용하지 않는다.

이번 파일럿 seed에서는 대상 조건을 만족하는 12기 active `builder`/`runner`에게 모두 같은 placement 판단을 제공한다. 다른 실험에서는 config의 target cohort와 allowed roles를 다르게 설정할 수 있다.

향후 정식 실험으로 운영할 때는 같은 placement API 뒤에 assignment 또는 feature flag rule을 연결해 사용자별 variant를 결정하고 exposure를 기록할 수 있다.

## 14. 추가된 파일

- `backend/app/api/v1/endpoints/experiment_placements.py`
- `backend/app/api/v1/endpoints/placements.py`
- `backend/app/schemas/experiment_placement.py`
- `backend/app/services/experiment_placement.py`
- `backend/migrations/011_experiment_placement_config.sql`
- `backend/tests/test_experiment_placements.py`

수정된 주요 파일:

- `backend/app/api/v1/api.py`
- `backend/app/core/config.py`
- `backend/.env.sample`
- `backend/tests/conftest.py`
- `frontend/src/services/api.ts`
- `frontend/src/features/dashboard/components/CreateExperimentModal.tsx`
- `frontend/src/features/dashboard/components/ExperimentDetail.tsx`

추가된 프론트엔드 테스트:

- `frontend/src/__tests__/ExperimentDetail.test.tsx`
- `frontend/src/__tests__/CreateExperimentModal.test.tsx`

## 15. 테스트 결과

백엔드 전체 테스트를 통과했다.

```text
cd backend && ./venv/bin/pytest
149 passed
```

프론트엔드 전체 테스트와 빌드도 통과했다.

```text
cd frontend && npm test -- --run
55 passed

cd frontend && npm run build
built successfully
```

## 16. 남은 결정 사항

운영 적용 전에 아래 사항을 정해야 한다.

1. 실제 회고 UI 노출 시작일
2. 노출 기간 일수
3. 외부 LVUP 프론트엔드에 전달할 최종 API 계약 문서
4. 운영 환경에 `s12-mid-reflection` 실험과 placement 설정을 등록할 시점
5. `req.md`를 공식 계약 문서로 남길지 여부
6. 별도 공식 staging/sandbox API를 둘지 여부. 현재 LVUP 전달 기준은 운영 URL이다.

## 17. 팀장 보고용 결론

이번 작업은 외부 프론트엔드가 UI 노출 판단을 직접 하지 않고, 실험 플랫폼에 위임할 수 있게 만든 백엔드 계약 작업이다. 12기 회고는 그 계약이 실제 제품 연동에서 동작하는지 확인하는 첫 검증 사례다.

초기 요청은 배너였지만, 플랫폼 API를 배너 전용으로 만들면 다음 UI 실험마다 라우트와 테이블이 늘어난다. 그래서 이번 PR에서는 “실험의 특정 UI placement를 보여줄지 판단한다”는 모델로 일반화했다.

외부 LVUP 프론트엔드는 `placement_key`, `user_id`, `project_id`만 보내면 되고, 실험 플랫폼은 active experiment, D1 동기화 데이터, placement 설정을 기준으로 노출 여부를 판단한다. 현재 UI는 `ui.type = "banner"`로 내려가지만, 나중에 카드/모달/CTA로 바뀌어도 API 구조는 유지된다.

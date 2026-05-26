Status: active
Last-Validated: 2026-05-27
Owner: soo
Audience: internal only

# Project Reflection Placement Development Internal Report

## 1. 이 문서의 목적

이 문서는 LVUP 전달용 문서가 아니라, 실험 플랫폼 개발 작업을 내부에서 파악하기 위한 보고서다.

초기 요청서(`req.md`)는 “LVUP 프로젝트 상세 홈에 12기 회고 배너를 띄울지 판단하는 API”를 요구했다. 작업 중 사용자 피드백과 플랫폼 아키텍처 검토를 거치면서, 최종 구현은 배너 전용 API가 아니라 `placement_key` 중심의 `experiment placement` API로 정리했다. 12기 회고는 최종 목표가 아니라, 실험 플랫폼이 실제 제품 연동에서 역할을 수행하는지 검증하는 첫 파일럿이다.

## 2. 현재 결론

이번 작업은 “12기 배너 API”가 아니라 “실험의 특정 UI placement를 노출할지 판단하는 백엔드 API”로 구현하는 것이 맞다.

최종 API 구조:

```http
GET /api/v1/placements/{placement_key}/decide
GET /api/v1/experiments/{experiment_id}/placements
POST /api/v1/experiments/{experiment_id}/placements
GET /api/v1/experiments/{experiment_id}/placements/{placement_key}/decide
GET /api/v1/experiments/{experiment_id}/placements/{placement_key}/config
PATCH /api/v1/experiments/{experiment_id}/placements/{placement_key}/config
DELETE /api/v1/experiments/{experiment_id}/placements/{placement_key}
```

현재 파일럿 검증 케이스에서 쓰는 seed 값:

```text
experiment_id = s12-mid-reflection
placement_key = project-detail-home-reflection-cta
ui.type = banner
```

여기서 placement는 실험 플랫폼이 외부 제품 화면의 물리적 위치를 정한다는 뜻이 아니다. 외부 프론트엔드가 미리 정의한 UI 슬롯 또는 진입점의 식별자이며, 실험 플랫폼은 해당 슬롯의 노출 여부와 문구를 관리한다.

LVUP 프론트엔드에는 `GET /api/v1/placements/{placement_key}/decide`를 권장한다. 이 endpoint는 LVUP 코드가 일회성 `experiment_id`를 알 필요가 없도록, 플랫폼이 해당 placement의 active experiment를 찾아서 응답의 `experiment_id`로 돌려준다.

## 3. 왜 이렇게 바꿨는가

처음 구현은 `/project-reflection-banner/decide`에 가까운 구조였다. 이 방식은 빠르게 만들 수 있지만 다음 문제가 있었다.

- 실험이 생길 때마다 새 라우트를 만들게 된다.
- 배너가 카드, 모달, 인라인 CTA로 바뀌면 API 이름부터 맞지 않는다.
- 실험 플랫폼의 중심 모델인 `experiments`와 연결이 약하다.
- LVUP의 현재 UI 형태가 플랫폼 API의 영구 개념처럼 고정된다.

그래서 라우트를 다음처럼 바꿨다.

```text
특정 기능 API
  /project-reflection-banner/decide

실험 하위 placement API
  /experiments/{experiment_id}/placements/{placement_key}/decide

LVUP 권장 placement-only API
  /placements/{placement_key}/decide
```

이 구조는 현재 과도기 준실험에도 맞고, 나중에 정식 실험 플랫폼 기능이 완성됐을 때 active experiment resolve, assignment, feature flag rule, exposure logging을 뒤에 붙이기 쉽다.

## 4. 실험 플랫폼 관점의 위치

기존 실험 플랫폼의 이상적인 흐름은 다음과 같다.

```text
Experiment
  -> assignment 또는 feature flag/rule
  -> exposure logging
  -> metric/result
  -> decision
```

하지만 현재는 실험 플랫폼 전체 기능이 완성된 상태가 아니므로, 12기 회고 조사는 플랫폼 기능 검증을 겸한 과도기 준실험으로 먼저 진행한다.

이번 API는 아직 정식 A/B 분배 엔진은 아니지만, 실험 플랫폼의 placement decision 역할은 수행한다. 현재 역할은 다음으로 제한했다.

- LVUP이 가진 `user_id`, `project_id`만으로 서버가 대상 여부를 판단한다.
- config로 설정된 target cohort와 allowed roles 조건을 확인한다.
- 실험 상태와 노출 기간을 확인한다.
- 회고 제출 여부를 확인한다.
- 보여줄 UI 문구, 타입, 이동 URL, 로깅 컨텍스트를 내려준다.

즉, 이번 PR은 실험 플랫폼의 정식 분배 기능을 대신 만드는 작업이 아니라, 과도기 준실험을 플랫폼 데이터와 API 계약 안에서 운영하면서 플랫폼의 대상 판정, active experiment resolve, UI config 전달, 이벤트 수집 연동을 검증하는 작업이다.

## 5. 준실험으로 처리한 이유

사용자 설명에 따르면 이번 12기 회고 조사는 “실험 플랫폼 전체 기능이 완성되기 전에 먼저 진행하는 과도기 작업”이자, 플랫폼이 실제로 실험 플랫폼 역할을 수행하는지 확인하는 검증 케이스다. 그래서 지금은 무작위 실험군/대조군 분배를 적용하지 않는다.

현재 파일럿 정책:

- seed config의 대상자인 12기 active `builder`/`runner`는 모두 같은 placement 판단을 받는다.
- 이미 제출한 대상자도 숨기지 않고 `show: true`, `completed: true`를 받는다.
- target cohort/role 조건에 맞지 않거나 대상자가 아니면 `show: false`다.
- 정식 A/B 실험처럼 variant assignment를 생성하지 않는다.
- decide 호출 자체를 exposure로 자동 기록하지 않는다.

실제 노출 여부는 LVUP 프론트엔드만 정확히 알 수 있으므로, LVUP이 `project_reflection_ui_viewed`를 보내야 한다.

## 6. LVUP 요청에서 반영한 것

그대로 반영한 내용:

- LVUP은 `user_id`, `project_id`만 전달한다.
- 대상 판단은 실험 플랫폼 백엔드가 한다.
- 프로젝트 cohort와 멤버십은 D1 동기화 데이터를 사용한다.
- 완료 여부는 실험의 `completion_event`와 `user_id + experiment_id` 기준으로 판단한다.
- 문구, 설명, 이동 URL은 API 응답으로 내려준다.
- 이벤트는 기존 `/api/v1/capture`를 사용한다.
- QA용 `scenario` 강제 응답을 제공하되, 명시적으로 override가 켜진 QA 환경에서만 사용한다.

정책 결정 후 반영한 내용:

- 이미 제출한 사용자도 `show: true`, `completed: true`로 내려준다.
- 12기 전체 조사이므로 제출자와 미제출자 모두 UI 영역은 유지한다.
- 12기가 아닌 프로젝트나 대상자가 아닌 사용자는 `show: false`다.

범용화를 위해 반영한 내용:

- backend schema와 migration의 기본 target cohort를 `12`가 아니라 `*`로 둔다.
- backend schema와 migration의 기본 allowed roles를 `["builder","runner"]`가 아니라 빈 배열로 둔다.
- `target_cohort = "*"`이면 특정 기수 제한 없이 통과한다.
- `allowed_roles = []`이면 프로젝트 멤버 role 제한 없이 통과한다.
- 12기와 builder/runner 조건은 플랫폼 기본값이 아니라 이번 파일럿 seed 설정으로만 둔다.

## 7. LVUP 요청에서 보정한 것

LVUP 최초 요청과 다르게 보정한 내용:

| 최초 요청 또는 표현 | 보정 결과 | 이유 |
| --- | --- | --- |
| `project-reflection-banner` 전용 라우트 | experiment placement 라우트 | 실험별 라우트 증가 방지 |
| `banner_id` 중심 응답 | `placement_key`, `ui.id`, `ui.type` | 배너 외 UI 타입까지 지원 |
| `not_s12_project` reason | `not_target_cohort` | 12기 전용 용어 제거 |
| `outside_reflection_window` reason | `outside_exposure_window` | 회고 외 placement에도 사용 가능 |
| `project_reflection_banner_viewed/clicked` | `project_reflection_ui_viewed/clicked` | 실제 UI가 배너가 아닐 수 있음 |
| 배너 전용 config 테이블 | `experiment_placement_config` | 실험 하위 placement 설정으로 일반화 |

이 보정은 LVUP 요구사항을 무시한 것이 아니라, 현재 요구를 만족하면서도 실험 플랫폼의 장기 구조에 맞추기 위한 변경이다.

## 8. 구현한 백엔드 구조

추가/변경된 핵심 파일:

- `backend/app/api/v1/endpoints/experiment_placements.py`
- `backend/app/api/v1/endpoints/placements.py`
- `backend/app/schemas/experiment_placement.py`
- `backend/app/services/experiment_placement.py`
- `backend/migrations/011_experiment_placement_config.sql`
- `backend/tests/test_experiment_placements.py`
- `backend/tests/conftest.py`
- `backend/app/api/v1/api.py`
- `backend/app/core/config.py`
- `backend/.env.sample`
- `frontend/src/services/api.ts`
- `frontend/src/features/dashboard/components/CreateExperimentModal.tsx`
- `frontend/src/features/dashboard/components/ExperimentDetail.tsx`
- `frontend/src/__tests__/ExperimentDetail.test.tsx`
- `frontend/src/__tests__/CreateExperimentModal.test.tsx`

문서:

- `docs/reports/project-reflection-placement-api-report-2026-05-25.md`
- `docs/reports/project-reflection-placement-development-internal-report-2026-05-25.md`

LVUP 전달용 문서는 외부 공유 후 repo에는 보관하지 않는다.

공식 LVUP 연동 기준 URL은 운영 URL인 `https://exp.pseudolab-devfactory.com/api/v1`만 사용한다. 개인 확인용 URL은 개발자 확인 용도이며, LVUP 전달 문서의 개발/스테이징/sandbox API로 취급하지 않는다. 현재 별도 공식 staging/sandbox API는 정의되어 있지 않다.

## 9. Decide API 내부 판단 흐름

`ExperimentPlacementService.decide()`는 다음 순서로 판단한다.

1. `scenario`가 있으면 QA override로 처리한다.
2. `user_id`가 없으면 `not_authenticated`.
3. `experiments`와 `experiment_placement_config`를 join해서 config를 찾는다.
4. 실험은 있는데 placement가 없으면 `placement_not_found`.
5. 실험이 없으면 `experiment_not_found`.
6. 실험 상태가 `running`이 아니거나 placement가 disabled면 `outside_exposure_window`.
7. D1 main DB의 `dl_projects`, `dl_project_members`에서 프로젝트 cohort와 멤버십을 확인한다.
8. target cohort가 아니면 `not_target_cohort`.
9. 멤버가 아니면 `not_project_member`.
10. role이 허용 목록 밖이면 `unsupported_role`.
11. 멤버십이 active가 아니면 `inactive_membership`.
12. 노출 기간 밖이면 `outside_exposure_window`.
13. `completion_event` 또는 기존 `reflection` fallback으로 이미 완료했는지 확인한다.
14. 완료자는 `show: true`, `completed: true`, `already_completed`.
15. 미완료 대상자는 `show: true`, `completed: false`, `eligible`.

`ExperimentPlacementService.decide_by_placement()`는 LVUP 권장 endpoint에서 사용한다.

1. `user_id`가 없으면 `not_authenticated`.
2. `{placement_key}`에 연결된 placement config들을 찾는다.
3. `running`, `enabled=true`, 노출 기간 안인 active experiment를 최신 `start_at`, 최신 `reflection_start_date`, 최신 `created_at` 순으로 하나 선택한다.
4. placement config 자체가 없으면 `placement_not_found`.
5. placement config는 있으나 active experiment가 없으면 `outside_exposure_window`.
6. active experiment를 찾으면 기존 `decide(experiment_id, placement_key, ...)` 판단 흐름을 재사용한다.

운영 원칙상 같은 placement에 동시에 여러 active experiment가 걸리지 않도록 관리하는 것이 좋다. 코드에서는 충돌 시 deterministic하게 최신 노출 시작일 기준으로 하나를 선택한다.

## 10. 데이터 모델

새 테이블:

```sql
experiment_placement_config (
  experiment_id,
  placement_key,
  ui_id,
  ui_type,
  title,
  description,
  target_url,
  source,
  target_cohort,
  allowed_roles,
  enabled,
  created_at,
  updated_at
)
```

기본 seed:

```text
experiment_id = s12-mid-reflection
placement_key = project-detail-home-reflection-cta
ui_id = s12-mid-reflection-banner
ui_type = banner
target_cohort = 12
allowed_roles = ["builder", "runner"]
```

schema-level default:

```text
target_cohort = *
allowed_roles = []
source = unknown
```

즉, 12기와 builder/runner는 seed 데이터의 조건이지 플랫폼 기본 정책이 아니다.

## 11. 이벤트와 metric

이벤트 이름은 배너 전용이 아니라 UI 기준으로 정리했다.

- `project_reflection_ui_viewed`
- `project_reflection_ui_clicked`

seed된 `experiments.primary_metric`은 `project_reflection_ui_clicked`로 설정했다.

주의할 점:

- decide 호출은 실제 노출이 아니다.
- 실제 노출은 LVUP이 viewport 기준으로 판단해서 `project_reflection_ui_viewed`를 보내야 한다.
- 클릭은 LVUP이 이동 직전에 `project_reflection_ui_clicked`를 보내야 한다.
- 제출 완료는 기존 `reflection` 테이블이 기준이다.

## 12. 테스트

전체 백엔드 테스트를 통과했다.

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

추가로 whitespace 검사도 통과했다.

```text
git diff --check
```

placement 테스트에서 검증한 주요 케이스:

- 대상자는 `show: true`, `eligible`.
- 완료자는 `show: true`, `already_completed`, `completed: true`.
- 미로그인 사용자는 `not_authenticated`.
- 실험 없음은 `experiment_not_found`.
- placement 없음은 `placement_not_found`.
- cohort 불일치는 `not_target_cohort`.
- 프로젝트 멤버 아님은 `not_project_member`.
- role 불일치는 `unsupported_role`.
- inactive 멤버십은 `inactive_membership`.
- 기간 밖, paused, disabled는 `outside_exposure_window`.
- QA scenario override.
- `/capture` 이벤트 수집.
- placement config GET/POST/PATCH/DELETE.
- placement-only decide에서 active experiment resolve.
- wildcard cohort와 빈 role 목록이 12기 전용 조건으로 동작하지 않음.

## 13. 현재 남은 리스크

1. placement decide의 기준 노출 기간은 `experiments.start_at/end_at`으로 일반화했다.
   - 기존 reflection 기능과의 호환을 위해 `reflection_start_date/window_days`는 fallback으로만 유지했다.
   - 향후 더 세밀한 노출 제어가 필요하면 `experiment_placement_config`에 `starts_at`, `ends_at`을 추가하는 편이 낫다.

2. 완료 여부 판단은 `completion_event`를 우선 사용한다.
   - 기존 회고 제출 데이터와의 호환을 위해 `reflection` 테이블 fallback은 유지했다.
   - 장기적으로는 event schema와 conversion window를 더 명확히 정의해야 한다.

3. 이번 API는 아직 자동 exposure logging을 하지 않는다.
   - 과도기 준실험에서는 LVUP의 viewed/clicked 이벤트가 기준이다.
   - 정식 실험 전환 시 placement decide와 exposure logging 연결이 필요하다.

4. 실험 플랫폼 대시보드 프론트엔드에는 placement config 생성/조회/편집/삭제 UI가 붙었다.
   - 실험 생성 화면에서 초기 placement를 선택적으로 함께 생성할 수 있다.
   - 실험 상세 화면에서 기존 실험의 placement를 추가/수정/삭제할 수 있다.
   - 대시보드 화면은 placement 기본 정보, 대상 조건, 응답 payload, 분석/로깅 컨텍스트를 구분해서 보여준다.
   - `target_url`, `title`, `description`, `ui_type`은 실험 플랫폼이 UI를 소유한다는 의미가 아니라 외부 제품 서비스에 내려줄 response payload다.
   - 새 placement는 LVUP 프론트엔드에 실제 렌더링 지점이 정의되어 있을 때만 생성해야 한다.
   - 운영 중 잠시 숨기려는 경우에는 삭제보다 `enabled=false` 비활성화를 우선 사용한다.

5. placement-only decide는 같은 placement의 active experiment가 여러 개일 때 최신 노출 시작일 기준으로 하나를 선택한다.
   - 이 동작은 LVUP 연동 안정성을 위한 fallback이다.
   - 운영 정책상 같은 placement에 동시에 여러 active experiment를 연결하지 않는 것이 우선이다.

6. D1 main 동기화 데이터 품질에 의존한다.
   - `dl_projects`, `dl_project_members`의 최신 `base_date` 기준으로 판단한다.
   - 동기화 지연이 있으면 LVUP 표시 판단도 지연될 수 있다.

7. LVUP이 이벤트를 정확히 보내야 분석이 가능하다.
   - 특히 viewed 이벤트는 “실제로 보였는지” 기준이므로 프론트 구현 품질이 중요하다.

## 14. PR 반영 전 체크포인트

PR에 push하기 전에 확인할 것:

- LVUP이 권장 endpoint인 `/placements/{placement_key}/decide`와 reason 이름을 수용할 수 있는지
- 이벤트 이름을 `project_reflection_ui_*`로 바꾸는 데 동의하는지
- `show: true`, `completed: true` 완료 상태 UI를 구현할 수 있는지
- `ui.type`이 `banner` 외 값이어도 fallback할 수 있는지
- 운영 노출 시작일과 기간을 누가 설정할지

## 15. 후속 작업 제안

우선순위 높은 후속 작업:

1. LVUP 전달 내용 리뷰 후 API 계약 확정
2. 실제 운영 시작일 설정
3. 운영 환경에 `s12-mid-reflection` 실험과 placement 설정 등록
4. LVUP에서 운영 URL 기준 placement-only API 연결 smoke test와 기능 QA
5. 별도 공식 staging/sandbox API를 둘지 결정
6. 준실험 분석 계획 수립

정식 실험 플랫폼 전환 시 후속 작업:

1. placement decide에 assignment 또는 feature flag rule 연결
2. 자동 exposure logging 정책 추가
3. placement별 variant 응답 모델 설계
4. result/decision 화면에서 placement metric 확인 가능하게 연결

## 16. 판단 요약

현재 구현은 LVUP의 당장 필요한 회고 UI 노출 판단을 만족하면서도, 실험 플랫폼의 장기 구조를 크게 해치지 않는 쪽으로 정리되어 있다.

가장 중요한 판단은 “배너”를 플랫폼 리소스로 승격하지 않은 것이다. 배너는 현재 `ui.type`일 뿐이고, 플랫폼이 관리하는 것은 `experiment` 아래의 `placement`다.

이번 작업은 완성된 정식 실험 플랫폼 기능이 아니라 과도기 준실험 운영 지원이다. 다만 LVUP 연동 계약을 `placement_key` 중심으로 잡았기 때문에, 나중에 assignment/feature flag/exposure 흐름이 완성되어도 LVUP 코드에 일회성 `experiment_id`를 계속 박지 않아도 된다.

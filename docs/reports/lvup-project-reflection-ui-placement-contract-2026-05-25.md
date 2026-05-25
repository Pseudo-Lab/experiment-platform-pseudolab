Status: active
Last-Validated: 2026-05-25
Owner: soo

# LVUP 12기 회고 UI Placement API 전달 문서

## 1. 목적

LVUP 프로젝트 상세 홈에서 12기 프로젝트 회고 진입 UI를 노출할지 실험 플랫폼에 묻기 위한 API 계약이다.

이번 12기 회고 조사는 실험 플랫폼 전체 기능이 완성되기 전 과도기 운영이므로, 무작위 A/B 테스트가 아니라 준실험으로 진행한다. 따라서 LVUP 사용자를 실험군/대조군에 균등 분배하지 않는다.

대신 실험 플랫폼은 다음 판단을 서버에서 일관되게 수행한다.

- 현재 프로젝트가 대상 cohort인지
- 로그인 사용자가 해당 프로젝트의 active 멤버인지
- 사용자의 프로젝트 role이 대상 role인지
- 현재가 노출 가능 기간인지
- 사용자가 이미 회고를 제출했는지
- 어떤 UI 문구와 이동 URL을 내려줄지

## 2. LVUP 요청에서 보정된 부분

LVUP 최초 요청은 “프로젝트 회고 배너” 기준이었다. 실험 플랫폼에서는 향후 카드, 모달, 인라인 CTA 등으로 UI 형태가 바뀔 수 있다고 보고 API 계약을 `banner`가 아니라 `placement` 기준으로 일반화했다.

| LVUP 최초 요청 | 최종 계약 | 이유 |
| --- | --- | --- |
| `/api/v1/project-reflection-banner/decide` | `/api/v1/experiments/{experiment_id}/placements/{placement_key}/decide` | 실험마다 라우트를 새로 만들지 않기 위함 |
| 배너 전용 응답 필드 | `ui.type`, `ui.title`, `ui.target_url` | 현재는 배너여도 나중에 카드/모달/CTA로 변경 가능 |
| `banner_id` 중심 로깅 | `placement_key`, `ui_id`, `ui_type` 중심 로깅 | UI 위치와 표현 방식을 분리하기 위함 |
| `already_submitted`면 숨김 가능 | `show: true`, `submitted: true` | 12기 전체 조사라 제출자에게도 완료 상태 UI를 보여주는 것이 일관적 |
| `not_s12_project` | `not_target_cohort` | 12기 전용 이름을 일반화 |
| `outside_reflection_window` | `outside_exposure_window` | 회고 외 UI placement에도 재사용 가능 |
| `project_reflection_banner_viewed/clicked` | `project_reflection_ui_viewed/clicked` | 실제 UI가 배너가 아닐 수도 있음 |

## 3. LVUP에서 사용할 고정값

현재 12기 회고 조사에서 LVUP이 사용할 값은 다음과 같다.

```text
experiment_id = s12-mid-reflection
placement_key = project-detail-home-reflection-cta
```

현재 기본 UI 타입은 `banner`다.

## 4. Decide API

```http
GET /api/v1/experiments/s12-mid-reflection/placements/project-detail-home-reflection-cta/decide?user_id={user_id}&project_id={project_id}
```

### Query Parameters

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `user_id` | 권장 | 로그인한 Supabase auth user id. 없으면 `not_authenticated` |
| `project_id` | 필수 | LVUP 프로젝트 id |
| `scenario` | 로컬/QA 전용 | 강제 시나리오. 운영에서는 사용하지 않음 |

## 5. 응답 처리 규칙

### 작성 가능한 사용자

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

LVUP 처리:

- `show: true`이고 `submitted: false`이면 회고 작성 CTA를 활성 상태로 렌더링한다.
- 문구와 이동 URL은 응답의 `ui` 값을 사용한다.
- `ui.type`이 현재 지원하는 타입이 아니면 기본 CTA 또는 배너 스타일로 fallback한다.

### 이미 제출한 사용자

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

LVUP 처리:

- `show: true`이고 `submitted: true`이면 완료 상태 UI로 렌더링한다.
- 같은 12기 조사 대상자에게 UI 존재 여부가 달라 보이지 않도록 숨기지 않는다.
- CTA는 비활성화하거나 “제출 완료” 상태로 보여준다.

### 비대상 사용자

```json
{
  "show": false,
  "reason": "not_target_cohort",
  "submitted": false,
  "experiment_id": null,
  "placement_key": null,
  "ui": null,
  "logging_context": null
}
```

LVUP 처리:

- `show: false`이면 아무 UI도 렌더링하지 않는다.
- 비대상 사용자에는 12기가 아닌 프로젝트, 프로젝트 멤버가 아닌 사용자, 대상 role이 아닌 사용자, 비활성 멤버십, 노출 기간 밖이 포함된다.

## 6. Reason 목록

| reason | 의미 | LVUP 처리 |
| --- | --- | --- |
| `eligible` | 작성 가능한 대상자 | 활성 UI 노출 |
| `already_submitted` | 이미 제출한 대상자 | 완료 상태 UI 노출 |
| `not_authenticated` | 로그인 사용자 없음 | 렌더링하지 않음 |
| `not_target_cohort` | 대상 cohort 프로젝트가 아님 | 렌더링하지 않음 |
| `not_project_member` | 프로젝트 멤버가 아님 | 렌더링하지 않음 |
| `unsupported_role` | builder/runner가 아님 | 렌더링하지 않음 |
| `inactive_membership` | active 멤버십이 아님 | 렌더링하지 않음 |
| `outside_exposure_window` | 실험이 running이 아니거나 노출 기간 밖이거나 placement disabled | 렌더링하지 않음 |
| `experiment_not_found` | 실험 설정 없음 | 렌더링하지 않음 |
| `placement_not_found` | placement 설정 없음 | 렌더링하지 않음 |

## 7. 이벤트 로깅

Decide API가 `show: true`를 반환했더라도, 실제 화면에 보였는지는 LVUP 프론트엔드만 알 수 있다. 따라서 LVUP은 실제 노출과 클릭을 기존 capture endpoint로 보내야 한다.

```http
POST /api/v1/capture
```

### 실제 노출 이벤트

이벤트 이름:

```text
project_reflection_ui_viewed
```

권장 기준:

- UI가 viewport에 50% 이상 보임
- 1초 이상 유지됨
- 같은 페이지 세션에서 1회만 전송

payload:

```json
{
  "user_id": "USER_ID",
  "event_name": "project_reflection_ui_viewed",
  "properties": {
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

### 클릭 이벤트

이벤트 이름:

```text
project_reflection_ui_clicked
```

payload:

```json
{
  "user_id": "USER_ID",
  "event_name": "project_reflection_ui_clicked",
  "properties": {
    "experiment_id": "s12-mid-reflection",
    "placement_key": "project-detail-home-reflection-cta",
    "ui_id": "s12-mid-reflection-banner",
    "ui_type": "banner",
    "project_id": "PROJECT_ID",
    "project_cohort": "12",
    "user_project_role": "runner",
    "source": "project_detail_home",
    "target_url": "/reflection/s12-mid-reflection"
  }
}
```

## 8. 권장 LVUP 구현 흐름

1. 프로젝트 상세 홈 진입
2. 로그인 사용자가 있으면 decide API 호출
3. API 오류 또는 `show: false`이면 렌더링하지 않음
4. `show: true`, `submitted: false`이면 활성 회고 UI 렌더링
5. `show: true`, `submitted: true`이면 제출 완료 UI 렌더링
6. 실제 화면에 보이면 `project_reflection_ui_viewed` 전송
7. 사용자가 클릭하면 `project_reflection_ui_clicked` 전송 후 `ui.target_url`로 이동

네트워크 오류나 5xx 오류는 fail closed로 처리한다. 즉, 사용자에게 회고 UI를 보여주지 않는다.

## 9. QA 시나리오

로컬/스테이징에서 서버 설정이 허용된 경우에만 `scenario` query parameter로 강제 응답을 테스트할 수 있다.

```http
GET /api/v1/experiments/s12-mid-reflection/placements/project-detail-home-reflection-cta/decide?user_id=test-user&project_id=test-project&scenario=eligible
```

지원 시나리오:

- `eligible`
- `already_submitted`
- `not_target_cohort`
- `not_project_member`
- `unsupported_role`
- `inactive_membership`
- `outside_exposure_window`
- `experiment_not_found`
- `placement_not_found`
- `server_error`

운영 환경에서는 `scenario`를 보내지 않는다.

## 10. 향후 정식 실험 전환

이번 계약은 과도기 준실험을 위한 최소 운영 계약이지만, 정식 실험 플랫폼 흐름으로 확장 가능하게 설계되어 있다.

향후 실험 플랫폼의 전체 기능이 완성되면 같은 endpoint 뒤에 다음 기능을 연결할 수 있다.

- 사용자별 assignment
- feature flag rule/segment 기반 variant 결정
- 자동 exposure logging
- variant별 결과 분석

LVUP은 endpoint 구조를 바꾸지 않고도 응답의 `ui` 또는 향후 추가될 `variant` 정보를 기준으로 렌더링을 확장할 수 있다.

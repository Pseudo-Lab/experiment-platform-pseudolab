Status: active
Last-Validated: 2026-05-25
Owner: soo
Audience: LVUP frontend

# LVUP 프로젝트 회고 UI Placement API 연동 가이드

## 1. 요약

LVUP 프로젝트 상세 홈에서 12기 프로젝트 회고 진입 UI를 노출할지 실험플랫폼에 물어보는 API 계약입니다.

이 기능은 12기 회고 전용 라우트가 아니라 범용 experiment placement API입니다. 12기 회고는 첫 적용 사례이며, 현재 UI 표현 방식은 `banner`입니다.

LVUP은 노출 조건을 직접 판단하지 않습니다. LVUP은 `user_id`, `project_id`만 전달하고, 실험플랫폼이 대상자, 기간, 제출 여부, UI 문구와 이동 URL을 판단합니다.

## 2. LVUP에서 사용할 값

```text
experiment_id = s12-mid-reflection
placement_key = project-detail-home-reflection-cta
```

## 3. Decide API

```http
GET /api/v1/experiments/s12-mid-reflection/placements/project-detail-home-reflection-cta/decide?user_id={user_id}&project_id={project_id}
```

### Query Parameters

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `user_id` | 권장 | 로그인한 Supabase auth user id. 없으면 `not_authenticated` |
| `project_id` | yes | LVUP 프로젝트 id |
| `scenario` | QA only | 강제 응답 시나리오. 운영에서는 보내지 않음 |

## 4. 응답 처리

### 4-1. 작성 가능한 사용자

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

- `show: true`, `submitted: false`이면 활성 회고 UI를 렌더링합니다.
- 문구와 이동 URL은 응답의 `ui` 값을 사용합니다.
- `ui.type`이 현재 지원하지 않는 값이면 기본 CTA 또는 배너 스타일로 fallback합니다.

### 4-2. 이미 제출한 사용자

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

- `show: true`, `submitted: true`이면 제출 완료 상태 UI를 렌더링합니다.
- CTA는 비활성화하거나 `제출 완료` 상태로 보여줍니다.
- 같은 12기 조사 대상자에게 UI 영역 자체가 사라지지 않도록 숨기지 않습니다.

### 4-3. 비대상 사용자

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

- `show: false`이면 아무 UI도 렌더링하지 않습니다.
- API 오류 또는 5xx 오류도 fail closed로 처리해 UI를 렌더링하지 않습니다.

## 5. Reason 목록

| reason | 의미 | LVUP 처리 |
| --- | --- | --- |
| `eligible` | 작성 가능한 대상자 | 활성 UI 노출 |
| `already_submitted` | 이미 제출한 대상자 | 완료 상태 UI 노출 |
| `not_authenticated` | 로그인 사용자 없음 | 렌더링하지 않음 |
| `not_target_cohort` | 대상 cohort 프로젝트가 아님 | 렌더링하지 않음 |
| `not_project_member` | 프로젝트 멤버가 아님 | 렌더링하지 않음 |
| `unsupported_role` | 대상 role이 아님 | 렌더링하지 않음 |
| `inactive_membership` | active 멤버십이 아님 | 렌더링하지 않음 |
| `outside_exposure_window` | 실험이 running이 아니거나 노출 기간 밖이거나 placement disabled | 렌더링하지 않음 |
| `experiment_not_found` | 실험 설정 없음 | 렌더링하지 않음 |
| `placement_not_found` | placement 설정 없음 | 렌더링하지 않음 |

## 6. 이벤트 로깅

Decide API가 `show: true`를 반환해도 실제 화면에 보였는지는 LVUP만 알 수 있습니다. 따라서 LVUP은 실제 노출과 클릭을 기존 capture endpoint로 전송해야 합니다.

```http
POST /api/v1/capture
```

### 6-1. 실제 노출 이벤트

권장 전송 기준:

- UI가 viewport에 50% 이상 보임
- 1초 이상 유지됨
- 같은 페이지 세션에서 1회만 전송

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

### 6-2. 클릭 이벤트

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

## 7. 권장 구현 흐름

1. 프로젝트 상세 홈 진입
2. 로그인 사용자가 있으면 decide API 호출
3. API 오류 또는 `show: false`이면 렌더링하지 않음
4. `show: true`, `submitted: false`이면 활성 회고 UI 렌더링
5. `show: true`, `submitted: true`이면 제출 완료 UI 렌더링
6. 실제 화면에 보이면 `project_reflection_ui_viewed` 전송
7. 사용자가 클릭하면 `project_reflection_ui_clicked` 전송 후 `ui.target_url`로 이동

## 8. QA 시나리오

스테이징 또는 로컬 QA 환경에서 서버 설정이 허용된 경우에만 `scenario` query parameter로 강제 응답을 테스트할 수 있습니다. 운영 환경에서는 보내지 않습니다.

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

## 9. 역할 분담

실험플랫폼:

- 대상자 판단
- 노출 기간 판단
- 제출 여부 판단
- UI 문구, 설명, URL, logging context 반환
- 운영자가 사용할 placement config API 제공

LVUP:

- decide API 호출
- 응답에 따른 UI 렌더링
- 실제 노출/클릭 이벤트 전송
- `ui.target_url`로 이동 처리

## 10. 운영 설정 메모

노출 시작일과 노출 기간은 LVUP이 설정하는 값이 아니라 실험플랫폼의 실험 설정값입니다.

현재 backend는 기존 실험 모델의 아래 필드를 사용합니다.

- `experiments.reflection_start_date`
- `experiments.reflection_window_days`

실험플랫폼 관리 UI가 붙으면 해당 UI에서 운영자가 수정하는 흐름이 맞습니다. 현재 PR은 backend config API까지 제공하며, 대시보드 편집 화면은 후속 작업입니다.

Status: active
Last-Validated: 2026-05-25
Owner: soo

# Project Reflection Banner API Implementation Report

## 1. 한 줄 요약

외부 LVUP 서비스 프론트엔드가 12기 프로젝트 회고 배너를 노출할지 실험 플랫폼에 물어볼 수 있도록, 전용 decide API와 배너 설정 API를 백엔드에 추가했다.

외부 LVUP 프론트엔드는 더 이상 12기 여부, 프로젝트 멤버십, 역할, 제출 여부, 노출 기간을 직접 판단하지 않는다. `user_id`와 `project_id`만 전달하고, 실험 플랫폼이 최종 노출 여부와 배너 문구, 이동 URL, 로깅 컨텍스트를 내려준다.

## 2. 배경

LVUP 프로젝트 상세 홈 화면에 12기 builder/runner 대상 회고 배너를 노출해야 한다.

외부 LVUP 프론트엔드가 현재 알고 있는 값은 다음 두 개뿐이다.

- `user_id`: 로그인한 Supabase auth user id
- `project_id`: 현재 프로젝트 상세 페이지의 프로젝트 id

하지만 배너 노출 여부를 판단하려면 다음 정보가 추가로 필요하다.

- 해당 프로젝트가 12기 프로젝트인지
- 사용자가 해당 프로젝트의 멤버인지
- 사용자의 프로젝트 role이 `builder` 또는 `runner`인지
- 멤버십 상태가 `active`인지
- 현재가 회고 배너 노출 기간인지
- 사용자가 이미 회고를 제출했는지

이 판단을 외부 LVUP 프론트엔드에 두면 LVUP 쪽 코드가 실험 플랫폼의 데이터 구조를 많이 알아야 한다. 그래서 이번 구현에서는 판단 책임을 실험 플랫폼 백엔드로 옮겼다.

## 3. 추가된 핵심 API

```http
GET /api/v1/project-reflection-banner/decide?user_id={user_id}&project_id={project_id}
```

외부 LVUP 프론트엔드는 프로젝트 상세 홈 진입 시 이 API를 호출한다.

- `show: true`, `submitted: false`: 작성 가능한 회고 배너 렌더링
- `show: true`, `submitted: true`: 이미 제출한 사용자용 완료 상태 배너 렌더링
- `show: false`: 대상자가 아니거나 노출 기간 밖이므로 렌더링하지 않음

## 4. Decide 판단 순서

API는 다음 순서로 판단한다.

1. `user_id`가 있는지 확인한다.
2. `s12-mid-reflection` 실험이 존재하는지 확인한다.
3. 해당 프로젝트가 12기 프로젝트인지 확인한다.
4. 해당 사용자가 프로젝트 멤버인지 확인한다.
5. 프로젝트 role이 `builder` 또는 `runner`인지 확인한다.
6. 멤버십 상태가 `active`인지 확인한다.
7. 현재 시간이 회고 배너 노출 기간 안인지 확인한다.
8. `user_id + experiment_id` 기준으로 이미 회고를 제출했는지 확인한다.

모든 조건을 통과하고 아직 제출하지 않았다면 `show: true`, `reason: "eligible"`, `submitted: false`를 반환한다.

이미 제출한 사용자도 12기 전체 조사 맥락에서는 배너 영역을 볼 수 있어야 하므로, 제출 완료 상태는 숨김이 아니라 `show: true`, `reason: "already_submitted"`, `submitted: true`로 반환한다. 외부 LVUP 프론트엔드는 이 값을 보고 완료 상태 문구나 비활성 CTA를 표시할 수 있다.

## 5. 노출 대상 응답 예시

```json
{
  "show": true,
  "reason": "eligible",
  "submitted": false,
  "experiment_id": "s12-mid-reflection",
  "banner_id": "s12-mid-reflection-banner",
  "title": "중간 회고 작성하기",
  "description": "지금까지의 여정을 정리하고 남은 기간 방향을 잡아봐요",
  "target_url": "/reflection/s12-mid-reflection",
  "logging_context": {
    "experiment_id": "s12-mid-reflection",
    "banner_id": "s12-mid-reflection-banner",
    "project_id": "PROJECT_ID",
    "project_cohort": "12",
    "user_project_role": "runner",
    "source": "project_detail_home"
  }
}
```

## 6. 제출 완료 응답 예시

이미 제출한 사용자에게도 12기 조사 안내의 일관성을 위해 배너 영역은 노출한다. 단, `submitted: true`와 `reason: "already_submitted"`를 내려 외부 LVUP 프론트엔드가 완료 상태로 렌더링할 수 있게 한다.

```json
{
  "show": true,
  "reason": "already_submitted",
  "submitted": true,
  "experiment_id": "s12-mid-reflection",
  "banner_id": "s12-mid-reflection-banner",
  "title": "중간 회고 작성하기",
  "description": "지금까지의 여정을 정리하고 남은 기간 방향을 잡아봐요",
  "target_url": "/reflection/s12-mid-reflection",
  "logging_context": {
    "experiment_id": "s12-mid-reflection",
    "banner_id": "s12-mid-reflection-banner",
    "project_id": "PROJECT_ID",
    "project_cohort": "12",
    "user_project_role": "runner",
    "source": "project_detail_home"
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

지원하는 reason은 다음과 같다.

- `not_authenticated`
- `not_s12_project`
- `not_project_member`
- `unsupported_role`
- `inactive_membership`
- `outside_reflection_window`
- `already_submitted`
- `experiment_not_found`
- `eligible`

## 8. 실험 플랫폼에서 조정 가능한 값

이번 구현은 배너를 단순 하드코딩하지 않고, 실험 플랫폼에서 조정 가능한 구조로 만들었다.

실험 상태는 기존 `experiments.status`를 사용한다.

- `running`: 노출 가능
- `paused`, `completed`, `archived`: 노출하지 않음

노출 기간은 기존 experiment 필드를 사용한다.

- `experiments.reflection_start_date`
- `experiments.reflection_window_days`

배너 문구와 URL은 새 config 테이블에서 관리한다.

- `project_reflection_banner_config.banner_id`
- `project_reflection_banner_config.title`
- `project_reflection_banner_config.description`
- `project_reflection_banner_config.target_url`
- `project_reflection_banner_config.source`
- `project_reflection_banner_config.enabled`

즉, 실험 상태와 기간은 기존 실험관리 모델로 제어하고, 배너 자체의 문구/링크/활성화는 별도 config로 제어한다.

## 9. 추가된 관리 API

```http
GET /api/v1/project-reflection-banner/config/{experiment_id}
PATCH /api/v1/project-reflection-banner/config/{experiment_id}
```

이 API는 향후 실험 플랫폼 대시보드 프론트엔드의 실험관리 UI에서 배너 문구, 설명, URL, enabled 상태를 수정할 수 있도록 열어둔 백엔드 계약이다.

현재 구현 범위에는 실험 플랫폼 대시보드 프론트엔드의 편집 화면은 포함하지 않았다.

## 10. 사용하는 데이터

운영 raw DB를 직접 보지 않고, 기존 실험 플랫폼 원칙대로 D1 동기화 데이터를 사용한다.

사용 테이블:

- `dl_projects`
  - 프로젝트가 12기인지 확인
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
- `project_reflection_banner_config`
  - 배너 문구, URL, enabled 여부 확인

## 11. 이벤트 로깅

배너가 실제로 노출되거나 클릭되면 기존 이벤트 수집 API를 그대로 사용한다.

```http
POST /api/v1/capture
```

외부 LVUP 프론트엔드가 보내는 이벤트는 다음 두 개다.

- `project_reflection_banner_viewed`
- `project_reflection_banner_clicked`

이벤트 properties에는 다음 값이 들어간다.

- `experiment_id`
- `banner_id`
- `project_id`
- `project_cohort`
- `user_project_role`
- `source`
- `target_url` 클릭 이벤트에만 포함

이 값들은 나중에 “누가 배너를 봤는지”, “누가 클릭했는지”, “어떤 프로젝트에서 유입됐는지”를 분석하기 위한 컨텍스트다.

## 12. 추가된 파일

- `backend/app/api/v1/endpoints/project_reflection_banner.py`
- `backend/app/schemas/project_reflection_banner.py`
- `backend/app/services/project_reflection_banner.py`
- `backend/migrations/011_project_reflection_banner_seed.sql`
- `backend/tests/test_project_reflection_banner.py`

수정된 주요 파일:

- `backend/app/api/v1/api.py`
- `backend/app/core/config.py`
- `backend/.env.sample`
- `backend/tests/conftest.py`

## 13. 테스트 결과

백엔드 전체 테스트를 통과했다.

```text
cd backend && ./venv/bin/pytest
135 passed
```

추가로 whitespace 검사도 통과했다.

```text
git diff --check
```

## 14. 남은 결정 사항

운영 적용 전에 아래 사항을 정해야 한다.

1. 실제 회고 배너 노출 시작일
2. 노출 기간 일수
3. 실험 플랫폼 대시보드 프론트엔드의 실험관리 UI에 배너 config 편집 화면을 붙일지 여부
4. `req.md`를 공식 계약 문서로 남길지 여부

## 15. 팀장 보고용 결론

이번 작업은 외부 LVUP 프론트엔드가 회고 배너 노출 판단을 직접 하지 않고, 실험 플랫폼에 위임할 수 있게 만든 백엔드 계약 작업이다.

외부 LVUP 프론트엔드는 `user_id`, `project_id`만 보내면 되고, 실험 플랫폼은 D1 동기화 데이터와 실험 설정을 기준으로 노출 여부를 판단한다. 또한 배너 문구와 URL은 별도 config로 분리되어 있어, 이후 실험 플랫폼 대시보드 프론트엔드에 실험관리 UI를 붙이면 운영자가 코드 배포 없이 조정할 수 있다.

현재는 백엔드 API와 테스트까지 완료된 상태이며, 실험 플랫폼 대시보드 프론트엔드의 편집 화면은 후속 작업으로 남아 있다.

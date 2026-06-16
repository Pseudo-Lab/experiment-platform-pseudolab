Status: draft
Last-Validated: 2026-06-16
Owner: soo

# 타 서비스 연동을 위한 SDK/API 개발 작업 계획

> 팀 내부 참고용 개발 작업 초안이다. SDK/API v1의 최종 명세가 아니며,
> 12기 회고 운영 방식은 기존 임시 API 계약으로 진행하기로 이미 결정되어 있다.

## 1. 목적

이 문서는 LVUP뿐 아니라 다른 서비스가 실험 플랫폼에 안정적으로 연동될 수 있도록, 실험 플랫폼 쪽 SDK/API에서 필요한 개발 작업을 정리하기 위한 문서다.

현재 12기 회고는 준실험을 위한 임시 API 계약으로 진행하기로 결정되어 있다. 새로 검토할 이슈는 12기 회고 일정과 별도로 SDK 개발을 병행하고, SDK가 이후 반복 실험의 PR 병목을 줄일 수 있는지 확인하는 것이다. 앞으로 일반 A/B 테스트와 feature flag 운영까지 확장하려면, 서비스마다 임시 API를 새로 계약하는 방식이 아니라 공통 SDK/API 계약을 제공해야 한다.

이 문서는 최종 명세가 아니라 개발 작업 정리를 위한 `draft` 문서다. SDK/API 구현 과정에서 세부 endpoint, method 이름, payload schema는 변경될 수 있다.

## 2. 현재 구현 상태

### 2-1. 이미 있는 것

- `packages/sdk` 패키지가 존재한다.
- SDK는 `ExperibaseSDK`, `ExperibaseProvider`, `useDecide`, `useFlag`를 제공한다.
- SDK는 `/api/v1/decide`를 호출해 feature flag 또는 placement 결정을 받는다.
- SDK는 `/api/v1/capture`를 통해 일반 이벤트를 전송한다.
- SDK는 `/api/v1/events`를 통해 experiment impression/conversion 이벤트를 전송한다.
- 백엔드에는 통합 decide endpoint가 있다.
  - `POST /api/v1/decide`
  - feature flag를 먼저 조회하고, 없으면 placement로 fallback한다.

### 2-2. 아직 부족한 것

현재 구현은 PoC 또는 초기 SDK에 가깝다. 외부 서비스 표준 연동으로 쓰려면 다음 문제가 남아 있다.

- `decide` 요청 context가 제한적이다.
  - 현재 SDK는 사실상 `key`, `user_id` 중심이다.
  - `project_id`, `role`, `cohort`, `attributes`, `context` 전달이 안정화되어 있지 않다.
- `decide`와 `expose`가 분리되어 있지 않다.
  - 현재 SDK는 `decide` 직후 impression 이벤트를 자동 전송한다.
  - 실제 화면 노출 기준과 다를 수 있어 A/B 테스트 분석 품질에 영향을 줄 수 있다.
- 응답 schema가 충분하지 않다.
  - `experiment_id`, `reason`, `tracking_context`, `assignment_id`, `payload` schema가 안정적이지 않다.
- `/events`와 `/identify` 인증 정책이 정리되어 있지 않다.
  - `/capture`는 API key 기반 project 식별을 사용한다.
  - `/events`, `/identify`는 현재 인증 없이 열려 있다.
- 이벤트 모델이 분리되어 있다.
  - `/capture`와 `/events`가 각각 다른 테이블/스키마로 동작한다.
  - 분석에서 어떤 이벤트를 표준으로 쓸지 정해야 한다.
- SDK 문서가 현재 구현보다 단순하다.
  - 타 서비스 개발자가 context, exposure, fallback, QA를 이해하기 어렵다.
- 운영용 디버그/QA 기능이 부족하다.
  - 특정 user/key에 대해 왜 control/treatment가 나왔는지 확인하기 어렵다.

## 3. 목표 연동 모델

타 서비스 개발자에게는 SDK를 표준 연동 방식으로 제공한다. REST API는 SDK가 호출하는 하위 계약이자, SDK 설치가 어려운 서비스의 fallback으로 유지한다.

```text
타 서비스:
  SDK 사용
  서비스 UI/라우트/권한 소유

실험 플랫폼:
  API 제공
  SDK 제공
  실험 설정/타겟팅/할당/이벤트/분석 소유
```

SDK/API는 다음 세 동작을 명확히 분리해야 한다.

```text
decide:
  사용자에게 어떤 경험을 줄지 결정한다.

expose:
  사용자가 실제로 실험 UI 또는 variant를 봤음을 기록한다.

track:
  클릭, 제출, 구매, 완료 등 행동 이벤트를 기록한다.
```

## 4. 공통 API 계약 정리 작업

### 4-1. Decide API v1 정리

공통 decide API는 feature flag, A/B test, placement 실험을 모두 다룰 수 있어야 한다.

권장 요청 구조:

```json
{
  "key": "project-detail-home-primary-cta",
  "user_id": "user-123",
  "anonymous_id": null,
  "project_id": "project-456",
  "attributes": {
    "cohort": "12",
    "role": "runner"
  },
  "context": {
    "source": "project_detail_home"
  },
  "exposure_policy": "manual"
}
```

권장 응답 구조:

```json
{
  "key": "project-detail-home-primary-cta",
  "type": "flag",
  "experiment_id": "exp-123",
  "assignment_id": "assign-123",
  "show": true,
  "variant": "treatment",
  "reason": "eligible",
  "payload": {
    "title": "CTA title",
    "target_url": "/target"
  },
  "tracking_context": {
    "experiment_id": "exp-123",
    "key": "project-detail-home-primary-cta",
    "variant": "treatment"
  }
}
```

필요 작업:

- `UnifiedDecideRequest`에 `anonymous_id`, `project_id`, `attributes`, `context`, `exposure_policy`를 추가한다.
- `UnifiedDecideResponse`에 `experiment_id`, `assignment_id`, `reason`, `tracking_context`를 추가한다.
- feature flag와 placement가 같은 응답 구조를 반환하도록 정리한다.
- control/treatment 외 다중 variant를 지원할 수 있게 response를 정리한다.
- decide 실패 시 서비스가 사용할 fallback 규칙을 명확히 한다.

### 4-2. Event API v1 정리

이벤트는 최소한 다음 타입을 안정적으로 지원해야 한다.

```text
exposure
click
conversion
custom
```

필요 작업:

- `/capture`와 `/events`의 역할을 정리한다.
- SDK 표준 이벤트 endpoint를 하나로 통합할지 결정한다.
- 이벤트 schema에 `project_id`, `experiment_id`, `assignment_id`, `key`, `variant`, `event_type`, `event_name`, `properties`, `timestamp`를 안정적으로 포함한다.
- 이벤트 중복 방지 기준을 정한다.
  - 예: 동일 `assignment_id + event_type + dedupe_key`
- conversion attribution 기준을 정한다.
  - 예: user 단위, session 단위, assignment 단위
- API key 인증 적용 범위를 정한다.

### 4-3. Identify/Context API 정리

서비스가 사용자 속성을 실험 플랫폼에 전달하는 방식을 정해야 한다.

필요 작업:

- `identify`를 SDK 표준 기능으로 유지할지 결정한다.
- 사용자 속성은 매 decide 요청에 함께 보낼지, 별도 identify로 저장할지 결정한다.
- 민감정보 전달 금지 기준을 문서화한다.
- `user_id`, `anonymous_id` 병합 정책을 정한다.
- 프로젝트/조직/코호트 같은 context를 어떤 필드에 담을지 정한다.

## 5. SDK 개발 작업

### 5-1. Core SDK

필요한 공개 method:

```ts
sdk.identify(userId, attributes)
sdk.decide(key, context)
sdk.expose(decision, properties)
sdk.track(eventName, properties)
```

필요 작업:

- `decide` options를 `userId` 단일 옵션에서 context 객체로 확장한다.
- `decide` 직후 자동 impression 전송을 제거하거나 option으로 만든다.
- `expose` method를 추가한다.
- `track`이 `decision` 또는 `tracking_context`를 받아 전환 attribution을 남기도록 개선한다.
- API 실패 시 fallback 동작을 설정할 수 있게 한다.
  - 예: `failClosed`, `defaultVariant`, `timeoutMs`
- SDK request에 API key를 일관되게 붙인다.
- SDK response type을 백엔드 schema와 맞춘다.

### 5-2. React SDK

필요한 hook/component:

```ts
useDecide(key, context)
useFlag(key, context)
useExperimentSlot(slotKey, context)
```

필요 작업:

- `ExperibaseProvider`에서 공통 user/context를 받을 수 있게 한다.
- `useDecide`가 context 변경을 안전하게 처리하도록 한다.
- `useExperimentSlot`을 추가할지 결정한다.
- 노출 이벤트를 실제 렌더링 또는 viewport 기준으로 보낼 수 있게 한다.
- loading/error/fallback 상태를 명확히 제공한다.
- SSR 또는 hydration 환경에서 깨지지 않게 한다.

### 5-3. 타입과 패키징

필요 작업:

- public type을 정리한다.
  - `Decision`
  - `DecisionContext`
  - `ExposureEvent`
  - `TrackEvent`
  - `ExperimentPayload`
- SDK README와 실제 type이 일치하도록 관리한다.
- npm package export를 점검한다.
- browser 환경에서 `crypto`, `localStorage`, `sessionStorage` fallback을 점검한다.

## 6. 백엔드 개발 작업

### 6-1. Assignment/Decision 저장

실험 결과 분석을 위해 decide 결과를 안정적으로 추적해야 한다.

필요 작업:

- assignment 저장 정책을 정한다.
  - decide 시 저장할지
  - expose 시 저장할지
  - 둘 다 저장하되 event_type으로 구분할지
- sticky assignment를 보장한다.
  - 같은 user/key는 같은 variant를 받아야 한다.
- assignment_id를 응답에 포함한다.
- 실험 상태 변경 시 기존 assignment 처리 정책을 정한다.

### 6-2. Targeting/Segment 연동

필요 작업:

- decide API가 segment rule과 user attributes를 함께 평가하도록 정리한다.
- cohort/role/project 조건을 placement 전용이 아니라 공통 targeting으로 일반화한다.
- target miss reason을 response에 안정적으로 포함한다.
- 관리자 UI에서 targeting rule을 확인할 수 있게 한다.

### 6-3. API Key와 Project Boundary

필요 작업:

- 모든 SDK 호출 endpoint의 API key 요구 여부를 정리한다.
- API key로 project boundary가 보장되는지 점검한다.
- key별 허용 origin 또는 allowed service를 둘지 검토한다.
- 운영/개발 key 구분을 문서화한다.

### 6-4. Observability

필요 작업:

- decide/capture/event 실패율을 확인할 수 있게 한다.
- key별 traffic, exposure, conversion을 모니터링한다.
- SRM 또는 split mismatch를 감지할 수 있게 한다.
- API latency와 timeout 기준을 정한다.

## 7. 프론트엔드 관리 UI 작업

타 서비스 연동을 운영하려면 실험 플랫폼 UI에서도 계약을 이해하기 쉽게 보여줘야 한다.

필요 작업:

- 실험 상세에서 SDK/API 연동 정보를 보여준다.
- key, experiment_id, payload schema, tracking_context를 복사하기 쉽게 제공한다.
- event contract를 실험별로 확인할 수 있게 한다.
- placement/slot과 feature flag의 차이를 더 명확히 보여준다.
- QA용 decide preview를 제공한다.
  - user_id, project_id, attributes를 넣고 예상 response 확인
- 이벤트 수집 상태를 보여준다.
  - exposure count
  - click/conversion count
  - 최근 이벤트

## 8. 문서화 작업

타 서비스 개발자가 참고할 문서를 별도로 준비해야 한다.

필요 문서:

- SDK quick start
- REST API fallback guide
- React integration guide
- ExperimentSlot integration guide
- Event tracking guide
- exposure 기준 설명
- API key 발급/관리 가이드
- QA checklist
- privacy/data handling guide

주의할 점:

- 현재 SDK/API는 아직 evolving 상태이므로, 외부 서비스에 전달하는 문서에는 `draft` 또는 `v0` 표기를 사용한다.
- 최종 v1 계약이 확정되기 전에는 endpoint/method 이름을 확정된 것처럼 전달하지 않는다.

## 9. 우선순위 제안

### P0. 계약 안정화

- Decide API request/response v1 확정
- Event API v1 확정
- API key 인증 범위 확정
- decide와 expose 분리
- SDK type과 백엔드 schema 정합성 확보

### P1. SDK 사용성 개선

- Core SDK `decide/expose/track` 정리
- React hook 정리
- context/fallback/timeout 지원
- README와 예제 업데이트
- SDK 패키징/빌드 검증

### P2. 운영/QA

- decide preview UI
- 이벤트 수집 모니터링
- 실험별 event contract 표시
- QA checklist 문서화

### P3. 확장

- 다중 variant
- advanced targeting
- SRM 감지
- warehouse/export 연동
- 서버사이드 SDK

## 10. LVUP과의 관계

12기 회고는 기존 준실험 임시 API 계약으로 진행하기로 결정되어 있다. 다만 SDK 개발은 병행하며, SDK가 PR 병목을 줄일 수 있는지와 12기 회고에 적용 가능한지는 별도 검토 이슈로 관리한다.

다음 신규 A/B 테스트부터는 이 문서의 SDK/API v1 방향을 기준으로 LVUP과 다시 계약하는 것이 좋다.

LVUP에 지금 전달할 수 있는 것은 최종 구현 명세가 아니라 다음 정도다.

- 실험 플랫폼은 SDK/API 표준 계약을 준비 중이다.
- 12기 회고는 기존 API 계약으로 진행한다.
- SDK 개발은 별도 트랙으로 병행한다.
- LVUP은 서비스 UI와 slot을 소유한다.
- 반복 실험을 위해 LVUP에 공통 ExperimentSlot 구조가 필요할 수 있다.
- SDK/API v1이 확정되면 LVUP 연동 가이드를 별도로 전달한다.

## 11. 다음 액션

개발 팀원에게 넘길 수 있는 작업 단위는 다음이다.

1. 현재 SDK/API 구현과 이 문서의 목표 계약 차이를 점검한다.
2. Decide API v1 request/response 초안을 코드 기준으로 정리한다.
3. Event API v1 endpoint와 schema를 결정한다.
4. SDK core의 `decide/expose/track` 공개 계약을 정리한다.
5. React SDK hook 계약을 정리한다.
6. 백엔드 schema, SDK type, README를 같은 계약으로 맞춘다.
7. 최소 통합 테스트를 추가한다.
8. LVUP 같은 타 서비스에 전달할 v1 연동 가이드를 작성한다.

이 문서는 개발이 진행되면서 업데이트되어야 한다. v1 계약이 확정되면 `draft`에서 `active`로 전환한다.

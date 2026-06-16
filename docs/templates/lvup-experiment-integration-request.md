Status: draft
Last-Validated: 2026-06-16

# LVUP Experiment Integration Request Template Draft

> 팀 내부 참고용 요청서 초안이다. LVUP 담당자와 공식 조율이 완료된 템플릿이 아니며,
> 실제 공유 전에는 SDK/API 계약, payload, 이벤트, 개인정보/정책 항목을 다시 확인한다.

이 템플릿은 실험 플랫폼에서 LVUP 시스템과 연동되는 실험을 요청할 때 사용한다.

목적은 LVUP 리뷰어가 다음을 빠르게 판단할 수 있게 하는 것이다.

- LVUP 코드 변경이 필요한지
- 어떤 화면과 슬롯에 영향이 있는지
- 서비스 UI, 라우트, 개인정보, 권한에 영향이 있는지
- SDK/API, payload, 이벤트 계약이 명확한지
- QA와 롤백이 가능한지

## 1. 요청 요약

- 요청일:
- 요청자:
- 실험 플랫폼 담당자:
- LVUP 담당자:
- 목표 시작일:
- 목표 종료일:
- 관련 문서:
- 관련 PR:
- 운영 환경:

### 한 줄 결론

```text
예: 기존 project-detail-home-primary-cta 슬롯의 문구와 target_url만 변경하는 실험이므로 LVUP 코드 변경 없이 실험 플랫폼 설정만으로 진행 가능합니다.
```

## 2. 실험 개요

- 실험 이름:
- 실험 키:
- 실험 유형: A/B test / feature flag / 준실험 / 기타
- 가설:
- 대상 사용자:
- Primary metric:
- Guardrail metric:
- 성공 기준:
- 실험에서 제외할 사용자:

## 3. LVUP 영향도

아래 표에서 해당하는 최고 영향도 레벨을 선택한다.

| 레벨 | 변경 유형 | 해당 여부 | 근거 |
|---|---|---|---|
| Level 0 | 분석 이벤트만 추가 |  |  |
| Level 1 | 기존 슬롯의 문구/링크/payload 변경 |  |  |
| Level 2 | 기존 슬롯의 허용 UI 타입 변경 |  |  |
| Level 3 | 새 화면 위치에 슬롯 추가 |  |  |
| Level 4 | 새 기능/새 라우트/새 플로우 추가 |  |  |
| Level 5 | 개인정보/권한/알림/평가 영향 |  |  |

### 분석가 판정 메모

- 선택한 최고 영향도 레벨:
- 선택 근거:
- 영향 화면:
- slot_key:
- route:
- 사용되는 user/context 속성:
- 이벤트 영향: exposure / click / conversion / custom / 없음
- 개인정보/정책 영향: 있음 / 없음 / 확인 필요
- LVUP 담당자 확인 질문:

판정 기준:

- 해당되는 가장 높은 레벨을 선택한다.
- 영향도 레벨과 PR 필요 여부는 별도로 적는다.
- SDK/API 사용 여부가 아니라 실제 화면, 라우트, 권한, 개인정보, 이벤트 위치 기준으로 판정한다.
- 확신이 없으면 `확인 필요`로 두고 LVUP 담당자에게 확인할 질문을 남긴다.

### LVUP PR 필요 여부

- LVUP PR 필요 여부: 필요 / 불필요 / 확인 필요
- 필요한 이유:
- 불필요한 이유:
- PR 없을 때 가능한 롤백 방법:

## 4. 책임 경계

### 실험 플랫폼이 담당

- 실험 생성/상태 관리:
- 타겟팅/세그먼트 판단:
- variant 또는 payload 결정:
- 노출/클릭/전환 이벤트 수집:
- 실험 결과 분석:

### LVUP이 담당

- 실제 UI 컴포넌트:
- 화면 위치와 레이아웃:
- 라우트와 사용자 플로우:
- 로그인/권한/사용자 식별:
- 개인정보/동의/서비스 정책 문구:
- 운영 배포:

## 5. 슬롯 계약

기존 슬롯을 사용하면 현재 계약을 적고, 새 슬롯이 필요하면 제안 계약을 적는다.

- slot_key:
- LVUP page:
- 화면 위치:
- owner:
- default_behavior: hide / show default UI / other
- allowed_ui_types:
- allowed_payload:
- required_context:
- rollout 가능 여부:
- 비대상 사용자 동작:

### 화면 영향 설명

```text
예: 프로젝트 상세 홈 상단 CTA 영역에만 영향을 주며, 기존 프로젝트 목록/상세 탭/회고 페이지 라우트에는 영향을 주지 않습니다.
```

## 6. SDK/API 계약

### Decide

- 사용 방식: SDK / REST API / 임시 API 계약
- endpoint 또는 SDK method:
- 요청 시점:
- required params:
- optional params:
- timeout/fallback:

```json
{
  "key": "",
  "user_id": "",
  "project_id": "",
  "attributes": {},
  "context": {}
}
```

### Response

```json
{
  "key": "",
  "experiment_id": "",
  "show": true,
  "variant": "",
  "reason": "",
  "payload": {},
  "tracking_context": {}
}
```

### Payload Schema

| 필드 | 타입 | 필수 | 소유자 | 설명 |
|---|---|---:|---|---|
| title | string |  | LVUP render |  |
| description | string |  | LVUP render |  |
| target_url | string |  | LVUP route |  |
| cta_label | string |  | LVUP render |  |

## 7. 이벤트 계약

### Exposure

- 이벤트 이름:
- 전송 주체: LVUP / SDK auto / 실험 플랫폼
- 전송 기준: decide 직후 / 실제 렌더링 / viewport 노출 / 기타
- 중복 방지 기준:

### Click

- 이벤트 이름:
- 전송 조건:
- 중복 방지 기준:

### Conversion

- 이벤트 이름:
- 전송 조건:
- conversion attribution 기준:

### Event Properties

```json
{
  "experiment_id": "",
  "slot_key": "",
  "variant": "",
  "user_id": "",
  "project_id": "",
  "source": ""
}
```

## 8. 타겟팅과 제외 조건

- cohort:
- role:
- membership:
- project status:
- user status:
- 제외 조건:
- 이미 완료한 사용자 처리:
- 비대상 사용자 reason:

### 책임 위치

| 조건 | 판단 위치 | 비고 |
|---|---|---|
| cohort | 실험 플랫폼 / LVUP |  |
| role | 실험 플랫폼 / LVUP |  |
| membership | 실험 플랫폼 / LVUP |  |
| completed | 실험 플랫폼 / LVUP |  |

## 9. 개인정보/정책 영향

- user_id 전달 여부:
- project_id 전달 여부:
- 민감정보 포함 여부:
- 별도 고지/동의 필요 여부:
- 보관 기간:
- 접근 권한:
- 삭제 요청 처리 기준:
- LVUP 화면 문구 변경 필요 여부:

## 10. QA 체크리스트

- [ ] 대상 사용자는 `show=true`를 받는다.
- [ ] 비대상 사용자는 `show=false`를 받는다.
- [ ] payload가 LVUP UI에 예상대로 렌더링된다.
- [ ] target_url 이동이 정상 동작한다.
- [ ] exposure 이벤트가 의도한 기준으로 1회 기록된다.
- [ ] click 이벤트가 중복 없이 기록된다.
- [ ] conversion 이벤트가 중복 없이 기록된다.
- [ ] 실험을 paused/draft로 바꾸면 UI가 숨겨진다.
- [ ] API/SDK 실패 시 사용자 경험이 깨지지 않는다.
- [ ] 개인정보/동의 문구가 필요한 경우 반영되어 있다.

## 11. 배포와 롤백

- LVUP 배포 필요 여부:
- 실험 플랫폼 설정 필요 여부:
- 배포 순서:
- 실험 시작 조건:
- 실험 중단 조건:
- 롤백 방법:
- 운영 확인 URL:

## 12. LVUP 리뷰 요청 사항

LVUP 리뷰어가 확인해야 하는 항목만 구체적으로 적는다.

- [ ] 화면 위치와 UI 영향도 확인
- [ ] slot_key와 payload schema 확인
- [ ] 이벤트 전송 위치 확인
- [ ] 라우트/권한/로그인 영향 확인
- [ ] 개인정보/정책 문구 확인
- [ ] 배포 가능 일정 확인

### 질문

1.
2.
3.

## 13. 검토 기록

- 검토일:
- 검토자:
- 검토 내용:
- 남은 이슈:
- 후속 작업:

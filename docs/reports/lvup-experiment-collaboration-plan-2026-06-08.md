Status: draft
Last-Validated: 2026-06-16
Owner: soo

# LVUP 협업 및 실험 연동 운영 방안 초안

> 팀 내부 참고용 초안이다. LVUP 담당자와 공식 조율이 완료된 기준 문서가 아니며,
> 팀원이 협업 방향, 영향도 기준, SDK 병행 검토 포인트를 맞춰보기 위한 자료다.

## TL;DR

- 현재 이슈: LVUP PR 리뷰 지연으로 인한 12기 회고 실험 일정 지연
- 핵심 원인: PR 지연 자체보다, 실험마다 LVUP 서비스 코드 변경이 필요한 구조
- 12기 회고: 기존 준실험 임시 API 계약으로 진행 확정
- 새 검토 이슈: 12기 회고 일정과 별도로 SDK 개발을 병행하고, SDK가 PR 병목을 줄일 수 있는지 검토
- 신규 A/B 테스트: SDK v1 완성 이후 SDK + 사전 합의된 실험 슬롯 기반 전환
  - 실험 슬롯: LVUP 화면 안에서 실험용으로 미리 할당한 UI 영역
- 책임 경계
  - 가짜연구소(LVUP) : UI/라우트/배포 소유
  - 실험 플랫폼 : 결정/타겟팅/이벤트/분석 소유
- 운영 방식:
  - LVUP 실험 슬롯의 문구/링크/payload 변경: 실험 플랫폼 설정으로 처리
  - LVUP 실험 슬롯의 새 UI 타입: LVUP에 사전 구현된 타입만 설정으로 처리
  - 새 화면 위치/새 기능/개인정보·권한 영향: LVUP PR과 사전 검토 필요
  - 실험 시작일: LVUP PR 필요 여부와 리뷰 lead time 확인 후 확정
- 이번 주 내부 정리:
  - LVUP에 제안할 책임 경계: 실험 플랫폼 decision/payload/event, LVUP UI/route/deploy
  - 결정된 사항: 12기 회고는 기존 API 계약으로 진행
  - 새 검토 이슈: SDK 개발 병행, SDK 적용 가능성, 신규 A/B 테스트의 SDK 표준화
  - 슬롯 전략: 우선 구성할 LVUP 슬롯 목록과 payload 허용 범위
  - 이벤트 기준: decide 자동 기록 또는 실제 viewport/expose 기준
  - 리뷰 방식: LVUP 실험 연동 요청 템플릿 사용 권장 기준
  - 조율 범위: LVUP에 공유할 제안안과 요청사항

## 1. 문서 목적

- 목적: LVUP 같은 외부 서비스와 실험 플랫폼의 안정적 협업 방식 정리
- 배경: 12기 회고 연동 과정의 LVUP PR 리뷰 지연
- 문제 인식: 서비스 코드 변경 의존도가 높은 실험 운영 구조
- 목표: 반복 실험의 PR 병목 감소와 검토 기준 표준화

## 2. 현재 상황

### 2-1. 12기 회고 연동

- 성격: 정식 A/B 테스트 SDK 계약 전 단계의 과도기 준실험 임시 API 계약
- LVUP 역할: 프로젝트 상세 홈 UI 렌더링, viewed/clicked/submitted 이벤트 전송
- 실험 플랫폼 역할: active experiment, cohort, membership, role, 노출 기간, 완료 여부 판단
- 판단: 12기 회고 운영 방식은 기존 API 계약으로 진행하기로 결정됨
- 새 이슈: SDK 개발은 병행하며, SDK가 PR 병목을 줄일 수 있는지와 12기 회고에 적용 가능한지는 별도로 검토

### 2-2. 병목 구조

```text
실험 아이디어
  -> LVUP UI/라우트/이벤트 코드 변경
  -> LVUP PR 작성
  -> LVUP 관리자 리뷰
  -> 머지/배포
  -> 실험 플랫폼 설정
  -> QA
  -> 실험 시작
```

- 제약: LVUP은 별도 repo와 별도 관리자 소유
- 영향: 서비스 코드 변경이 필요한 실험은 LVUP PR 리뷰 일정에 종속
- 개선 방향: LVUP 실험 슬롯 안의 실험은 실험 플랫폼 설정으로 반복 운영

## 3. 책임 경계

| 영역 | 실험 플랫폼 | LVUP |
|---|---|---|
| 실험 상태/기간/rollout | 소유 | 참고 |
| 타겟팅/variant 결정 | 소유 | context 제공 |
| SDK/API 계약 | 소유 | 연동 |
| UI 컴포넌트/레이아웃 | payload 제공 | 소유 |
| 라우트/사용자 플로우 | 참고값 제공 | 소유 |
| 인증/권한/사용자 식별 | 전달값 사용 | 소유 |
| 노출/클릭/전환 이벤트 | 수집/분석 | 실제 발생 시점 전송 |
| 개인정보/동의 문구 | 요구사항 정리 | 화면 반영 |
| 배포/롤백 | 실험 상태 제어 | 서비스 배포 |

운영 원칙:

- 실험 플랫폼의 LVUP UI 임의 변경 지양
- LVUP이 허용한 슬롯과 payload 범위 안에서만 실험 설정 변경
- 새 위치, 새 기능, 개인정보/권한 영향은 LVUP PR과 사전 검토 필요

## 4. UI 영향도 기준

| 레벨 | 변경 유형 | 예시 | LVUP PR |
|---|---|---|---|
| Level 0 | 분석 이벤트만 추가 | 페이지 진입, 클릭 이벤트 | 필요할 수 있음 |
| Level 1 | LVUP 실험 슬롯 payload 변경 | title, description, target_url | 불필요 |
| Level 2 | LVUP 실험 슬롯 UI 타입 변경 | banner, card, cta | 사전 구현 시 불필요 |
| Level 3 | 새 화면 위치에 슬롯 추가 | 사이드바 CTA | 필요 |
| Level 4 | 새 기능/새 라우트 | 설문 페이지, 온보딩 플로우 | 필요 |
| Level 5 | 개인정보/권한/알림 영향 | 개인정보 수집, 권한 분기 | 필요 + 정책 검토 |

핵심 구분:

- LVUP 실험 슬롯 안의 payload 변경: 실험 플랫폼 설정 중심
- 서비스 화면 구조 변경: LVUP PR 필요

### 4-1. 분석가용 영향도 판정 가이드

이 기준은 Experiment Analyst 또는 실험 기획자가 LVUP 적용 영향도를 먼저 분류할 때 참고한다. 최종 PR 필요 여부와 배포 일정은 LVUP 담당자와 다시 확인한다.

판정 원칙:

- 해당되는 가장 높은 레벨을 선택한다.
- 영향도 레벨과 PR 필요 여부는 분리해서 판단한다.
- SDK/API 사용 여부 자체가 레벨을 낮추지는 않는다. 사용자가 보는 화면, 라우트, 권한, 개인정보, 이벤트 위치가 실제 판단 기준이다.
- 확신이 없으면 `확인 필요`로 표시하고 LVUP 담당자에게 물어볼 질문을 남긴다.
- 12기 회고는 기존 임시 API 계약으로 진행하기로 결정되어 있으며, SDK 병행은 별도 검토 이슈로 다룬다.

레벨별 확인 포인트:

| 레벨 | 분석가가 확인할 것 | 판정 예시 |
|---|---|---|
| Level 0 | 화면 변화 없이 이벤트만 추가되는지, 이벤트 위치가 이미 존재하는지, event name/properties가 분석 목적에 맞는지 | 페이지 진입 이벤트, CTA 클릭 로그 추가 |
| Level 1 | 기존 슬롯 안에서 허용된 payload 필드만 바뀌는지, target_url이 기존 라우트인지, 기본 UI/fallback이 유지되는지 | 기존 CTA의 title, description, cta_label, target_url 변경 |
| Level 2 | 기존 슬롯에 이미 구현된 UI 타입인지, 새 컴포넌트 개발 없이 type 설정만으로 가능한지 | banner/card/cta 중 사전 합의된 타입 선택 |
| Level 3 | 새 화면 위치나 새 slot_key가 필요한지, 노출 기준과 fallback UI가 정의되는지 | 프로젝트 사이드바에 새 실험 슬롯 추가 |
| Level 4 | 새 라우트, 새 플로우, 새 폼, 새 제출 동작이 생기는지, 사용자 권한/상태 변화가 있는지 | 설문 페이지, 온보딩 플로우, 새 제출 화면 |
| Level 5 | 개인정보, 민감정보, 알림, 권한, 평가/수료 판단에 영향이 있는지, 별도 고지/동의/삭제 요청 처리가 필요한지 | 개인정보 수집, 알림 발송, 권한 분기, 평가 반영 |

분석가 산출물:

- 선택한 최고 영향도 레벨과 근거
- LVUP PR 필요 여부: 필요 / 불필요 / 확인 필요
- 영향 화면, slot_key, route
- 필요한 user/context 속성
- exposure/click/conversion 이벤트 기준
- 개인정보/정책 영향 여부
- QA와 rollback 기준
- LVUP 담당자에게 확인할 질문

## 5. 권장 연동 구조

### 5-1. 12기 회고

- 기존 준실험 임시 API 계약으로 진행 확정
- SDK 개발은 별도 트랙으로 병행
- SDK 구현/QA가 PR 병목을 줄이고 운영 리스크가 낮은지는 별도 이슈로 검토
- SDK를 12기 회고에 적용하는 경우에도 fallback은 기존 임시 API 계약으로 유지

### 5-2. 신규 A/B 테스트

- SDK 표준 연동 권장
- API는 SDK의 하위 계약 및 fallback으로 유지
- 현재 SDK/API v1 계약은 미완성 상태
- SDK/API v1 확정 전 endpoint, payload schema, event contract 최종 확정 보류
- 상세 개발 작업: [타 서비스 SDK/API 연동 개발 작업 계획](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/blob/main/docs/reports/sdk-api-external-service-integration-work-plan-2026-06-08.md)

필요한 SDK 기본 동작:

```text
decide:
  어떤 경험을 줄지 결정

expose:
  실제 화면 노출 기록

track:
  클릭/제출/구매 등 행동 이벤트 기록
```

중요 원칙:

- `decide` 호출과 실제 노출의 분리
- 실제 렌더링 또는 viewport 노출 기준의 exposure 기록
- `tracking_context` 기반 click/conversion 연결

## 6. LVUP 실험 슬롯 전략

- 정의: LVUP 화면 안에서 실험용으로 미리 할당한 UI 영역
- 기술적 의미: LVUP 프론트가 소유한 특정 화면 위치에, 실험 플랫폼이 내려주는 결정값과 payload를 받아 렌더링할 수 있도록 미리 만들어둔 실험 연동 지점
- 목적: 반복 실험을 위한 LVUP 사전 합의 슬롯 구성

예시 슬롯:

```text
project-detail-home-primary-cta
project-detail-home-secondary-banner
project-sidebar-notice
study-list-inline-card
onboarding-header-cta
```

슬롯별 계약 항목:

- `slot_key`
- LVUP page와 화면 위치
- 허용 UI 타입
- 허용 payload
- required context
- 기본 동작
- exposure/click/conversion 이벤트 기준
- 롤백 방식

기대 효과:

- 반복 실험의 LVUP 코드 변경 감소
- LVUP 리뷰 범위 축소
- 실험 플랫폼 설정 기반 실험 운영 가능

## 7. 운영 프로세스

### 7-1. 실험 시작 전

- 실험 목적과 가설 정리
- 대상 사용자와 제외 조건 정리
- primary metric과 guardrail metric 정리
- LVUP 실험 슬롯 사용 가능 여부 확인
- LVUP PR 필요 여부 판단
- 개인정보/권한/동의 영향 확인
- LVUP 리뷰 요청 템플릿 작성

리뷰 요청 템플릿:

- [LVUP 실험 연동 요청 템플릿](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/blob/main/docs/templates/lvup-experiment-integration-request.md)

### 7-2. QA

- SDK/API 호출 성공 여부
- 비대상 사용자 `show=false` 처리
- 대상 사용자 payload 렌더링
- exposure/view 이벤트 기록
- click/conversion 이벤트 기록
- paused/draft 상태 전환 시 롤백
- 개인정보/동의 문구 반영

### 7-3. 리뷰 lead time

| 실험 유형 | LVUP PR | 권장 lead time |
|---|---|---:|
| LVUP 실험 슬롯 설정 변경 | 없음 | 1~2일 |
| LVUP 실험 슬롯의 새 payload 필드 | 필요할 수 있음 | 3~5일 |
| 새 슬롯 추가 | 필요 | 1~2주 |
| 새 화면/새 기능 | 필요 | 2주 이상 |
| 개인정보/권한 영향 | 필요 | 별도 산정 |

## 8. 이번 주 내부 정리 항목

이미 정한 사항:

- 12기 회고는 기존 준실험 임시 API 계약으로 진행
- 신규 A/B 테스트는 SDK v1 완성 이후 SDK 표준 연동으로 전환
- 실험별 LVUP 리뷰 요청 템플릿 사용 권장

새 검토 이슈:

- 12기 회고 일정과 별도로 SDK 개발을 병행
- SDK가 PR 병목을 줄일 수 있는지 검토
- SDK를 12기 회고에 적용할 수 있는지는 개발/QA 일정, fallback, LVUP 변경량을 기준으로 별도 판단

SDK 완료 전 지금 정리할 항목:

1. LVUP에 제안할 책임 경계 기준
   - 산출물: 실험 플랫폼 decision/payload/event, LVUP UI/route/deploy 책임 경계 문구
2. 우선 구성할 LVUP 실험 슬롯 목록
   - 산출물: 반복 실험 가능성이 높은 LVUP 화면 위치 후보
3. LVUP PR 필요 실험의 최소 lead time
   - 산출물: 실험 유형별 리뷰/배포 소요 기준
4. SDK 병행 개발 및 12기 회고 적용 가능성 판단 기준
   - 산출물: SDK 구현 완료 조건, QA 체크, fallback 기준, LVUP 변경량과 일정 비교
   - 체크리스트:
     - 기존 API와 동일한 decide 결과를 낼 수 있는가
     - viewed/clicked/submitted 이벤트가 누락 없이 기록되는가
     - SDK 실패 시 기존 API 또는 UI hide fallback이 가능한가
     - LVUP 쪽 변경량이 기존 PR보다 줄어드는가
     - SDK 적용이 12기 회고 일정을 지연시키지 않는가
5. LVUP에 공유할 조율안과 요청사항 범위
   - 산출물: LVUP에 전달할 실험 슬롯 후보, 책임 경계 초안, 리뷰 요청 템플릿 초안
6. LVUP 리뷰 요청 템플릿 기본 구조
   - 산출물: 영향도 레벨, 슬롯 키, QA/롤백 기준 중심의 임시 구조

SDK v1 이후 최종 확정할 항목:

1. 슬롯별 허용 payload와 UI 타입 범위
   - 산출물: SDK/API v1 응답 구조에 맞춘 payload schema
2. 노출 이벤트 기준과 구현 방식
   - 권장: 실제 렌더링 또는 viewport 노출 기준의 `expose` 기록
3. LVUP 리뷰 요청 템플릿 주요 입력 항목
   - 산출물: SDK/API v1 필드 기준의 최종 템플릿

권장 방향:

```text
12기 회고:
  기존 준실험 API 계약으로 진행
  SDK 개발은 병행
  SDK의 12기 회고 적용 가능성은 별도 검토 이슈로 관리

신규 A/B 테스트:
  SDK 표준 연동
  decide / expose / track 계약 사용

LVUP 협업:
  서비스 UI와 slot은 LVUP 소유
  실험 플랫폼은 승인된 slot의 decision/payload/event 설정
  실험별 LVUP 리뷰 요청 템플릿 사용 권장
```

## 9. 후속 작업

### 실험 플랫폼

- SDK v1 계약 정리: `decide`, `expose`, `track`
- SDK 병행 개발 범위와 12기 회고 적용 가능성 검토: 구현 완료 조건, QA, fallback, LVUP 변경량과 일정 비교
- 공통 decide 응답 정리: `experiment_id`, `payload`, `tracking_context`
- 실험 관리 UI의 slot/payload/variant 계약 표시
- 실험 상세 화면의 exposure/conversion 모니터링 정리
- SDK/API 개발 작업 계획 관리: [타 서비스 SDK/API 연동 개발 작업 계획](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/blob/main/docs/reports/sdk-api-external-service-integration-work-plan-2026-06-08.md)

### LVUP 요청/조율

- SDK 도입 시점 검토 요청
- 자주 실험할 화면의 slot 후보 제안
- 공통 `ExperimentSlot` 또는 equivalent wrapper 구성 가능성 확인
- slot별 UI 타입과 payload schema 조율
- exposure/click/conversion 이벤트 전송 위치 조율

### 내부 확정 후 LVUP 조율

- PR 필요 여부 판단표 내부 정리
- LVUP 실험 연동 요청 템플릿 주요 항목 보완 후 공유
- 신규 실험 brief 템플릿 작성
- 실험 종료 후 readout에 노출 품질, PR/배포 병목, 이벤트 누락 여부 기록

## 10. 최종 정리

- 현재 지연 원인: LVUP PR 리뷰 지연 + 서비스 코드 변경 의존 구조
- 단기 방향: 12기 회고는 기존 임시 API 계약으로 진행하고, SDK 개발은 별도 트랙으로 병행
- 중기 방향: 신규 A/B 테스트부터 SDK와 안정 슬롯 기반 운영
- 최종 목표: 반복 실험은 실험 플랫폼 설정 중심, 새 위치/새 기능은 LVUP PR 중심

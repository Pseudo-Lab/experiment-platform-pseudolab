Status: active
Last-Validated: 2026-11-15

# 실험 플랫폼 핵심 개념

Iterglow는 연동 서비스가 사용자에게 서로 다른 경험을 제공하고 이후 행동을 비교하도록 돕는 범용 실험 플랫폼입니다. 사용자 속성·행동 이벤트·목표 지표는 연동 서비스에서 정의합니다.

## 예: 결제 버튼 변경

기존 버튼을 control, 새 버튼을 treatment로 두고 구매 완료를 목표 지표로 선택합니다. 플랫폼이 결정한 variant를 서비스 화면에 적용한 뒤, 실제로 보인 시점과 구매 행동을 각각 기록합니다. 결과는 variant별 사용자 수·전환율 등으로 비교합니다.

```text
프로젝트·실험 설정 → decide → variant 렌더링 → expose → track → 결과 확인
```

## 구성 요소

| 개념 | 역할 |
| --- | --- |
| Project | 연동 서비스의 실험·키·접근 권한 관리 단위 |
| Experiment | 가설·변형·지표·기간·결과를 묶는 비교 단위 |
| Feature Flag | 코드 배포와 독립적으로 기능 노출·variant를 제어하는 설정 |
| Variant | control·treatment 등 사용자에게 제공할 버전 |
| Segment | 타기팅할 사용자 그룹. 기존 manual·allowlisted query 유형 지원 |
| Rule | 특정 segment·rollout 조건에 variant를 연결하는 규칙 |
| Exposure | 화면에서 실제 경험이 제공됐을 때 기록하는 관측 |
| Metric | 구매 완료 등 실험에서 비교할 목표 지표 |
| Guardrail | 목표 지표 외에 악화 여부를 함께 확인할 보호 지표 |

세그먼트 타기팅은 실험 대상 선정이고 세그먼트별 결과 분석은 결과를 그룹별로 비교하는 기능입니다. 후자는 [#23](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/issues/23)의 후속 범위입니다. 서비스별 기수·요금제·역할 등을 플랫폼 고정 분류로 사용하지 않습니다.

## 판단과 실제 노출의 구분

SDK v1의 기본 `decide()`는 variant 판단이며 실제 화면 노출을 자동으로 뜻하지 않습니다. 서비스가 실제 노출 시 `expose()`를 호출하고 행동 발생 시 같은 decision의 tracking context로 `track()`을 호출합니다. `autoExpose`는 명시적 이행 옵션이며 viewport 노출 증명이 아닙니다.

| 식별자 | 의미 |
| --- | --- |
| `assignment_id` | 배정 관련 정보. 노출·방문 자체의 ID와 구분 |
| `session_id` | 방문·탭 세션 식별 |
| `impression_id` | 하나의 실제 노출과 해당 행동의 연결 |
| `event_id` | 한 전송 이벤트의 중복 방지 키 |

호출 형태와 재시도·legacy 계약은 [SDK 가이드](../../packages/sdk/README.md)가 기준입니다. 기존 feature flag 평가 로그와 SDK v1의 실제 노출·행동 집계는 동일한 개념으로 간주하지 않습니다.

## 결과 해석

- 전체 이벤트 건수와 고유 사용자 수의 구분. 반복 노출을 독립 사용자로 계산 금지.
- SRM: 의도한 배정 비율과 관측 비율의 불일치 경고. 배정·수집 문제 확인에 사용.
- 가드레일: 목표 지표가 개선돼도 다른 지표 악화 여부 확인.
- 준실험과 무작위 A/B 실험의 구분. 단순 참여·전환 퍼널만으로 인과 효과 판단 금지.
- 진행 중 지표와 확정 결과의 구분. 전환 창·수신 유예·결과 확정은 해당 실험의 측정 계약과 정책 확인.

## 설치와 접근 경계

자신의 D1에 프로젝트·실험·이벤트를 저장하며, 첨부파일은 자신의 R2를 사용합니다. 기존 query segment는 별도 소스 DB와 template의 테이블 계약이 필요합니다. 임의 외부 DB 연결이나 범용 사용자 속성 분석이 자동 제공되는 것은 아닙니다.

공개 SDK 키는 수집·평가용이며 서버 credential·설치 관리자 세션과 구분합니다. 일반 계정은 자신이 소유하거나 공유받은 프로젝트의 역할 범위에서 사용하며 설치 전체 기능은 관리자 전용일 수 있습니다.

다음 문서: [SDK 연동](../../packages/sdk/README.md), [설치](setup_guide.md), [데이터 접근](data_access.md), [기여](agent_collaboration.md).

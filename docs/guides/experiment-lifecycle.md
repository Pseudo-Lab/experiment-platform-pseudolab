Status: active
Last-Validated: 2026-11-15

# 실험 상태와 결과 확정

실험 설정의 상태와 데이터 관찰·결과 확정 단계는 서로 다릅니다. 이 가이드는 현재 상태 전이와 신규 SDK A/B 실험의 측정 계약을 설명합니다. legacy 실험의 과거 집계를 소급 변경하지 않습니다.

## 실험 상태 전이

| 현재 상태 | 가능한 다음 상태 |
| --- | --- |
| `draft` | `running`, `archived` |
| `running` | `paused`, `completed`, `archived` |
| `paused` | `running`, `completed`, `archived` |
| `completed` | 전이 없음 |
| `archived` | 전이 없음 |

`paused`는 재개 가능하지만 `completed`·`archived`는 종료 상태입니다. 현재 상태 머신에서는 completed에서 archived로 바꾸는 전이도 지원하지 않습니다. 실험 상태 변경과 연결된 flag·placement 설정은 구분하며 종료에 필요한 노출 제어를 함께 확인합니다.

## 신규 SDK 측정 계약

신규 SDK A/B 실험의 `bounded_v1`은 첫 실행 시 지표·변형·정책·전환 창을 고정합니다. 시작 뒤 설정을 바꿔 같은 결과의 의미를 조용히 변경하지 않습니다. 과거 무정책·legacy 실험을 자동 편입하지 않습니다.

기본은 실행 중 발생한 적격 노출 이후의 행동입니다. 일시중지·종료 후 새로 발생한 행동은 기본 방식에서 제외합니다. 실행 중 발생해 늦게 도착한 이벤트는 원래 발생 시각과 수신 경계로 판정합니다. 정책상 제외된 원본이 수집됐다는 사실만으로 결과 집계에 포함됐다고 해석하지 않습니다.

## 전환 창과 수신 유예

- `conversion_window_seconds`(W): 일회성 개입을 명시한 신규 SDK 실험에서 선택하는 행동 인정 기간. 최초 적격 노출 기준이며 재노출·재개로 연장되지 않는 경과 시간.
- `one_time_intervention`: 명시적 전환 창 사용 조건. 지속적인 기능 제공이 필요한 실험과 구분.
- `ingestion_grace_seconds`(L): 현재 구현에서 86,400초. 인정된 발생 시각의 이벤트가 늦게 도착할 수 있는 수신 유예이며 행동 인정 기간 자체의 연장이 아님.

현재 계약의 확정 경계는 종료 이력 시각 + 선언한 W(없으면 0) + L입니다. 사용자는 응답의 `finalizes_at`을 확인합니다. 시계나 W/L을 바꿔 기다림을 우회하지 않습니다.

이벤트는 프로젝트·실험·사용자·변형과 tracking context로 적격 노출에 연결됩니다. 첫 적격 노출로 정한 변형과 다른 행동·시작 후 새 변형은 집계 대상이 아닐 수 있습니다. 정확한 귀속·중복 방지·legacy 구분은 [SDK 가이드](../../packages/sdk/README.md)와 현재 코드를 확인합니다.

## 결과 단계

| `readout_state` | 의미 |
| --- | --- |
| `collecting` | 실행 중 데이터 수집·계산 |
| `observing` | 중지 또는 종료 상태에서 관찰·수신 유예 등 조건 확인. 확정 결과와 구분 |
| `finalized` | 유예 이후 입력 봉인과 결과 확정 완료 |

마감 시각 경과만으로 이미 snapshot이 생성됐다고 판단하지 않습니다. 결과 조회 과정에서 실제 확정 처리가 수행될 수 있으므로 읽기 형태의 요청도 내부 snapshot 쓰기를 일으킬 수 있습니다.

확정 입력과 결과는 계약에 묶어 저장합니다. 입력 변경 차단과 원본 이벤트로부터의 독립성을 유지하며, 저장소 실패를 빈 성공 결과로 표시하지 않습니다. 이는 운영자에게 원본 이벤트 삭제를 권장하거나 기존 데이터 보관 정책을 대체하는 설명이 아닙니다.

## 모니터링과 해석

- Live Events의 노출·전환 인스턴스와 결과의 고유 사용자 표본 구분.
- SDK v1 Live Events의 유의성·승자 추론 비활성화와 사용자 단위 결과 추론의 구분.
- SRM·가드레일 경고는 데이터·실험 품질 검토 신호이며 승자 판정의 대체 수단이 아님.
- 일반 계정의 analytics와 설치 관리자 전용 `/result`의 현재 접근 범위 구분. [접근 가이드](project-access.md) 참고.

구현 근거: [상태·측정 스키마](../../backend/app/schemas/experiment.py), [결과 계산](../../backend/app/services/experiment.py), [측정 계약·snapshot](../../backend/app/services/sdk_readout.py), [migration 044](../../backend/migrations/044_bounded_readout.sql).

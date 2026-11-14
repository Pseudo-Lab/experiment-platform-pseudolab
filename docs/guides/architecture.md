Status: active
Last-Validated: 2026-11-15

# 아키텍처와 데이터 흐름

Iterglow는 연동 서비스와 분리된 실험 플랫폼입니다. 서비스에서 화면·기능을 제공하고 사용자 식별자·이벤트·목표 지표를 정의하며, 플랫폼은 프로젝트·실험·배정·수집·분석을 관리합니다.

## 구성

| 구성 | 구현·경로 | 역할 |
| --- | --- | --- |
| 관리 화면 | React·Vite·TypeScript, `frontend/src` | 프로젝트·flag·실험 설정과 결과 확인 |
| API | FastAPI, `backend/app` | 인증·권한·SDK 수집·실험 계산 |
| SDK | TypeScript·React, `packages/sdk` | variant 판단·명시 노출·행동 전송 |
| 앱 저장소 | Cloudflare D1, `D1_DATABASE_ID` | 계정·프로젝트·설정·이벤트·결과 입력 저장 |
| 첨부파일 저장소 | Cloudflare R2, `R2_BUCKET_NAME` | 이슈·시각 변경 등의 첨부파일 저장 |
| 선택적 외부 데이터 소스 | D1, `D1_MAIN_DATABASE_ID` | 기존 query segment·조직 대시보드용 소스. 등록 template의 테이블 계약 필요 |

백엔드는 D1 HTTP API를 사용합니다. 로컬 SQLite나 다른 제품 DB로 자동 대체하지 않습니다. 자신의 리소스를 준비하는 절차와 새 DB 초기화의 현재 제약은 [설치 가이드](setup_guide.md)에서 확인합니다.

## SDK v1의 기본 흐름

```text
관리자·프로젝트 구성원 → 인증된 관리 API → 프로젝트·flag·실험 설정
연동 서비스 → 공개 SDK 키로 /decide → variant·tracking context
연동 서비스 → 실제 노출 시 expose → /capture → event_log
연동 서비스 → 같은 노출의 행동 track → /capture → event_log
권한 있는 사용자 → 결과·analytics API → 해당 실험의 집계
```

`decide`는 화면 표시 자체가 아닙니다. SDK v1은 기본적으로 `/capture`에만 전송하고, legacy의 `/events → experiment_event` 경로와 자동으로 합산하지 않습니다. 정확한 호출·식별자·재시도 계약은 [SDK README](../../packages/sdk/README.md)가 기준입니다.

## 프로젝트와 접근 경계

프로젝트는 실험·flag·공개 SDK 키·서버 credential·구성원 권한의 경계입니다. 공개 SDK 키, 서버 credential, 사용자 관리 세션은 서로 다른 인증 수단입니다. 전체 분석·세그먼트·placement 등 기존 전역 기능은 설치 관리자 전용일 수 있습니다. [프로젝트 접근 가이드](project-access.md) 참고.

[서버 접근 판정 API](access-decision.md)는 서비스 서버가 인증한 사용자의 접근 정책을 평가하는 별도 경로입니다. 실험 variant 결정이나 설치 관리자 인증을 대체하지 않습니다.

## 주요 코드 진입점

- API 등록: [api.py](../../backend/app/api/v1/api.py)
- 사용자 인증·프로젝트 권한: [auth.py](../../backend/app/core/auth.py), [authorization.py](../../backend/app/core/authorization.py)
- SDK 이벤트: [sdk_events.py](../../backend/app/services/sdk_events.py)
- 실험·결과: [experiment.py](../../backend/app/services/experiment.py), [sdk_readout.py](../../backend/app/services/sdk_readout.py)
- 저장소·스키마: [db](../../backend/app/db/), [migrations](../../backend/migrations/)

## 기능 범위

- 기본 실험·노출·행동 모델과 legacy의 구분. 과거 실험의 이벤트 모델·데이터를 소급 변경하지 않는 원칙.
- query segment는 서버 allowlist만 사용하며 임의 SQL·임의 원천 DB 연결을 제공하지 않는 현재 제약.
- 사용자 속성 기반 세그먼트별 결과 비교는 [#23](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/issues/23)의 후속 범위.
- 기존 SRM·가드레일·이상 경고와 주기적 자동 검사·외부 알림의 구분. 자동 모니터링은 [#22](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/issues/22)에서 보류 중.

구현의 실제 요청·응답 스키마는 실행 중인 설치의 `/docs`와 저장소 코드를 확인합니다. 이 문서는 특정 운영 설치의 배포·데이터 상태를 보장하지 않습니다.

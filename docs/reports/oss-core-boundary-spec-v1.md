Status: active
Last-Validated: 2026-03-16

# OSS Core Boundary Spec v1

## 목적
`experiment-platform-pseudolab` 코드베이스에서 OSS 코어(`experiment-platform`)로 분리할 경계를 고정한다.

## 1) 패키지 경계

### Core (OSS)
- 재사용 가능한 타입/스키마
- 도메인 중립 유틸
- 데이터 소스 인터페이스(어댑터 추상화)
- 공통 API 계약(입출력 스펙)

### Overlay (pseudolab)
- 가짜연구소 전용 KPI 정의/라벨
- 가짜연 운영 문맥(채널/워크플로우/정책)
- 배포/운영 특화 설정

## 2) 공개 API 안정성 레벨
- **Stable**: 2개 이상 프로젝트에서 재사용 검증 완료
- **Beta**: 외부 공개되나 시그니처 변경 가능
- **Internal**: pseudolab 전용, OSS 미노출

## 3) Import 금지 규칙 (핵심)
- `core -> overlay` import: **절대 금지**
- `overlay -> core` import: 허용
- 예외는 RFC 승인 필요

## 4) 의존성 방향
- 허용: `apps/* -> core/*`
- 금지: `core/* -> apps/*`
- 금지: `core/*` 내부에서 조직/배포 경로 하드코딩

## 5) 예외 승인 절차
1. RFC 1페이지 작성 (`why`, `scope`, `rollback`)
2. 리뷰 1명 이상 승인
3. 만료일 설정 (임시 예외는 만료 후 제거)

## 6) SemVer 영향 기준
- **patch**: 버그 수정, API 시그니처 불변
- **minor**: 하위호환 기능 추가
- **major**: API 변경/삭제, 마이그레이션 필요

## 7) CI 게이트 (분리 이후)
- import boundary lint (`core -> overlay` 위반 검출)
- core 단위 테스트 필수
- API 계약 테스트(스키마 호환성)

## 8) 적용 메모
- 현재는 pseudolab 안정화 우선 단계이며,
- 본 문서는 OSS 분리 착수 시 경계 기준으로 사용한다.

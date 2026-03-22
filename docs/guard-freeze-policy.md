Status: active
Last-Validated: 2026-03-22

# Approval Gate Policy (MVP)

기본 원칙: 빠르게 적용/확인한다.
단, 아래 고위험 작업은 승인 게이트를 반드시 거친다.

## 승인 게이트 대상
- 배포 파이프라인 변경
- 시크릿/인증/권한 관련 변경
- DB 스키마/마이그레이션 변경

## 최소 승인
- Eng 1명 + Release 1명

## PR 필수 기재
- 무엇 변경
- 확인 방법
- 롤백 한 줄

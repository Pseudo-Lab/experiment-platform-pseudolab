Status: active
Last-Validated: 2026-03-22
Sprint-Window: 2026-03-22 ~ 2026-03-24
Expires-After: 2026-03-24 (remove §5 Day plan section)

# Current Working Agreement (MVP)

## 0) 목적
현재 팀/에이전트 공통 기준을 단일 문서로 유지해 작업 방향 불일치를 줄인다.

## 1) 운영 모드
- 현재 단계: **MVP**
- 최우선 원칙: **빠르게 적용하고, 빠르게 확인한다**

## 2) 이번 주 즉시 적용 범위 (IN)
1. `.github/pull_request_template.md` (초경량 3항목)
   - 무엇 변경 / 어떻게 확인 / 롤백 한 줄
2. `docs/qa-smoke-checklist.md` (스모크 3종)
   - 메인 진입 / 핵심 기능 1회 / 저장·반영 확인
3. `docs/release-note-template.md` (초간단)
   - 변경 3줄 + 리스크 1줄
4. `docs/guard-freeze-policy.md` (예외 안전장치)
   - 고위험 3종만 승인 게이트
   - 배포 / 시크릿·권한 / DB 스키마

## 3) 이번 주 보류 범위 (OUT)
- Guard/Freeze 전면 적용
- 멀티 에이전트 체계화 고도화
- 브라우저 QA 자동화 풀셋
- OSS 물리 분리 실행

## 4) 예외 안전장치
- 고위험 작업은 최소 승인 필요:
  - Eng 1명 + Release 1명
- PR에는 반드시 아래 3개를 기록:
  - 무엇 변경 / 어떻게 확인 / 롤백 한 줄

## 5) 멀티 작업자 최소 규칙 (MVP)
- 작은 단일 도메인 작업은 바로 진행 가능
- 아래 중 하나라도 해당하면 PR 또는 명시적 핸드오프 필요
  - 여러 도메인 동시 변경
  - API 계약/인증/DB 스키마 영향
  - 배포/시크릿/권한 변경
  - 현재 작업 기준 문서나 공통 가이드 변경
- 모든 작업에 별도 문서를 강제하지 않음
- 단, 완료 후 3줄 리포트는 항상 남김

## 6) 실행 순서 (Day1~Day3) — Expires 2026-03-24
- Day1: 템플릿 4종 반영 PR
- Day2: 파일럿 PR 1건에 새 템플릿/스모크/릴리즈 노트 적용
- Day3: 고위험 PR만 승인 게이트 운영 + 적용 로그 1건

## 7) 작업자 핸드셰이크 (작업 시작 전 필수)
1. 이 문서를 읽고 현재 작업이 IN/OUT인지 먼저 판정
2. OUT이면 구현 중단 후 확인 요청
3. 완료 후 3줄 리포트 남기기:
   - 무엇 변경
   - 어떻게 검증
   - 다음 영향/후속

## 8) 관련 문서
- `docs/reports/history-sync-2026-03-22.md`
- `docs/reports/growthbook-go-no-go-scorecard.md`
- `.github/pull_request_template.md`
- `docs/qa-smoke-checklist.md`
- `docs/release-note-template.md`
- `docs/guard-freeze-policy.md`

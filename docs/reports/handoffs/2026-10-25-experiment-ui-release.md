Status: active
Last-Validated: 2026-10-25

# 실험 UI 운영 반영

## 범위와 판단

- 사용자 요청: 진행 상황 확인 후 UI 배포 진행.
- 배포용 worktree: `/home/ubuntu/.openclaw/workspace-experiment-ui-release`, branch `feat/experiment-ui-release`.
- 기준: 원격 main `657ee4e`. 기존 UI worktree의 프런트 변경 중 실험 관리 관련 14개 파일만 이식했다.
- 포함: 실험 목록·생성 흐름, 설계/수집 확인/결과/결정 기록 진입, 저장 실패 안내·입력 보존, 프로젝트 선택/생성/관리 동선, KO/EN 및 회귀 테스트.
- 로그인 PR #12는 운영 인증 설정이 준비되지 않아 포함하지 않았다. 별도 전환 집계 수정, 로컬 main의 access 계약 변경, LVUP 커뮤니티 초안과 로컬 테스트 서버/데이터도 포함하지 않았다. 기존 운영 backend/API와 인증 동작을 유지한다.
- 다른 작업자의 worktree와 루트 미커밋 변경은 보존했다. 설계 카드 추가 시안은 구현하지 않았다.

## 검증

- frontend 전체 16개 파일·83개 테스트 통과. 종전 86개에서 커뮤니티 초안 전용 테스트 3개가 제외된 수치다.
- backend 전체 264개 테스트 통과.
- TypeScript/Vite production build 통과. 기존 번들 크기 경고 유지.
- 운영 변경 전 HTTPS 화면과 backend status 200 확인.
- 로컬 브라우저: 최종 배포 브랜치에서 프로젝트 선택·생성 폼 직접 진입·관리 목록·선택 유지·접힌 메뉴·영어·모바일 확인. 운영 데이터 쓰기는 수행하지 않는다.

## 배포 경로와 복구

- PR 검증 → main 병합 → 기존 ci → gitops-ci 이미지 빌드 → DevFactory-Ops 이미지 태그 갱신 → ArgoCD 반영.
- 이전 운영 이미지: frontend/backend `3da3f23b912eef5d565ca38450c88d2b2afd87b9` (원격 prod kustomization 기준).
- 문제 발생 시 이 PR을 revert하고 같은 파이프라인을 사용한다. 즉시 복구가 필요하면 prod 이미지 태그를 위 기존 태그로 복구한다.
- 로그인·집계 개선은 별도 후속이며 이번 UI 배포 완료가 해당 작업 완료를 뜻하지 않는다.

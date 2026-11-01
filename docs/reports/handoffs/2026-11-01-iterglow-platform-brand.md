Status: active
Owner: experiment-lead
Last-Validated: 2026-11-01

# Iterglow 표시명 통합 — main 반영 승인본

## 요청과 범위

사용자가 제품명 **Iterglow · 이터글로**와 설명어 **오픈소스 A/B 테스트·실험 플랫폼**을 채택한 뒤, 플랫폼에도 새 이름을 적용하도록 요청했다. 소개·로그인·관리 화면·개발자 가이드와 현재 문서를 같은 이름으로 맞춘다. 로컬 결과를 먼저 제시했으며 사용자가 2026-11-01 “Iterglow main 반영”으로 커밋과 기존 자동 배포를 승인했다.

- Workspace: `/home/ubuntu/.openclaw/workspace-experiment-iterglow`
- Branch: `codex/iterglow-platform-brand`
- Base: origin/main `1ebf9c31c815050ab629402730502b71652e5388`
- 기존 root·로그인·SDK·마케팅·디자인 worktree의 작업을 이 작업으로 가져오거나 수정하지 않았다. 개발 의존성만 로컬 심볼릭 링크로 참조했다. 검증 후 SDK 디렉터리의 임시 의존성 링크는 제거했고, frontend 의존성 링크는 기존 ignore 대상이다. 링크는 게시 대상이 아니다.

## 사용자에게 달라지는 것

- 소개·로그인 헤더/본문/푸터, 설명용 제품 화면, 관리 사이드바와 소개 링크, 공개 SDK 가이드의 브랜드명이 Iterglow로 일치한다. 한국어 문장에는 이터글로 표기를 사용한다.
- 한국어 설명어와 영어 `Open-source A/B testing & experimentation platform`을 함께 맞췄다.
- 브라우저 제목은 `Iterglow · 이터글로`다. 기존 파비콘/터치 아이콘의 디자인은 유지한다. 특정 로고/파비콘 시안은 아직 채택되지 않았다.
- 백엔드 기본 PROJECT_NAME을 Iterglow로 바꿔 API 루트 안내와 OpenAPI 제목에 반영한다. PROJECT_NAME 환경 설정으로 덮어쓰는 기존 기능은 유지한다.
- README, SDK README/패키징 가이드, 패키지 설명·검색 키워드, 현재 PRD/문서 인덱스의 표시명을 갱신했다. 이전 보고서·디자인 산출물의 명칭과 경로는 역사 기록으로 보존한다.

## 연동 호환성과 미반영 범위

npm 패키지 `@pseudo-lab/experibase-sdk`, 공개 클래스/Provider/훅, SDK 저장 키, 쿠키, API 경로·응답 구조·프로젝트 키, 서비스/저장소 주소와 배포 식별자는 그대로다. 공개 가이드에서 새 서비스 이름과 기존 설치명·클래스명의 관계를 KO/EN으로 설명한다. npm 버전은 0.1.5이며 게시/태그 생성은 하지 않았다. SDK 계약·인증·집계·DB 마이그레이션은 변경하지 않았다.

GitHub 소개란 반영 제안(아직 원격 변경 전):

> Iterglow(이터글로) — 사용자 배정·행동 수집·결과 비교를 연결하는 오픈소스 A/B 테스트·실험 플랫폼

홈페이지 링크는 기존 `https://exp.pseudolab-devfactory.com`을 사용한다. 저장소명·도메인·팀 소개 사이트를 이번 로컬 앱 변경에서 개명하지 않았다. SDK 문서 구조 개편/전용 문서 사이트 구축과 새 파비콘 제작은 이 이름 변경에 포함하지 않는다.

## 검증과 근거

- Backend 전체: **345 passed** (`/tmp/iterglow-backend-tests.log`). 기존 Pydantic/테스트 클라이언트 deprecation 경고만 있으며 이번 표시명 변경으로 생긴 테스트 실패는 없다.
- Frontend 전체: 최종 문구 수정 후 **19 files / 138 passed** (`/tmp/iterglow-frontend-tests-final.log`). 기존 브랜드명을 사용하던 테스트 기대값 3곳을 함께 갱신했다. 별도 동일 내용 반복 테스트는 추가하지 않았다.
- SDK build 및 frontend production build 통과 (`/tmp/iterglow-build.log`, `/tmp/iterglow-frontend-build-final.log`). 기존 Vite 큰 청크 경고 유지.
- 로컬 TestClient: `/` 응답 `Iterglow API 서버가 작동 중입니다.`, `/api/v1/openapi.json`의 info.title `Iterglow` 확인. D1/R2/운영 API 쓰기는 하지 않았다.
- GitHub의 운영 SealedSecret 선언에서 PROJECT_NAME 키가 없는 것만 읽기 전용 확인했다. 시크릿 값·전체 내용을 출력하지 않았으며 실제 클러스터 환경을 검사한 것은 아니다.
- 최종 production build를 로컬 정적 SPA 서버에서 Chromium으로 확인: KO/light desktop, EN/dark desktop, KO/dark mobile, EN/light mobile. 각 조합에서 소개·로그인·SDK 가이드·관리 화면 총 **16개 화면**, 가로 넘침 없음, 브라우저 예외 없음, 이전 표시명 없음, 브라우저 제목 일치. 관리 화면은 API 응답을 전부 stub 처리했다.
- 로그인→가이드→로그인→원래 `/api-key` 복귀, 기존 npm 0.1.5 설치 명령 유지 확인. 실제 인증·사용자 데이터·telemetry를 운영에 전송하지 않았다.
- 첫 Vite preview 검수는 `/api-key`가 개발용 `/api` proxy에 매칭돼 실패했다. 앱 표시명/라우팅의 실패로 기록하지 않고, production 정적 SPA fallback을 모사한 서버로 바꿔 전체 시나리오를 재검증했다. Vite proxy 설정은 수정하지 않았다.
- 마케팅 담당이 read-only로 브랜드/출시 표현을 검토했다. 차단 사항은 없었고 설명어 KO/EN 일치 제안을 반영한 후 frontend 전체 테스트/build와 브라우저 검수를 수행했다. agy는 이번 이름 치환 구현에는 사용하지 않았다.
- `git diff --check` 통과.

브라우저 검토 산출물:
`/home/ubuntu/.codex/visualizations/2026/11/01/iterglow-platform-review/`
(`verification.json` 및 화면별 PNG, 재현 스크립트 `/tmp/iterglow-platform-browser-review.mjs`)

## 반영과 운영 확인

2026-11-01 사용자의 main 반영 승인을 받았다. 게시 직전 origin/main은 기반 커밋 1ebf9c3과 동일함을 확인했다. 사전 검증한 표시명 변경을 커밋하고 기존 CI/GitOps 자동 배포 및 실제 운영 표시명을 확인한다. 이 문서 작성 시점에는 운영 반영 전이며, 완료 여부는 CI/GitOps와 런타임 확인 결과로 별도 보고한다. npm 게시·태그 생성은 계속 보류한다.

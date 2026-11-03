Status: active
Last-Validated: 2026-11-04

# Iterglow 승인 브랜드 자산 적용

- Goal: 승인된 Iterglow 로고와 파비콘을 서비스 화면에 일관되게 적용한다.
- Workspace: `workspace-experiment-brand-assets`, branch `codex/iterglow-brand-assets-20261104`, base `aa897477653fe80e5d2498a6cbf575d606a2b645`.
- Scope: 공개 소개·로그인·SDK 가이드 헤더, 관리 사이드바 브랜드, favicon/touch icon. 이미 반영된 Iterglow 표시명·문서 제목을 유지한다.

## 적용과 판단

- 승인된 `iterglow-brand-kit` v1.0.0에서 SVG 로고(light/dark), 심볼, SVG/ICO 파비콘, Apple touch icon 6개를 원본 바이트 그대로 복사했다.
- 원본 이미지 SHA256: `cc217712b1df78bc1c9c0a84f48d557bb0fb083d789c2860d5176e614eca1f9d`.
- 반복되는 네 화면에서 `IterglowLogo`를 사용한다. 펼친 화면은 160px 로고, 접힌 사이드바는 32px 심볼을 표시한다. 홈 링크와 이미지 대체 텍스트는 KO/EN을 함께 제공한다.
- 전체 색상·테마·기능을 변경하지 않는다. 소개의 ‘오픈소스 A/B 테스트·실험 플랫폼’ 설명은 로고의 설명어로 대체하지 않는다.
- OAuth 후보 worktree/인증 코드/마이그레이션, 검토 중인 로그인 모션, 팀 `pages`는 포함하지 않는다. SDK 패키지명과 API 식별자를 유지한다.
- 16px 파비콘 중앙 여백은 승인 키트의 크기 한계를 유지하며 윤곽을 임의 수정하지 않는다.

## 검증

- frontend 전체 19개 파일 / 138개 테스트 통과. 로컬에서 발견한 KO 링크 기대값을 교정한 후 CI 전체 실행으로 재확인했다. CI의 backend 테스트도 345개 통과했다.
- SDK 빌드 및 frontend TypeScript/Vite 빌드 성공. 기존 대형 번들 경고는 이번 자산 교체 범위 밖이다.
- 실제 Chromium에서 소개·로그인·SDK 가이드·관리 화면 × light/dark × 1440/375/320px의 24가지 조합 통과. 이미지 로딩, 가로 넘침, KO/EN 홈 링크, 문서 제목, 접힌 사이드바 심볼을 확인했다. API는 로컬 stub이며 운영 데이터에 쓰지 않았다.
- 제공된 승인 자산 6개와 로컬 HTTP 응답의 SHA256 모두 일치. 화면 캡처·검증 결과: `/tmp/iterglow-brand-evidence/`, 재현 스크립트: `/tmp/check-iterglow-brand.cjs` (서버 임시 파일).
- [PR #30](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/pull/30) main 반영: `2c0a8e0f0b2fc6217989eb53eafba92dd8932ffb`.
- [main CI](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/actions/runs/41667076911) 및 [GitOps](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/actions/runs/41667328369) 성공. Ops `6e4a9ec1d0260930335e7c0cb3fb2294ff53b4bd`에서 frontend/backend 이미지 태그가 해당 main SHA로 자동 갱신됐다. 수동 배포/동기화는 실행하지 않았다.
- 운영 반영 확인 완료: `https://exp.pseudolab-devfactory.com/`에서 JS `index-DWf6MZL3.js`와 새 아이콘 링크를 확인했다. 공개 소개·로그인·SDK 가이드 × KO/light/1440px 및 EN/dark/375px 총 6가지 실제 브라우저 검증 통과(로고·홈 링크·제목·가로 넘침·페이지 오류). 승인 자산 6개의 운영 HTTP 응답 SHA256도 원본과 일치했다.
- 운영 검증은 익명 공개 화면 및 GET 요청만 사용했다. 인증된 사이드바는 로컬 stub 환경에서 검증했으며 운영 계정 로그인을 수행하지 않았다. 운영 근거는 `/tmp/iterglow-brand-live/validation.json`, 재현 스크립트는 `/tmp/check-iterglow-brand-live.cjs`에 있다.

## 통합 주의

OAuth 후보와 `LoginPage.tsx`, `ServiceIntroPage.tsx`, `SdkGuidePage.tsx`, `MainLayout.tsx`가 겹친다. OAuth 통합 시 이 브랜드 이미지·홈 링크 변경을 보존하고 인증 동작은 별도로 검증한다. 이번 브랜치는 교정된 main에서 시작했으며 이전 이력을 다시 병합하지 않는다.

Status: active
Last-Validated: 2026-11-14

# 계정 식별·이메일 지정 초대·로그아웃 — 로컬 구현 인계

## Scope / Workspace
- Owner: experiment-lead-v3. 사용자가 11월 14일 Google 이름·이메일 표시와 이메일 기반 초대를 승인했다. 이전의 별칭/Google 정보 선택 대기는 해소됐다.
- Worktree: `/home/ubuntu/.openclaw/workspace-experiment-account-identity-20261113`, branch `fix/account-identity-20261113`, base `6c7ae1de3c2ebf0203124f07d5aa23852c285fb8`.
- 본인·소유자용 멤버 목록·초대 수락자 이력 식별, 이메일 지정 초대, 명시적 로그아웃을 로컬 구현했다. 미커밋이며 GitHub 게시·운영 DB 변경·배포·실제 OAuth 로그인·메일 발송은 하지 않았다.

## Changes / Contract
- Google scope는 `openid profile email`. 기존 서명·issuer/audience/nonce 검증을 통과한 ID token의 이름과 검증된 이메일을 별도 프로필에 저장한다. 재로그인 때 갱신하며 누락된 이메일 소유 증명을 유지하지 않는다. 프로필 쓰기 실패 시 새 세션도 발급하지 않는다.
- 신원은 계속 Google `sub`와 내부 account_id, 관리 권한은 내부 설정을 사용한다. 이름·이메일·provider role로 계정을 합치거나 권한을 올리지 않는다. 같은 이메일의 다른 sub도 별개 계정이다. OAuth access/refresh token은 저장하지 않는다.
- Google 공식 [ID token 검증 안내](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)에 따라 Gmail 또는 서명된 `hd`가 있는 Workspace 계정만 이메일 지정 초대의 소유 증명으로 인정한다. 외부 이메일 Google 계정은 표시가 가능하지만 지정 초대는 추가 소유 확인 없이는 수락할 수 없다. 별도 이메일 인증 기능은 추가하지 않았다.
- migration 042는 `platform_account_profile`, `project_invitation_recipient`, 원자적 초대 생성 view/trigger를 추가하고 기존 수락 trigger에 이메일 일치 조건을 넣는다. 초대+수신자 생성과 초대 소비+멤버 등록은 각각 한 SQL 문장의 트랜잭션이다. 기존 링크·멤버·이력은 보존한다.
- API의 `email`은 선택값으로 기존 호출·무지정 링크와 호환된다. 대시보드는 새 초대에 이메일을 필수로 받는다. 자동 메일 발송은 없으며 링크를 복사해 직접 전달한다. 기존 7일 만료·단일 수락·재시도·제거 후 차단을 유지한다. 쓰기 시점에도 이메일 소유를 재확인한다.
- 프로필 응답은 본인의 `/auth/me`와 소유자/관리자 전용 멤버·초대 이력에 한정한다. 초대 미리보기에는 대상 이메일이 없다. 이름이 없으면 이메일, 둘 다 없으면 기존 ID로 표시한다. 역할 수정은 account_id로 수행한다.
- 프런트엔드는 이름 우선·이메일 보조, 모바일 계정 메뉴와 명시적인 로그아웃을 제공한다. 처리 중 재조작 방지와 실패 시 재시도, KO/EN을 함께 반영했다. 기존 shadcn/Radix와 테마를 사용하며 새 의존성은 없다.

## Validation
- 백엔드 회귀: 서명된 합성 ID token의 정상/누락/미검증/잘못된 claim, 재로그인·소유 증명 제거, 프로필 저장 실패, 같은 이메일의 다른 sub 분리, 제어문자 입력, 프로필 조회 범위, 수락 계정 불일치, INSERT 시 이메일 변경 경쟁, 원자적 롤백, 재시도·제거, migration 재적용과 기존 링크 호환성을 확인했다.
- 백엔드 단독 전체 589개 통과. 최종 제어문자 회귀까지 포함한 격리 통합본은 **650개 통과**. 통합본에는 이전 API 검증 38사례·상태 이력 8사례·중지 후 신규 노출 guard 14사례가 함께 있다. 원본 worktree를 합치거나 커밋한 것은 아니다. 기존 의존성 경고 6건이 있다.
- 프런트엔드 **226개 / 21 files**, 관련 69개 및 최종 production build 통과. 기존 Browserslist·bundle 크기 경고가 있다. impeccable detector 지적 없음, `git diff --check` 통과.
- 실제 로컬 FastAPI+메모리 SQLite+production frontend 브라우저 **KO/EN × 390px/1280px 4조합 통과**: 이름/이메일, 긴 한글·이메일 줄바꿈, HTML 형태 이름의 안전한 문자 표시, 다른 계정 수락 403·접근 404, 지정 계정 수락, 조회자 키/멤버 조회 403, 편집자 전환 후 키 접근 200, 제거 후 404·수락자 이력 보존, 로그아웃 후 이전 쿠키 재사용 401. 대표 모바일·데스크톱 이미지를 직접 점검했다.
- 브라우저는 합성 Google 프로필/세션이다. 실제 Google 동의·재로그인, 운영 D1·화면·메일 검증은 아니다. 서명된 합성 ID token 검증은 백엔드 테스트로 확인했다.
- 브라우저 하네스의 heading/복합 이름 exact 탐색을 수정했다. 정상 HTTP 오류의 body 읽기가 대기하던 검증 코드를 상태 불일치 때만 body를 읽도록 고쳤다. 로그아웃 후 401 확인에는 fixture의 비밀번호 인증 설정도 합성값으로 완비했다. 제품 코드를 성공 조건에 맞춰 완화하지 않았다.
- 11월 13일 메뉴 단독 검증의 로그아웃 실패·재시도, 키보드 포커스 복원 근거는 이전 폴더에 보존했다.
- 최신 근거: `/home/ubuntu/.codex/reviews/iterglow-account-identity-20261114/`의 `combined-final-tests.log`, `frontend-full-tests.log`, `frontend-build.log`, `browser-results.json`, `profile-menu-*.png`, `members-*.png`, `history-after-removal-*.png`, `security-review.md`. 이전 근거는 같은 상위 경로의 `iterglow-account-identity-20261113/`.

## Review / Rollout / Remaining
- Gemini/agy `gemini-4-argon-high`의 읽기 전용 인증·개인정보·원자성 리뷰는 최종 Pass. Codex가 diff·근거·테스트를 대조했다. 최초 리뷰의 제어문자 설명이 코드보다 넓어 양쪽 정규식을 보강하고 NUL 회귀를 추가했다. 권한/경쟁 조건 점검은 유용했고 설명 교정과 후속 검증 비용이 있었다.
- **운영 반영 전 migration 042 선행 적용 필수.** 새 backend가 새 테이블/view를 사용한다. 기존 `run_migration.sh`는 trigger 내부 세미콜론을 분리하므로 사용하지 않는다. 전체 SQL 문장/trigger를 처리하는 승인된 Ops 경로에서 적용·재적용·동작을 확인한다. 범용 runner 수정은 이번 범위가 아니다.
- 기존 로그인 세션은 profile 없는 LEFT JOIN으로 유지되지만, 표시 정보/이메일 지정 초대 수락에는 Google 재로그인이 한 번 필요하다. 운영 반영 시 동의 화면과 실제 Gmail/Workspace 계정 수락을 확인해야 한다.
- 새 backend 후 frontend 순으로 반영하고 기존 무지정 초대 호환성을 확인한다. 실패 시 앱을 이전 버전으로 되돌리되 새 테이블/이력/멤버 데이터는 삭제하지 않는다. DB trigger를 임의로 역적용하지 않는다.
- 실제 OAuth·운영 확인이 남아 카드 전체는 진행 중이다. 별도 전환 정책은 `feat/event-status-history-20261113` worktree의 `docs/reports/experiment-stop-policy-2026-11-14.md`에 있고, 이 구현에는 전환 창·수신 유예·결과 확정을 추가하지 않았다.

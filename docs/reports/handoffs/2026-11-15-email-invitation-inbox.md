Status: active
Last-Validated: 2026-11-15

# 링크 없는 이메일 프로젝트 초대

## Task Metadata
- Task ID: email-invitation-inbox-20261115
- Owner: soo / Codex
- 상태: 운영 반영 및 합성 계정 HTTPS QA 완료, 실제 Google 재로그인 확인은 미수행

## Scope
- 가입 전에도 이메일 초대를 등록하고, 상대가 Google 로그인 후 서비스 안에서 발견하여 명시적으로 수락·거절한다.
- 초대 링크 생성·복사 UI를 제거한다. 기존에 발급한 링크의 API 호환성은 유지한다.
- 이메일 자동 발송, 자동 프로젝트 가입, 이메일에 따른 계정 통합은 포함하지 않는다.

## Workspace
- Worktree: `/home/ubuntu/.openclaw/workspace-experiment-email-inbox-20261115`
- Branch: `feat/email-invitation-inbox-20261115`
- Base: `4895a5e261c4a785f60fc135153fb7f669445dbd`
- 구현 커밋 `3f5a24c`를 PR41로 병합했다. 운영 애플리케이션 SHA는 `26605ef85a86ed7babb0986718fe5278f6084587`이며 migration045도 적용됐다.

## Inputs Used
- `AGENTS.md`, `docs/reports/_index.md`, `docs/guides/agent_collaboration.md`
- 기존 프로젝트 공유·Google 계정 프로필·042 검증 이메일 정책
- 사용자 요청: 링크 없이 이메일로 초대를 발견하고 수락하는 흐름

## Changes Made
- `GET /api/v1/projects/invitations/pending`: 현재 계정의 검증된 이메일에 해당하는 유효한 대기 초대만 반환한다. 프로젝트·역할·초대한 사람·만료를 표시한다.
- `POST /api/v1/projects/invitations/{id}/accept` 및 `/decline`: 서버의 현재 이메일 증명을 쓰기 시점에 다시 검사한다. 수락 재시도는 내부 계정과 남아 있는 접근 권한으로 확인하며, 제거된 멤버를 복구하지 않는다.
- migration `045_email_invitation_inbox.sql`: `declined_at`, `invited_by`와 생성·수락 트리거를 추가·갱신한다. 거절한 초대는 기존 링크로도 수락·미리보기할 수 없다.
- 기존 멤버의 역할은 초대 수락만으로 승격·강등하지 않는다. 소유자의 명시적 역할 변경 경로를 유지한다.
- MainLayout의 받은 초대 영역은 계정별로 분리한다. 늦은 요청 응답이나 로그아웃 후 응답이 다른 계정의 화면·프로젝트 선택을 바꾸지 않도록 처리한다.
- KO/EN 초대 등록·목록·수락·거절·오류·로딩 상태와 회귀 테스트를 반영했다.
- 사용자 화면 피드백 반영: 멤버 이름 옆에 소유자·조회자·편집자 배지를 표시하고, 상시 표시되던 권한 드롭다운을 ‘권한 변경’ 버튼과 선택 메뉴로 교체했다. 소유자에게는 변경 버튼을 표시하지 않으며, 현재 권한 선택·메뉴 취소 시에는 요청을 보내지 않는다. 실패 시 기존 권한을 유지한다.
- 추가 화면 피드백: 프로젝트 공유·멤버 관리와 초대 이력을 별도 카드로 분리했다. 이력 상태는 전체·대기·수락·거절·만료·회수를 펼쳐 보여주는 단일 선택 버튼으로 변경했다. `aria-pressed`로 선택을 전달하고 모바일에서는 줄바꿈한다. 새로고침 후 선택 상태와 기존 회수 기능을 유지한다.
- 다수 초대 대응 피드백: 이력을 한 초대당 한 행인 표로 바꾸고 10건씩 페이지를 나눴다. 상태 변경·새로고침 시 첫 페이지로 돌아간다. 키보드로 접근 가능한 표 내부 가로 스크롤을 사용한다. 현재 목록 API를 유지한 클라이언트 페이지 처리이며 서버가 전체 이력을 가져오는 계약은 그대로다.
- 기한 용어는 이력 표와 받은 초대 모두 ‘초대 만료 시각’ / ‘Invitation expires at’로 명확히 했다. 프로젝트 접근 권한의 만료 시각을 뜻하지 않는다. 이 문구 수정 후 빌드 통과. 초대 회수는 대기 초대의 취소이고 멤버 제거는 수락 후 접근 권한 제거이므로 별개이며, 멤버 제거로 과거 수락 기록을 회수 상태로 바꾸지 않는다.
- ‘새 프로젝트’ 무반응 보고를 실제 화면에서 재현했다. URL과 폼은 바뀌지만 공유 영역 때문에 입력란이 화면 높이 900px 바깥(데스크톱 y=965, 모바일 y=1049)에 있고 초점도 없었다. 생성 중에는 공유 영역을 숨기고 이름 입력란에 자동 초점을 주어 즉시 보이도록 수정했다. 프로젝트 생성·권한 API는 변경하지 않았다.

## Validation
- Backend 전체: 742 passed (기존 프레임워크 경고 6개).
- Frontend 전체: 254 passed. 이후 테스트의 TypeScript 질의 옵션을 수정하고 관련 28개 테스트 및 `tsc && vite build`가 통과했다.
- 독립 Gemini Argon High 검토와 총괄 diff 확인: 추가 차단 결함 없음. Backend 구현은 Codex B 작업자, Frontend·통합·브라우저 검증은 총괄이 담당했다.
- 로컬 Miniflare D1 + 실제 FastAPI + 빌드된 Frontend: KO/EN, 390/1280px에서 이메일 초대·독립 로그인·발견·수락·거절·다른 계정 차단·역할 유지 검증.
- 증거: `/home/ubuntu/.codex/reviews/iterglow-email-inbox-20261115/`의 테스트 로그·review.md·browser-results.json·스크린샷.
- 로컬 브라우저 로그인은 격리된 합성 계정 fixture다. 아래 운영 반영 기록과 구분하며, 실제 Google OAuth 재로그인은 이번 자동 QA에서 수행하지 않았다.
- 권한 표시·변경 후속 수정: 관련 ProjectSharing 테스트 18개, TypeScript·Vite 빌드 통과. 실제 API에 대한 KO/EN·390/1280px 브라우저 4개 시나리오에서 현재 역할 표시·버튼 메뉴·선택 상태·편집자 변경 후 표시와 접근 권한 갱신을 확인했다. 증거는 `member-role-browser-results.json`, `member-role-*.png`, `role-menu-*.png`다. 기존 254개 전체 결과는 후속 수정 전 기준이다.

### 상태 필터 리서치
- [PatternFly Filters](https://www.patternfly.org/patterns/filters/design-guidelines/): 적은 선택지를 숨기지 않고 제시하려는 경우 toggle group이 적합하다.
- [Material ChoiceChip](https://api.flutter.dev/flutter/material/ChoiceChip-class.html): 단일 선택 필터를 지원하며 복수 선택과 구분한다.
- [GOV.UK Tabs](https://design-system.service.gov.uk/components/tabs/): 탭은 관련 콘텐츠 섹션 간 이동을 위한 패턴이다.
- 위 기준에 따라 동일 이력 목록을 거르는 현재 화면에는 단일 선택 버튼을 채택했다. 상태를 한눈에 비교하고 즉시 변경할 수 있게 하되 다중 조건 필터·별도 탭 페이지는 추가하지 않았다.
- 후속 검증: 관련 테스트 20개 및 TypeScript·Vite 빌드 통과. KO/EN·390/1280px 실제 API 브라우저 4개 시나리오 통과. 섹션 분리·6개 필터·한 상태 선택·필터링·새로고침 시 선택 유지·기존 권한 변경을 확인했다. `history-filter-browser-results.json`과 `history-sections-*.log`, 최종 `member-role-*.png`에 증거를 남겼다. `history-filter-*.png`는 새로고침 중 화면이며 최종 레이아웃 증거는 `member-role-*.png`를 사용한다.
- 표·페이지 이동 및 새 프로젝트 후속 검증: ProjectSharing/Projects/MainLayout 45개 테스트와 TypeScript·Vite 빌드 통과. 실제 API에 프로젝트별 합성 초대 14건을 만들고 10/4건 페이지, 상태 필터, 새로고침 유지, 기존 초대·역할 흐름을 KO/EN·390/1280px에서 검증했다(4개 시나리오). 모바일의 표 내부 가로 스크롤과 문서 전체 가로 넘침 없음을 확인했다. 생성 QA 리소스만 정리했다. 새 프로젝트는 데스크톱/모바일 모두 입력란 y=197/181, 초점 true로 개선됐고 공유 패널은 생성 중 숨겨졌다. 증거: `history-table-browser-results.json`, `history-table-*.png`, `table-project-*.log`, `new-project-before.json`, `new-project-after.json`.

## Risks / Next Owner
- 운영 적용 전에 승인된 운영 절차로 migration045를 한 번 적용해야 한다. 트리거 전체 SQL 문장을 유지하고 세미콜론으로 단순 분리하지 않는다.
- backend가 새 컬럼을 읽으므로 migration을 먼저 적용한다. 기존 프로세스 종료·진행 중 요청 배출 후 적용하는 기존 배포 경계를 유지한다.
- migration045는 ALTER TABLE을 포함한 단회 마이그레이션이다. 무조건 재실행하지 않고 적용 상태를 확인한다.
- 이전 TS: https://agent-server.tail03ec4e.ts.net:9457/ — 검토 완료 후 사용자 지시로 종료했다. DB 복원 검증을 거친 비공개 백업·소스·테스트 산출물은 보존했다. 이전 9455 및 서비스 소개 9449도 종료했다.
- 운영 적용 완료. 실제 Google 계정 재로그인·받은 초대 확인은 사용자가 추후 확인할 수 있는 잔여 수동 QA다. 자동 QA를 Google 로그인 검증으로 간주하지 않는다.
- 배포 후보 준비 시 원격 main을 읽기 전용으로 확인했다. 기준 SHA와 동일한 `4895a5e261c4a785f60fc135153fb7f669445dbd`로, 새 main 변경에 따른 통합 충돌은 없다. 검증 파일 해시와 SQL 전체 문장 경계를 별도 release manifest로 보존한다.

## 별도 예약된 SDK 검사
- 기존 운영 합성 QA의 최종 확정·불변성 검사는 사용자 요청으로 systemd user timer에 예약했다: 2026-11-15 06:08 KST, `iterglow-sdk-finalize-20261115.timer`.
- 새 초대 기능 배포와 무관하다. 실제 마감 이후 결과 고정·원본 이벤트 삭제 후 동일 결과를 검사하고, 해당 합성 fixture만 정리한다. 현재는 예약 상태이며 검사 성공으로 기록하지 않는다.

## 운영 반영 기록
- 사용자 명시 승인 후 [PR41](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/pull/41)을 main에 병합했다. main CI43636642339에서 Frontend258개·Backend742개 테스트 통과, GitOps CI43636771282 성공.
- 운영 D1 전체 export와 Time Travel bookmark를 비공개 보존하고, 복원 무결성과 기존 행 보존 리허설을 확인했다. 백엔드 요청 배출·0개 pod·35초 유예 후 migration045의 전체 SQL8문장을 적용했다. 문장별 스키마/FK 검사와 기존 건수 보존을 확인했다. 실패·불명확 응답 시 무조건 재실행하지 않는 단일 시도 잠금을 사용했다.
- 기존 백엔드 제공을 복구하고 타 앱에 영향 없는 임시 동기화 차단과 migration pod를 제거했다. 자동 GitOps가 Ops SHA `3fd894ccb8b71ad6a7ae016ae4ace1fd1ab376f7`를 반영했다. 운영 FE/BE 모두 앱 SHA `26605ef85a86ed7babb0986718fe5278f6084587` 이미지 ready1/1이며 Argo Synced/Healthy다.
- 운영 전환 확인: 2026-11-15 05:25:33 KST. 폴링/캐시 지연으로 이전 revision이 잠시 유지돼 정상 비교 refresh를 한 번 요청했다. 수동 sync·이미지 태그 재작성·중복 배포는 하지 않았다. 정확한 지연 원인은 로그로 확정하지 않았다.
- 운영 HTTPS 합성 QA: 가입 전 이메일 초대, 다른 계정 차단, 독립 로그인 후 초대 발견, 명시적 수락과 재시도, 거절·회수, 기존 역할 보존, 소유자 권한 변경, 멤버 제거 후404 및 재수락410, 수락 이력 유지가 통과했다. 생성한 프로젝트1개와 합성 계정3개는 삭제·부재 확인했다. 실제 Google OAuth 콜백은 실행하지 않았다.
- 공개 홈·로그인·SDK 가이드 및 비로그인 보호 라우트는 KO1280/EN390px의8개 브라우저 검사에서 오류 없이 동작했다. 배포 JS의 새 초대/권한/기한 문구와 비로그인 API401도 확인했다.
- Gemini Argon High가 적용 절차와 QA 스크립트를 독립 검토했다. 총괄은 스키마·diff·실행 결과를 직접 확인하고 과도한 검토 문구를 정정 요청했다. 실행 성공은 검토 동의가 아닌 실제 receipt와 runtime 상태로 판정했다.
- 증거: `/home/ubuntu/.codex/reviews/iterglow-email-inbox-release-20261115/`. DB export·세션 관련 private 자료는 공개하지 않는다.

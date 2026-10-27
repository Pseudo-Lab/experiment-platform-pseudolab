Status: active
Last-Validated: 2026-10-26
Owner: login session

# 긴급 관리 API 인증과 프로젝트 키 노출 수정

## Task Metadata
- Task ID: urgent-admin-security-2026-10-26
- 사용자 요청: 공개 가입 설계와 별도로 긴급 보안부터 수정.
- 결과: 최신 main UI에 기존 단일 관리자 로그인을 통합하고 관리 API를 기본 차단한다. 일반 프로젝트 응답에서 키를 제거한다. 로컬 수정이며 운영 취약점 해소 완료를 의미하지 않는다.

## Scope
- 포함: 관리 API 공통 인증, 설정 누락 시 차단, 인증된 키 조회, 로그인 UI와 최신 UI 통합, SDK 인증 계약 회귀 검증.
- 제외: Google 공개 가입, 사용자별 프로젝트 소유권/격리, 공개·비밀 키 분리, DB migration, 실제 키 교체, 운영 쓰기·배포, 커밋·푸시.
- 현재는 하나의 관리자가 전체 프로젝트를 관리한다. 사용자별 소유권이 필요한 공개 가입 서비스로 개방하면 안 된다.

## Workspace
- Worktree: `/home/ubuntu/.openclaw/workspace-experiment-security`
- Branch: `fix/urgent-admin-security`
- Base: `origin/main`의 `ca7d7a09a0bf99dae1d9e5bdf922ad921d105111` (PR #24, 기존 UI 운영 반영 완료).
- 기존 `workspace-experiment-login`의 미커밋 결과에서 로그인 관련 코드를 재사용했다. 기존 root/login worktree는 편집·stash·reset하지 않았다. 로컬 main의 `92e468a` access 일반화는 포함하지 않았다.

## Inputs Used
- AGENTS.md, reports index, decision log, agent collaboration/design system 가이드.
- 로그인 worktree의 `docs/reports/handoffs/2026-10-22-admin-login-integration.md`.
- DevFactory-Ops 사용자 인계: 2026-10-26 01:58 KST에 무인증 프로젝트 조회 200 및 API 키 노출, 관리 API 공통 인증 누락 확인. 해당 운영 관측을 이번 세션에서 재검증하지 않았으며 침해 여부는 미판정이다. 비밀 값은 읽거나 기록하지 않았다.

## Changes Made
- `backend/app/main.py`: 공개 SDK·외부 연동 경로만 메서드와 정확한 경로 패턴으로 예외 처리한다. 나머지 API는 인증 설정 누락 시 503, 세션 부재/만료/변조 시 401. `/admin/srm-check`, 프로젝트/실험/플래그/세그먼트/분석·회고 집계 등 관리 API를 포함한다.
- 기존 PBKDF2 관리자 비밀번호 검증, HMAC 서명 만료 세션, HttpOnly 쿠키, login/logout/me API를 재사용했다. 설정이 전부 없을 때 공개하던 이전 동작을 제거했다.
- 관리·인증 요청의 Origin은 동일 origin 또는 명시적으로 등록된 origin만 허용한다. `*`는 관리자 Origin 허용으로 사용하지 않으며, SDK의 기존 CORS 범위는 유지한다. 관리·인증 응답은 no-store다.
- 프로젝트 목록·상세·생성·수정 응답은 `Project` 모델로 필터링해 `api_key`를 제외한다. 인증된 `GET /api/v1/projects/{project_id}/api-key`에서만 키를 조회한다. DB 저장 형식과 기존 키 값은 변경하지 않는다.
- 프런트의 AuthProvider·로그인·세션 복원/만료·로그아웃과 공통 apiFetch를 최신 UI에 통합했다. `/`, `/dashboard`, `/community`의 `/experiments` 이동을 유지한다. 관리 데이터 요청에는 쿠키를 전달한다.
- 프로젝트 목록에서 키를 제거했다. SDK 연동 화면은 전용 키 API와 로딩/실패/재시도/마스킹을 사용하며 프로젝트 변경 후 이전 응답이 키를 덮어쓰지 못한다.
- 기존 키가 공개해도 안전하다는 KO/EN 문구와 해당 키를 브라우저 코드에 삽입하는 예시를 제거했다. 같은 키가 `/access/decide` Bearer 인증에 쓰인다는 현재 계약을 반영한다.
- `/experiments/assignment`를 동적 실험 ID 경로보다 먼저 등록해 기존 SDK 경로가 404가 되지 않도록 했다.
- setup guide와 .env.sample에 fail-closed 동작, 해시 생성 모듈 명령, HTTPS 쿠키와 정확한 origin 설정을 설명했다.

## API Compatibility
- `/access/decide`: 기존 필수 project Bearer key 계약 유지. 관리자 쿠키로 대체 불가하며, project Bearer key로 관리 API 접근 불가.
- `/decide`, `/capture`, `/ingest/events`, `/feature-flags/decide`: 기존 optional X-API-Key 계약 유지. 잘못된 키는 거절한다.
- `/events`, `/identify`, assignment/placement decide, 외부 회고 제출·완료 확인: 기존 SDK/외부 계약 유지. 이번 단계에서 프로젝트별 데이터 격리나 강제 SDK 키 인증을 도입하지 않았다.
- 일반 프로젝트 응답에서 키를 읽던 소비자는 인증된 키 전용 API로 이전해야 한다. 프런트와 백엔드를 함께 반영해야 한다.
- `/admin/srm-check` 등 무인 관리 호출은 이제 관리자 세션이 필요하다. 실제 스케줄러의 존재·호출 방식을 운영 담당자가 확인해야 한다.

## Validation — 최초 관리 인증 패치

아래는 라이브러리 변경 전 결과다. 최종 검증은 하단 「변경 후 검증」을 기준으로 한다.
- Backend: `/home/ubuntu/.openclaw/workspace-experiment/backend/venv/bin/python -m pytest backend/tests -q` → **279 passed** (최종 24.58초).
- Frontend: `npm test -- --run` → **18 files / 97 tests passed**. 키 조회 신규 테스트 4개 포함.
- SDK: `npm run build` 성공. Frontend: `npm run build` → TypeScript + Vite production build 성공 (2401 modules).
- `git diff --check` 통과. 기존 Pydantic/python-multipart/utcnow 경고, jsdom chart 크기 경고, Browserslist·번들 크기 경고는 남아 있다.
- 보안 테스트는 실제 middleware를 사용한다. 모든 관리 route 미인증 거절, 설정 전부/일부 누락, 메서드·중첩 경로 우회 방지, 로그인/만료/변조/HTTPS 쿠키/CORS, 불허 Origin의 로그인·로그아웃·조회·쓰기 거절을 검증한다.
- 일반 프로젝트 응답 키 부재, 인증된 전용 키 조회, 테스트 DB의 키 교체 후 이전 키 거절, SDK/외부 경로의 세션 없는 호출을 검증한다. 실제 운영 키는 변경하지 않았다.
- 기존 업무 로직 테스트는 conftest에서 테스트 전용 관리 설정과 유효하게 서명한 세션을 제공한다. 프로덕션 인증 의존성을 우회하지 않는다. test_auth는 이 자동 인증을 제외해 독립적으로 무인증·SDK 접근을 검증한다.
- 신규 UI 테스트는 키 조회의 empty/loading/error/retry/success, KO/EN, 프로젝트 변경 중 늦은 응답 무시를 검증한다.
- 실제 브라우저·운영 HTTPS/시크릿 주입 E2E는 수행하지 않았다. 프런트는 jsdom, HTTPS는 TestClient 기반이다.

## Risks and Next Owner
- 다음 담당: 실험플랫폼 총괄과 운영 담당자. 먼저 diff·검증 결과를 검토하고 운영 반영을 별도로 결정한다.
- 운영 설정: `ADMIN_USERNAME`, 생성된 `ADMIN_PASSWORD_HASH`, 충분한 난수 `AUTH_SESSION_SECRET`, `AUTH_COOKIE_SECURE=true`, SameSite=lax, 정확한 backend 허용 origin. 기존 Secret 주입 경로를 사용하고 비밀 값을 Git/대화에 남기지 않는다.
- 인증 설정 없이 새 코드를 배포하면 관리 API는 503으로 차단되므로 설정 준비와 배포 순서를 조율해야 한다. 설정을 지워서 공개 모드로 되돌리는 우회는 없다.
- 노출된 기존 키는 아직 유효하다. 배포 구현과 소비 서비스를 확인한 뒤 접근 통제·응답 키 제거 배포 → 새 키 발급/소비 서비스 전환 → 기존 키 폐기·검증 순서로 별도 수행한다. 현재 DB는 프로젝트당 키 하나이므로 무중단 이중 키 전환을 지원한다고 가정하지 않는다. 동시 전환/유지보수 시간 또는 별도 이중 키 설계가 필요하다.
- 현재 stateless 세션의 로그아웃은 브라우저 쿠키 삭제다. 탈취 토큰의 개별 서버 폐기는 없으며 필요 시 서명 secret 변경으로 전체 세션을 무효화한다. 로그인 시도 제한·공개 가입용 사용자 세션 체계는 후속 보강 대상이다.
- SDK 공개 경로의 기존 데이터 계약과 프로젝트 간 격리 문제는 이번 관리 인증 수정만으로 해결되지 않는다. Google 공개 가입 전 소유권·프로젝트 격리·키 권한 분리를 완료해야 한다.
- 안전한 복구는 관리 API 접근 통제를 유지하는 전진 수정 또는 운영 접근 제한을 전제로 한다. 인증 없는 이전 버전으로 단순 롤백하면 노출 문제가 재발한다.

## 폼 파서 라이브러리 후속 보강

DevFactory-Ops 보안 인계에 따라 같은 worktree에 적용했다. 기존 279개 테스트 결과는 이 변경의 검증으로 사용하지 않고 새 의존성 환경에서 다시 검증한다.

### 운영 기록 대조와 후보 버전

- 인계된 `security-hardening-20261026/deployed-package-inventory.json`의 운영 backend/frontend 태그는 모두 `ca7d7a0`이다. 이번 fetch 후 origin/main도 동일하다. 로컬 Ops checkout의 오래된 이미지 태그를 현재 운영 상태로 간주하지 않았다. 이번 작업에서 live cluster를 다시 조회하지 않았으므로 인계 이후 drift 여부는 배포 담당자가 재확인해야 한다.
- 인계된 backend image digest: `sha256:871ac05c3de32832d2b715996d65cfed42e612490f9d425655224a440b5a797a`. frontend: `sha256:187cd114b91e9120b82ae31b99ffce4f4dc33bcebd42df4e533ee76840d957cd`. 이는 관측 시점 기록이며 즉시 복구 대상으로 확정한 값이 아니다. 이전 backend는 무인증 취약점이 있어 단순 롤백하지 않는다.

| 패키지 | 이전 기준 | 검증 후보 |
|---|---|---|
| FastAPI | 운영 및 requirements 0.111.0 | 0.140.13 |
| Starlette | 운영 0.37.2, FastAPI 상한 <0.38 | 1.3.1 |
| Pydantic | requirements 2.7.4 | 2.13.4 |
| pydantic-settings | requirements 2.3.3 | 2.13.1 |
| python-multipart | 운영 0.0.32, requirements 무핀 | 0.0.32 고정 |
| pandas / scipy | 2.2.2 / 1.13.1 | 동일 유지 |
| NumPy | requirements에서 전이 의존성 | 해결된 2.2.6 고정 |

`requirements.txt`에는 Python 3.11에서 함께 해결한 직접·전이 의존성 버전을 정확히 고정했다. Starlette만 FastAPI 제약을 무시하고 교체하지 않았다. 모든 라이브러리/OS 취약점을 제거했다는 의미는 아니며 이번 범위는 인계된 Starlette 폼 파서 공지와 서비스 호환성이다.

근거: [multipart part-size 공지](https://github.com/Kludex/starlette/security/advisories/GHSA-f96h-pmfr-66vw), [스풀 rollover 공지](https://github.com/Kludex/starlette/security/advisories/GHSA-2c2j-9gv5-cj73), [URLencoded 제한 공지](https://github.com/Kludex/starlette/security/advisories/GHSA-82w8-qh3p-5jfq). 각각 패치 기준 0.40.0, 0.47.2, 1.3.1을 포함하는 후보를 사용했다.

### 처리 순서와 서비스 영향

- 새 FastAPI에서도 `request.form()`이 `solve_dependencies()`보다 먼저 호출됨을 설치 소스로 확인했다. 기존 관리 인증 middleware가 라우터보다 먼저 401/503을 반환하며, 무인증 업로드는 ASGI receive와 Request.form 호출 모두 0회임을 테스트했다. Depends 인증만으로 보호한다고 가정하지 않는다.
- 인증 통과 후 `UploadBodyLimitMiddleware`가 업로드 요청 전체를 최대 1MiB로 제한하고, 이 범위의 본문만 폼 파서에 전달한다. 실제 ASGI 다중 chunk와 거짓 Content-Length도 누적 크기로 제한한다. 제한 초과는 413이며 폼 파싱·R2 호출이 없다. 다른 API의 body 계약은 바꾸지 않았다.
- 1MiB는 **파일만의 크기가 아닌 multipart 헤더/구분자를 포함한 전체 요청 크기**다. 기존 공개 ingress 1MiB 제한을 유지하며 내부 직통 업로드에도 같은 상한을 추가한다. ingress 설정은 변경하지 않았다.
- 정상 multipart의 `file` 필드 및 name/key/type/url 응답을 유지했다. 빈 파일은 저장하지 않고 422를 반환하도록 변경했다. 누락·잘못된 입력은 400/422, 저장소 실패는 기존 500을 유지한다. 프런트는 기존 업로드 실패 경로를 사용한다.
- 새 FastAPI의 업로드 OpenAPI 표현에 기존 `format: binary`를 명시해 이전 파일 업로드 클라이언트 계약을 보존했다. 관리 경로 전수 검사는 새 라우터 내부 구조 대신 OpenAPI 경로 목록으로 순회하며 공개 예외 목록과 차단 검증을 유지한다.
- 라이브러리의 URLencoded/multipart 필드 수·part 크기 제한을 작은 합성 입력으로 검증했다. 스풀 rollover를 일으키는 write가 threadpool로 이동하는 것도 일회용 임시 파일로 확인했다.
- R2는 전 테스트에서 stub만 사용한다. 운영 업로드·공격성 요청·DB 변경·시크릿 변경·키 교체·배포는 수행하지 않았다.

### 변경 후 검증

- Python 3.11.17 격리 환경 `/tmp/experiment-security-py311`: 전체 backend **303 passed** (21.16초), `python -m pip check` 성공.
- 전체 frontend **18 files / 97 tests passed** 재실행. SDK TypeScript 및 frontend TypeScript/Vite production build 성공.
- 신규 검증: 업로드 정상/누락/빈 파일/잘못된 multipart/다수 필드/초과 파일·part/URLencoded/실제 chunk/경계값, 실패 시 upload·presign 미호출, 인증 전 body receive 0회, JSON 직렬화·검증 오류·OpenAPI·CORS·settings 타입. 기존 login/cookie/logout/키 비노출/SDK decide·track·Bearer 테스트도 새 환경에서 실행했다.
- Starlette TestClient의 httpx 사용 deprecated 경고와 기존 Pydantic class Config 경고가 있다. 경고를 숨기거나 새 테스트 클라이언트로 우회하지 않았다.
- 실제 backend Dockerfile로 로컬 이미지를 빌드한 뒤 `--network none` 컨테이너에서 `pip check` 성공 및 전체 backend **303 passed** (17.49초)를 확인했다. 이미지는 원격에 게시하지 않았다.
- 같은 이미지에서 실제 Uvicorn을 기동해 status 200 → 무인증 projects 401 → 로그인 200 → me 및 인증된 projects 200 → 로그아웃 200 → projects 401을 확인했다. 호스트 포트 공개 없이 컨테이너 내부 loopback만 사용했다. 단일 로컬 관측 지연은 로그인 약 65ms, 나머지 약 1–3ms이며 부하 성능 검증을 의미하지 않는다. 운영 D1/R2 연결 및 Pod readiness는 검증하지 않았다.

### 실제 배포 담당자 확인 사항

실제 배포 승인은 이번 작업에 포함되지 않는다. 배포 시 최신 digest와 복구 절차를 재확인하고, 배포 전후 root/status, 로그인·키 API, 오류율·지연·Pod readiness를 비교해야 한다. 로컬 테스트가 운영 DB/R2 연결 정상이나 무영향 배포를 보장하지 않는다. 기존 1MiB ingress 제한을 유지하고, 실패 시 취약 버전 재노출을 막는 접근 통제를 함께 고려한다.

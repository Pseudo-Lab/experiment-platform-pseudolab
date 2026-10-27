TLDR: BIN-4에서 인증 거절 응답의 캐시 금지를 보완했다(backend 304 / frontend 97). 이후 BIN-9에서 세션 상태 회귀 3건을 보완하고 backend 304 / frontend 100 및 실제 ARM64 컨테이너를 검증했다. 아래 BIN-4 결과와 후속 결과를 구분한다. 운영 배포·Secret 변경·키 전환/폐기는 미완료다.

Status: active
Last-Validated: 2026-10-27
Owner: 개발자
Project-ID: 2dfd8326-7ee3-46e8-96a2-12a7bcf31983
Task: [BIN-4](/BIN/issues/BIN-4) (04db23c9-6456-4ea2-b923-cda3f711b77f)

## 검증 결과

2026-10-27 14시대 KST 이번 실행에서 직접 확인했다. 과거 인계의 Docker/운영 관측을 이번 검증으로 계산하지 않았다.

| 검증 | 실행 명령 / 결과 |
|---|---|
| 수정 전 보안 후보 | `/tmp/experiment-security-py311/bin/python -m pytest backend/tests -q`: 303 passed, 14.71s |
| 새 회귀 재현 | `... -m pytest backend/tests/test_auth.py -q -k rejections`: 수정 전 1 failed (401의 no-store 누락) |
| 최종 전체 backend | `/tmp/experiment-security-py311/bin/python -m pytest backend/tests -q`: 304 passed, 6 warnings, 13.33s |
| 의존성 | 같은 Python의 `-m pip check` 성공; requirements의 36개 pin과 실제 설치 버전 모두 일치 |
| 별도 access overlay | `/tmp/bin-4-access-compat`에서 같은 Python으로 `-m pytest backend/tests/test_access_decision.py backend/tests/test_auth.py -q`: 32 passed, 3.21s |
| 전체 frontend | frontend에서 `npm test -- --run`: 18 files / 97 passed, 14.20s |
| SDK 빌드 | `npm run build --prefix packages/sdk`: TypeScript 성공 |
| frontend 빌드 | frontend에서 `npm run build`: TypeScript + Vite 성공, 2401 modules |
| 패치 형식 | `git diff --check` 성공; 배포 후보의 전체 패치를 ca7d7a0에 적용 가능한지 별도 검증 |

테스트의 D1은 SQLite 대체, R2 upload/presign은 mock이다. 실제 middleware를 통과하며 관리 route 전수 미인증 차단, 설정 누락 503, 로그인 성공/실패, 세션 만료/변조, 쿠키 Secure/HttpOnly/SameSite, Origin 거부, 관리자 쿠키와 project Bearer 권한 분리, 프로젝트 CRUD 키 비노출, 전용 키 API, 테스트 키 교체 후 이전 키 거절을 확인한다.

업로드는 무인증 시 ASGI receive 및 form parser 호출 0회, 전체 multipart 요청 1MiB 경계·초과, 거짓 Content-Length와 다중 chunk, 누락/빈 파일/잘못된 multipart/필드 수 초과/URLencoded, 저장소 실패 시 presign 미호출을 검증한다. 라이브러리는 form의 필드 수·part 크기 제한 및 spool rollover의 threadpool 처리를 검증한다. MIME 진위 검사·악성코드 스캔은 제공하지 않는다.

UI는 KO/EN 로그인·오류·재시도·세션 복원/만료·로그아웃 실패/성공, 키 empty/loading/error/retry/success와 프로젝트 전환 중 오래된 응답 무시를 포함한다. 실제 브라우저 E2E 대신 jsdom이다.

환경: 기존 Python 3.11 격리 venv를 사용했다. 새 런 npm 캐시가 비어 `npm ci --offline`은 ENOTCACHED로 실패했다. 기존 security worktree의 node_modules를 새 작업 트리에 복사한 뒤 검사했다. 실제 설치 frontend 338개, SDK 7개 패키지 버전은 lockfile과 일치했다(설치되지 않은 선택적 플랫폼 패키지는 제외). 깨끗한 네트워크 설치 재현성은 이번에 검증하지 않았다. Pydantic deprecation 6개, chart/Browserslist/번들 크기 경고는 남는다.

## 변경과 기존 작업 보존

- 결과 worktree: `/tmp/bin-4-security-review`, branch `fix/bin-4-security-review`, base `ca7d7a09a0bf99dae1d9e5bdf922ad921d105111`.
- 기존 `/home/ubuntu/.openclaw/workspace-experiment-security`의 tracked diff와 신규 구현/문서 15개 파일을 복사했다. 원본 security, login, root의 파일·index·미완료 merge를 수정하지 않았다. 신규 worktree 등록만 공유 Git metadata에 추가했다.
- 재사용 구현: `backend/app/main.py`의 관리 API 공통 fail-closed 인증/정확한 공개 경로, `core/auth.py`와 `endpoints/auth.py`, project 응답 모델의 키 제거 및 인증된 `/projects/{id}/api-key`, `core/upload.py` 1MiB 상한, 최신 라이브러리 pin, frontend 로그인/키 UI 및 API 쿠키 전달.
- 이번 추가 수정: `backend/app/main.py`가 일찍 반환하는 Origin 거절 403, 인증 설정 누락 503, 세션 없음 401에도 `Cache-Control: no-store`를 넣었다. 성공 응답뿐 아니라 거절 응답도 저장하지 않는 기존 의도를 일관되게 적용한다.
- 추가 회귀: `backend/tests/test_auth.py::test_auth_rejections_are_never_cacheable`.
- 전체 재사용 패치의 상세 배경은 `2026-10-26-urgent-admin-security.md`를 참고한다. 그 문서의 과거 실행 결과는 이번 결과와 구분한다.
- 커밋·원격 push·PR·merge를 수행하지 않았다. 전체 패치가 리뷰 산출물이며 새 로그인 구현을 중복 작성하지 않았다. 집계 정책 기능을 변경하지 않았다.

## ca7d7a0 / 92e468a / 로그인 관계

security HEAD는 ca7d7a0, login HEAD는 210f013이며 login에는 staged upstream 병합과 unstaged 보완이 남아 있다. login 인계의 설정 전부 없음 → 관리 API 공개 동작은 security의 설정 없음 → 503 동작으로 대체되어 있다. login 트리를 통째로 다시 병합하면 과거 동작·UI가 섞일 수 있다.

| 계약 | ca7d7a0 기반 보안 후보 | 로컬 main 92e468a |
|---|---|---|
| request | flag_key, user_id, route | policy_key, subject_id, resource_key |
| policy payload | access_mode, committee_segment_id, routes | access_policy: mode, segment_id, resource_keys |
| response | access_mode: private/committee/public | policy_mode: closed/segment/authenticated |
| 인증 | 필수 project Bearer, 관리자 세션으로 대체 불가 | 동일 |

92e468a의 access schema/service/test 3개 파일을 **별도 임시 복사본**에 적용했다. 해당 계약에 맞춰 auth 회귀의 테스트 입력 1곳만 policy_key/subject_id로 바꾸고 32개를 통과시켰다. 이는 보안 middleware와 두 계약의 공존 가능성 확인이며, 두 계약이 wire-compatible하다는 뜻이 아니다. 해당 overlay는 배포 후보/전체 패치에 포함하지 않았다. ca7d7a0 쪽 최신 UI를 92e468a로 되돌리지 않았고 원격 HEAD/운영 drift는 조회하지 않았다. 릴리스 owner는 실제 대상 base를 확정한 후 필요 시 access 변경을 별도 검토해야 한다.

## 라이브러리 근거

이번에 원문을 다시 확인했다. Starlette 1.3.1 pin은 다음 공지의 패치 기준을 포함한다. 전체 의존성/OS 취약점 부재를 보증하는 감사는 아니다.

- [multipart 필드 제한, 패치 0.40.0](https://github.com/Kludex/starlette/security/advisories/GHSA-f96h-pmfr-66vw)
- [spool rollover, 패치 0.47.2](https://github.com/Kludex/starlette/security/advisories/GHSA-2c2j-9gv5-cj73)
- [URLencoded 제한, 패치 1.3.1](https://github.com/Kludex/starlette/security/advisories/GHSA-82w8-qh3p-5jfq)

## Ops 인계: 설정·순서·검증·복구

필수 이름: `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `AUTH_SESSION_SECRET`. 쿠키/Origin: `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAMESITE=lax`, `AUTH_SESSION_TTL_SECONDS`, `AUTH_COOKIE_NAME`, `BACKEND_CORS_ORIGINS`의 정확한 HTTPS origin. 기존 D1/R2 설정은 유지한다. 설정 값은 이 보고서/패치/로그에 포함하지 않는다. 비밀번호 해시 생성은 backend에서 `python -m scripts.hash_admin_password`를 사용한다. 운영 주입은 승인된 Secret/SealedSecret/ESO 경로로 별도 처리한다.

1. 릴리스 owner가 대상 commit/base와 이 diff를 검토한다. frontend와 backend를 함께 반영할 릴리스를 구성한다. migration은 추가하지 않았다.
2. Ops가 별도 승인 범위에서 Secret 주입 준비, TLS/동일 호스트 reverse proxy, 정확한 origin, ingress 1MiB, 관리자 계정 전달 방법을 확인한다. `/admin/srm-check` 등 기존 무인 관리 호출의 세션 요구도 확인한다.
3. 설정 준비 후 backend/frontend를 반영한다. 비인증 projects 및 키 API 401, 설정 누락 환경 503, 로그인/me/인증된 CRUD·키 조회 성공, 일반 프로젝트 응답 키 부재, 불허 Origin 403, 로그아웃 후 401을 확인한다. SDK/Bearer 및 정상/초과 업로드 회귀도 확인한다.
4. root/status와 Pod readiness, 오류율/지연, 실제 D1/R2 연결을 전후 비교한다. 정상 사용자의 로그인/CRUD 실패, readiness 실패, 오류율/지연 악화 시 진행을 중단한다.
5. 복구는 관리 경로 차단을 유지한 전진 수정 또는 외부 접근 제한을 동반한 롤백이다. 인증 없는 ca7d7a0 backend로 단순 복귀하거나 auth 설정을 제거해 해결하지 않는다.
6. 기존 노출 키 교체/소비 서비스 전환/폐기는 별도 승인과 작업이다. 현재 프로젝트당 키 하나라 이중 키 무중단 전환을 가정하지 않는다.

## 잔여 위험·미검증·다음 조치

- 앱 구현·로컬 회귀·리뷰 산출물 정리는 완료. 이번 범위의 차단 요인은 없다.
- 운영 미배포이므로 운영 취약점 해소 완료가 아니다. 실제 키는 여전히 유효할 수 있다.
- 단일 관리자 모델이며 사용자별 권한·프로젝트 격리, SDK 공개/optional-key 기존 계약, 로그인 rate limiting, 탈취 세션의 개별 서버 폐기는 해결하지 않는다. 공개 가입 서비스를 열 수 있는 보안 모델로 간주하지 않는다.
- 실브라우저/운영 HTTPS E2E, 실제 D1/R2, 컨테이너 재빌드·ARM64/Pod readiness, 부하/동시 요청, 전체 취약점 audit는 이번 미검증이다. 이전 인계의 Docker 성공은 과거 증적이다.
- 다음 담당: 릴리스 owner는 대상 base 및 diff 리뷰, Ops는 별도 승인 후 위 설정/운영 smoke와 배포 판단. 앱 범위 추가 작업 예상 0; 리뷰와 staging smoke는 환경·권한 준비 후 약 1–2시간 추정이며 운영 일정은 별도 결정이다.


## BIN-9 후속 검증 및 BIN-13 리뷰 게시 준비 (2026-10-27)

Project-ID: `2dfd8326-7ee3-46e8-96a2-12a7bcf31983`.
입력: [BIN-9 report](/BIN/issues/BIN-9#document-report), [container-verification](/BIN/issues/BIN-9#document-container-verification).
게시 작업: [BIN-13](/BIN/issues/BIN-13).

- BIN-9는 늦은 이전 요청의 401이 새 로그인을 종료하는 문제, 오래된 세션 복원 응답이 만료 상태를 덮어쓰는 문제, URL의 `/auth/` 부분문자열 때문에 관리 요청의 401 처리를 건너뛰는 문제를 회귀 재현 후 수정했다. 세션 revision과 정확한 origin/path 판별을 사용한다. 서버 권한 모델을 바꾸지는 않았다.
- BIN-9 실행 결과: backend 304 passed, frontend 18 files / 100 passed, SDK 및 frontend build 성공. BIN-4의 frontend 97 및 별도 access overlay 32 결과와 구분한다.
- BIN-9의 16:10 KST 컨테이너 증거: 새 의존성 설치를 포함한 실제 linux/arm64 backend/frontend Docker build 성공. 네트워크 없는 backend 컨테이너에서 304 passed 및 pip check 성공, frontend Nginx 설정 검사와 `/`, `/login` HTTP 200 확인. host port 공개·registry push·운영 배포는 하지 않았다. 위 BIN-4 시점의 컨테이너 미검증 항목은 이 로컬 ARM64 범위에 한해 해소되었다.
- BIN-13은 수정 전 314개 소스 경로와 BIN-9 해시의 일치 및 컨테이너 로그 5개 해시를 확인했다. 이 인계 문서만 최신화하며, 테스트와 빌드 수치는 BIN-9 증거를 인용한다. BIN-13에서 전체 테스트/빌드를 재실행한 결과가 아니다.
- 후보 branch는 `fix/bin-9-security-review-20261027`, base는 `ca7d7a09a0bf99dae1d9e5bdf922ad921d105111`. 로컬 main `92e468a`의 접근정책 계약은 포함하지 않았다. 기존 `feature/admin-login` PR #12와 인증/UI 구현이 중복되며, 설정 누락 시 공개되는 과거 동작은 이 후보의 503 fail-closed 동작으로 대체한다. 두 구현을 통째로 병합하지 말고 리뷰에서 대체 관계를 판단한다.
- 실제 운영 HTTPS/브라우저, D1/R2, Pod readiness, Secret 주입 및 기존 키 전환/폐기는 미완료다. D1/SQLite·R2 mock·jsdom 검증의 한계도 유지한다. 복구 시 관리 경로 차단을 유지하며 인증 없는 이전 backend로 단순 rollback하지 않는다.
- BIN-13 허용 범위는 새 커밋·해당 branch push·main 대상 draft PR 및 CI 조회다. main merge, gitops-ci 수동 실행, 이미지/태그/release 게시 및 운영 변경은 제외한다. 실제 원격 게시 여부와 CI는 BIN-13 report를 기준으로 확인한다.

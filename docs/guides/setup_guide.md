Status: active
Last-Validated: 2026-03-14

# 🚀 개발 환경 세팅 가이드 (Docker Setup Guide)

이 문서는 가짜연구소 실험 플랫폼 프로젝트의 로컬 개발 환경을 구축하기 위한 공식 가이드입니다. 
프로젝트는 일관된 개발 환경을 위해 **Docker Compose**를 사용합니다.

## 📌 필수 사전 설치 (Prerequisites)
- [Git](https://git-scm.com/downloads)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (또는 Docker CLI & Docker Compose)
- [Node.js](https://nodejs.org/) (v18 이상 권장 - 로컬 NPM 스크립트 실행용)
- [Python](https://www.python.org/downloads/) (3.11 이상 권장 - 로컬 린팅 및 IDE 지원용)

## 🛠️ Step-by-Step 세팅 방법

### 1단계: 레파지토리 클론 및 폴더 이동
```bash
git clone https://github.com/Pseudo-Lab/experiment-platform-pseudolab.git
cd experiment-platform-pseudolab
```

### 2단계: 환경 변수(.env) 설정
루트 디렉토리 및 `backend/` 디렉토리에 필요한 `.env` 파일을 설정해야 합니다.
(보안 정보가 포함된 `.env` 파일은 '성장 시스템 프로젝트 자료실'이나 카카오톡 공유 문서를 참조해 주세요.)

```bash
# 서버 환경변수 템플릿 복사
cp backend/.env.sample backend/.env

# 이후 backend/.env 파일을 열어 Cloudflare 관련 키 등을 입력합니다.
```

### 3단계: Docker Compose 빌드 및 실행
단일 명령어로 프론트엔드와 백엔드 컨테이너를 동시에 띄웁니다.

```bash
# 첫 실행 및 이미지 빌드
docker compose up --build -d

# 백그라운드 구동 확인
docker compose ps
```

### 4단계: 서비스 동작 확인
- **Frontend (React)**: [http://localhost:5173](http://localhost:5173)
- **Backend (FastAPI)**: [http://localhost:8000/api/v1/status/](http://localhost:8000/api/v1/status/)
- **API Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)

## 💡 자주 발생하는 문제해결 (Troubleshooting)

**Q: `docker-compose: command not found` 에러가 발생해요.**
A: 최신 Docker 버전에서는 `docker-compose` 명령어 대신 띄어쓰기를 넣은 `docker compose` 명령어를 사용합니다. (하이픈 제외)

**Q: 포트 충돌(Port already in use)이 납니다.**
A: 프로젝트는 기본적으로 `5173`(프론트엔드), `8000`(백엔드) 포트를 사용합니다. 해당 포트를 점유 중인 다른 프로세스를 종료하거나 `docker-compose.yml`에서 바인딩 포트를 수정하세요.

**Q: 컨테이너 내부 로그는 어떻게 보나요?**
A: `docker compose logs -f [서비스명]` 명령어로 실시간 로그를 확인할 수 있습니다.
- `docker compose logs -f experiment-platform-pseudolab-backend`
- `docker compose logs -f experiment-platform-pseudolab-frontend`

---
*도움이 필요하다면 프로젝트 카카오톡 채널에 언제든지 문의해 주세요!*


## 관리자 로그인 설정

관리 API는 단일 관리자 세션으로 보호한다. 설정이 전부 없거나 일부만 있으면 관리 API는 503으로 차단되며, 설정 완료 후 세션이 없으면 401을 반환한다. 공개 가입이나 사용자별 프로젝트 권한은 아직 지원하지 않는다.

1. backend 환경에 `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `AUTH_SESSION_SECRET`을 설정한다. 비밀번호 해시는 backend 디렉터리에서 `python -m scripts.hash_admin_password`를 실행해 만든다. 서명 secret은 충분한 난수로 별도 생성한다. 실제 값은 문서·커밋·대화에 남기지 않는다.
2. HTTPS 운영에서는 `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAMESITE=lax`를 사용한다. 기본 세션 만료는 12시간이다. 같은 호스트의 `/api` 프록시를 권장한다.
3. 별도 프런트 origin을 사용하면 `BACKEND_CORS_ORIGINS` JSON 배열에 scheme·host·port가 정확히 일치하는 origin을 넣는다. `*`는 기존 SDK CORS 호환을 위한 값이며 관리자 요청을 허용하지 않는다. 프록시 뒤에서는 외부 HTTPS origin 또는 올바른 forwarded scheme 설정을 확인한다.
4. `/login`에서 로그인한 뒤 관리 기능을 사용한다. 일반 프로젝트 조회·생성·수정 응답에는 API 키가 없다. SDK 연동 화면은 인증된 `GET /api/v1/projects/{project_id}/api-key`로 키를 조회한다. 키 응답은 `Cache-Control: no-store`다.

기존 프로젝트 키는 SDK와 `/access/decide`의 Bearer 인증에 함께 사용되므로 공개 브라우저 전용 키로 취급하지 않는다. 키 분리·교체는 연결 서비스를 확인하고 별도 전환 절차로 수행한다. `/admin/srm-check` 등 기존 무인 관리 호출도 이제 관리자 세션이 필요하므로 호출 담당자가 확인해야 한다. SDK·회고 외부 경로의 기존 인증 계약은 유지한다.

상세 검증과 운영 전환 순서는 `docs/reports/handoffs/2026-10-26-urgent-admin-security.md`를 참고한다.


### Google 로그인과 호스트 전환

Google 로그인을 활성화한 설치는 계정별 프로젝트 소유권을 사용한다. 위 관리자 전용 설명은 초기 도입 당시 기준이다. 서버 자격증명은 공개 SDK 키와 분리된 credential을 사용한다.

- 자체 호스팅은 자기 HTTPS origin을 사용한다. frontend 기본 `/api/v1`, SDK의 명시적 API base 설정, `.env.sample`의 예시 도메인을 운영 도메인으로 하드코딩하지 않는다.
- Iterglow canonical 설정은 `GOOGLE_OAUTH_REDIRECT_URI=https://iterglow.pseudolab-devfactory.com/api/v1/auth/google/callback`, `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAMESITE=lax`다. 동일 Web client의 Google 허용 redirect URI에 새 주소를 추가하고 기존 URI는 전환 검증 전 유지한다. 저장한 client JSON을 다시 발급하거나 덮어쓸 필요는 없다.
- `BACKEND_CORS_ORIGINS`는 기존 허용 origin을 보존한 상태에서 `https://iterglow.pseudolab-devfactory.com`을 추가한다. 전환 중 기존 `https://exp.pseudolab-devfactory.com`도 유지한다. 전체 목록을 이 두 개로 임의 축소하지 않는다.
- OAuth 시도 쿠키·세션 쿠키는 host-only이고 복귀 경로의 sessionStorage도 origin별이다. 기존 로그인 상태와 복귀 경로는 새 호스트로 이동하지 않는다. 새 canonical에서 로그인하는 흐름을 사용하며 쿠키 Domain을 상위 도메인으로 넓히지 않는다.
- 앱의 Google 시작 GET은 검증된 callback 설정에서 파생한 고정 canonical로만 이동하며, canonical에서만 OAuth state/cookie를 만든다. `/login`과 관리자 POST, SDK/API, callback 경로 전체를 redirect하지 않는다. old host는 향후 폐기 대상이며 old 로그인 성공·호스트 간 복귀는 출시 조건이 아니다. 기존 DNS/Ingress/API는 새 로그인·SDK 확인 후 별도 폐기 단계에서 정리한다.

이 설정은 운영 전환 완료를 뜻하지 않는다. provider inactive 앱 배포 뒤 새 origin CORS와 Google 설정을 활성화해야 한다. Origin 검증 완화로 우회하지 않는다.

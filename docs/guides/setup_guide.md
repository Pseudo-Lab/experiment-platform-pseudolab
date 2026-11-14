Status: active
Last-Validated: 2026-11-15

# 설치 및 개발 환경

Iterglow는 서비스별 사용자 배정, 실제 노출·행동 수집과 결과 비교를 지원하는 범용 실험 플랫폼입니다. 이 가이드는 자신의 Cloudflare 리소스로 백엔드와 개발 화면을 실행하는 방법을 설명합니다.

## 준비

- Git, Python 3.11, Node.js 22 및 npm
- 자신의 Cloudflare 계정, 개발용 D1 데이터베이스 및 API token
- 첨부파일 기능을 사용할 경우 자신의 R2 bucket과 S3 API 자격증명
- Docker Compose: 아래 백엔드 컨테이너 경로 사용 시에만 필요

SDK를 기존 설치에 연결하려면 서버 설치 대신 [SDK 가이드](../../packages/sdk/README.md)를 참고합니다.

## 1. 저장소와 의존성 준비

```bash
git clone https://github.com/Pseudo-Lab/experiment-platform-pseudolab.git
cd experiment-platform-pseudolab
cp backend/.env.sample backend/.env
python3.11 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
npm ci --prefix packages/sdk
npm run build --prefix packages/sdk
npm ci --prefix frontend
```

기존 `.env`가 있는 경우 복사 대신 필요한 설정만 비교·추가합니다. 프런트엔드의 SDK 의존성은 `file:../packages/sdk`이므로 SDK를 먼저 준비합니다.

## 2. 자신의 데이터 저장소 연결

[데이터 접근 가이드](data_access.md)에 따라 개발용 리소스를 생성하고 `backend/.env`에 설정합니다.

| 설정 | 값의 출처 및 용도 |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | 자신의 Cloudflare 계정 ID |
| `CLOUDFLARE_API_TOKEN` | 해당 계정의 D1 읽기·쓰기 권한을 가진 token |
| `D1_DATABASE_ID` | 실험·프로젝트·수집 이벤트를 저장할 자신의 D1 database ID |
| `D1_MAIN_DATABASE_ID` | 기존 query segment·조직 대시보드용 소스 D1. 해당 기능 사용 시 필요 |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | 첨부파일 기능 사용 시 자신의 bucket에 대한 S3 API 설정 |

### 새 DB 초기화의 현재 제한

현재 앱은 D1 REST API를 사용하며 로컬 SQLite·Wrangler DB로 자동 대체하지 않습니다. 빈 D1에는 [마이그레이션](../../backend/migrations/)의 스키마가 필요합니다.

이 디렉터리에는 과거 서비스의 seed와 기존 설치를 전제로 한 변경도 포함돼 있습니다. 빈 SQLite에 전체 파일을 순서대로 적용한 확인에서는 `024_demo_app_placements.sql`의 외래키 제약으로 중단됐습니다. 기존 `run_migration.sh`는 줄 끝 세미콜론으로 SQL을 나누므로 여러 문장을 포함하는 trigger에도 적합하지 않습니다. **전체 migration 일괄 실행은 새 설치의 검증된 초기화 절차가 아닙니다.**

자신의 개발용 D1에서 파일별 스키마·seed·선행 조건을 검토하고 완전한 SQL 문장 단위로 적용해야 합니다. [D1 공식 가이드](https://developers.cloudflare.com/d1/get-started/)의 SQL 파일 실행 방법을 참고합니다. 새 DB bootstrap 자동화는 별도 보완이 필요한 상태이며, 서버 기동만으로 DB 초기화 완료를 판단하지 않습니다.

## 3. 관리자 인증 설정

백엔드 디렉터리에서 비밀번호 해시와 세션 서명용 난수를 각각 생성합니다.

```bash
cd backend
source .venv/bin/activate
python -m scripts.hash_admin_password
python -c 'import secrets; print(secrets.token_hex(32))'
```

출력값을 자신의 `backend/.env`에 저장합니다. 실제 값을 문서·이슈·커밋에 붙여 넣지 않습니다.

```dotenv
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH='replace-with-generated-password-hash'
AUTH_SESSION_SECRET='replace-with-generated-random-secret'
PASSWORD_LOGIN_ENABLED=true
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_SAMESITE=lax
BACKEND_CORS_ORIGINS='["http://localhost:5173"]'
```

해시에는 `$`가 포함되므로 `.env`에서 작은따옴표로 감쌉니다. placeholder는 생성값으로 교체합니다. `AUTH_COOKIE_SECURE=false`는 로컬 HTTP용이며 HTTPS 운영에는 `true`가 필요합니다. 관리 API는 인증 설정 부족 시 차단되며, 설정된 설치의 미인증 요청은 401로 거부됩니다.

## 4. 백엔드 및 화면 실행

백엔드 디렉터리와 활성화한 가상환경에서 실행합니다.

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

다른 터미널의 저장소 루트에서 프런트엔드를 실행합니다.

```bash
cd frontend
VITE_API_BASE_URL=http://localhost:8000/api/v1 npm run dev -- --host 127.0.0.1
```

- 화면 및 로그인: `http://localhost:5173/login`
- 상태: `http://localhost:8000/api/v1/status/`
- API 문서: `http://localhost:8000/docs`

브라우저는 `localhost`를 사용하고 CORS origin의 scheme·host·port를 맞춥니다. `/status/` 성공은 프로세스 응답 확인이며 D1 스키마·쓰기·SDK 연결의 성공을 보장하지 않습니다. 관리자 로그인 후 프로젝트 조회·생성과 자신의 프로젝트 공개 SDK 키를 사용한 수집까지 따로 확인합니다.

### 백엔드를 Docker로 실행하는 경우

동일한 `.env` 준비 후 저장소 루트에서 백엔드 서비스만 실행할 수 있습니다.

```bash
docker compose up -d --build experiment-platform-pseudolab-backend
docker compose logs -f experiment-platform-pseudolab-backend
```

프런트엔드는 위 npm 경로를 사용합니다. 백엔드 가상환경 실행과 컨테이너 실행은 동시에 하지 않습니다.

기존 개발용 Compose는 프런트엔드 build context에 형제 `packages/sdk`를 포함하지 않습니다. 기본 Compose의 정적 프런트엔드 이미지도 `/api` 프록시를 제공하지 않습니다. 따라서 두 Compose 파일의 전체 실행을 완성된 자체 호스팅 경로로 안내하지 않습니다. 배포 시에는 자신의 HTTPS 호스트에서 정적 화면과 백엔드 `/api`를 연결하는 reverse proxy 구성이 필요합니다.

## 5. Google 로그인과 운영 설정

Google 로그인은 선택 설정입니다. 사용하는 경우 자신의 Google Cloud Web OAuth client를 만들고 다음을 설정합니다.

- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI=https://platform.example.com/api/v1/auth/google/callback`: 예시 호스트를 실제 HTTPS origin으로 교체하고 Google client의 허용 redirect URI에 동일하게 등록
- `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAMESITE=lax`
- 별도 프런트 origin 사용 시 `BACKEND_CORS_ORIGINS`에 정확한 origin 추가. wildcard는 관리자 인증 origin의 대체 수단이 아님

계정별 프로젝트 소유권은 Google 로그인 계정을 사용합니다. 설치 관리자는 실제 계정 확인 후 `ADMIN_ACCOUNT_ID`로 명시적으로 선택하며 첫 가입자를 자동 승격하지 않습니다. Google 관리자 로그인과 복구 경로 확인 후에만 `PASSWORD_LOGIN_ENABLED=false`를 사용합니다. 이 설정은 기존 비밀번호 세션도 거부합니다.

공개 SDK 키는 브라우저 연동용이며 서버 credential·설치 관리자 세션과 구분합니다. 서버 credential을 브라우저에 넣지 않습니다. 쿠키는 host-only이므로 호스트 변경 시 새 호스트에서 다시 로그인해야 합니다.

## 문제 보고

[GitHub Issues](https://github.com/Pseudo-Lab/experiment-platform-pseudolab/issues)에 사용 버전, 재현 명령, 오류 상태를 기록합니다. 실제 키·토큰·사용자 데이터는 제외합니다. 새 DB 초기화와 Compose의 위 제한도 설치 시 구분해서 확인합니다.

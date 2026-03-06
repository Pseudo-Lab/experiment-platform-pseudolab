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
git clone https://github.com/Pseudo-Lab/DevFactory-Ops.git  # 또는 실제 실험플랫폼 repo 주소
cd workspace-experiment
```

### 2단계: 환경 변수(.env) 설정
루트 디렉토리 및 `server/` 디렉토리에 필요한 `.env` 파일을 설정해야 합니다.
(보안 정보가 포함된 `.env` 파일은 '성장 시스템 프로젝트 자료실'이나 카카오톡 공유 문서를 참조해 주세요.)

```bash
# 서버 환경변수 템플릿 복사
cp server/.env.sample server/.env

# 이후 server/.env 파일을 열어 SUPABASE 관련 키 등을 입력합니다.
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
- `docker compose logs -f devfactory-backend`
- `docker compose logs -f devfactory-frontend`

---
*도움이 필요하다면 프로젝트 카카오톡 채널에 언제든지 문의해 주세요!*

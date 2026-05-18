Status: active
Last-Validated: 2026-05-18

# 🗄️ 데이터 인프라 접근 및 연동 가이드 (Data Access Guide)

본 프로젝트는 가짜연구소의 커뮤니티 활동 데이터(디스코드/깃허브)를 활용합니다.
이 문서는 각 파트(특히 Data Engineer, Analyst)가 핵심 데이터 저장소에 접근하고 활용하기 위한 가이드라인입니다.

> **참고**: Supabase(성장 시스템 운영 raw DB)는 실험 플랫폼과 feature flag 분석에서 직접 활용하지 않습니다.
> 성장 시스템 데이터가 필요한 경우 별도 ETL, export, 또는 제한된 동기화 파이프라인을 통해 D1 기준 데이터로 사용합니다.

## 1. Cloudflare D1 / Workers (Discord & GitHub 데이터)

커뮤니티 내 유저 활동량, 메시지 발행, 커밋 기록 등은 Cloudflare 생태계(Worker 봇, D1 등)를 통해 수집/적재되고 있습니다.

### 🔑 접근 방법
- **Dashboard URL**: [Cloudflare Dashboard](https://dash.cloudflare.com/)
- **계정**: Cloudflare 권한이 부여된 이메일
- **Wrangler (CLI)**
  ```bash
  # Cloudflare CLI 설치 및 로그인
  npm install -g wrangler
  wrangler login
  ```

### 📊 목적 및 활용 정책
- **실시간 스트리밍**: 디스코드봇 등을 통해 수집되는 이벤트를 Cloudflare Workers를 사용해 D1에 적재합니다.
- **DB 구성**: `pseudolab-main` (Discord/GitHub 원천), `pseudolab-exp` (실험 플랫폼 메타데이터)
- **Feature flag segment**: query-backed segment refresh는 `pseudolab-main`을 `D1_MAIN_DATABASE_ID`로 참조하며, 서버에 등록된 allowlisted query template만 실행합니다.

---

## 2. 로컬 환경에서의 데이터 연동 테스트

개발 및 로컬 데스크탑 환경에서는 **절대 프로덕션 데이터베이스에 직접 쓰기 로직을 테스트하지 마세요.**
안전한 개발을 위해 아래 원칙을 준수합니다.

1. **권한 제어**: API 서버는 D1 REST API를 통해 읽기 전용으로 대시보드 데이터를 조회합니다.
2. **Mocking**: 데이터 파이프라인이 준비되지 않았을 때는 `backend/app/services/experiment.py`와 같이 Mock 데이터를 임시 활용합니다.

---
*추가 접근 권한이 필요할 경우 soo(Head)에게 요청해주세요.*

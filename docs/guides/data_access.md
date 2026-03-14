Status: active
Last-Validated: 2026-03-14

# 🗄️ 데이터 인프라 접근 및 연동 가이드 (Data Access Guide)

본 프로젝트는 가짜연구소의 기존 데이터(노션/성장 시스템, 디스코드/깃허브)를 적극적으로 활용합니다.
이 문서는 각 파트(특히 Data Engineer, Analyst)가 핵심 데이터 저장소에 접근하고 활용하기 위한 가이드라인입니다.

## 1. Supabase (Notion & 성장 시스템 데이터)

가짜연구소 핵심 활동 데이터 및 성장 시스템 기록은 Supabase(PostgreSQL 기반)에 적재되어 있습니다.

### 🔑 접근 방법
- **Dashboard URL**: [Supabase Project Dashboard](https://app.supabase.com/)
- **계정**: 관리자 초대를 받은 가짜연구소 이메일/GitHub 계정
- **Connection String**: (`.env` 파일 참조)
  ```
  DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[db_name]
  ```

### 📊 목적 및 활용 정책
- **읽기(Read)**: `growth_system_logs`, `notion_pages` 등 기존 적재 데이터는 **Read-Only** 형식으로 조회 및 분석 용도로만 사용합니다.
- **쓰기(Write)**: 새로 구축하는 실험 메타데이터(`experiments`, `experiment_variants` 등) 테이블은 **별도의 전용 스키마**를 생성하여 실험 플랫폼 백엔드가 CRUD를 수행합니다.

---

## 2. Cloudflare D1 / Workers (Discord & GitHub 데이터)

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
- **실시간 스트리밍**: 디스코드봇 등을 통해 수집되는 이벤트를 Cloudflare Workers를 사용해 필터링 후 Supabase DW로 넘깁니다.
- **Join 로직**: Cloudflare의 커뮤니티 계정 ID(Discord ID)와 Supabase의 성장 시스템 계정 ID를 매핑하는 작업이 ETL의 핵심입니다.

---

## 3. 로컬 환경에서의 데이터 연동 테스트

개발 및 로컬 데스크탑 환경에서는 **절대 프로덕션 데이터베이스에 직접 쓰기 로직을 테스트하지 마세요.**
안전한 개발을 위해 아래 원칙을 준수합니다.

1. **로컬 마이그레이션**: Supabase CLI를 활용해 최신 스키마 덤프를 로컬 DB에 올려 테스트합니다 (`supabase start`).
2. **권한 제어**: API 서버에는 철저히 Service Role Key 대신 Row Level Security(RLS)가 적용된 제한적 쿼리만 허용합니다.
3. **Mocking**: 타겟 데이터 파이프라인(Cloudflare 등)이 준비되지 않았을 때는 `backend/app/services/experiment.py`와 같이 Mock 데이터를 임시 활용합니다.

---
*추가 접근 권한이 필요할 경우 KiSH(Head)에게 요청해주세요.*

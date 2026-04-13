# 실험 플랫폼 기반 개발 계획

> 최초 작성: 2026-04-08 | 최종 업데이트: 2026-04-13 (2차)
> 목적: 분석가 실험 설계 병행 중, 플랫폼 개발 선행 항목 정의 및 관리

---

## 배경

분석가들이 성장 시스템 데이터를 기반으로 실험을 설계하는 동안, 개발 측에서 선행 구축할 수 있는 기반 요소들을 정의한다. 분석 설계와 개발이 블로킹 없이 병렬로 진행될 수 있도록 인터페이스 중심으로 설계한다.

---

## 기술 스택

| 레이어 | 도구 | 역할 |
|---|---|---|
| 프론트엔드 | Lovable (Vite + React) | UI, 실험 변형 분기 |
| 백엔드 API | FastAPI (Python) | 실험 로직, 통계 분석 |
| 실험 플랫폼 DB | Cloudflare D1 (`pseudolab-exp`) | experiments, variants, assignments |
| 데이터 웨어하우스 | Cloudflare D1 (`pseudolab-main`) | 데이터 엔지니어 피처 테이블 |
| 성장 시스템 DB | Supabase (`zizxaljzqmfcwgjeiwvn`) | lvup 원천 데이터 (읽기 전용) |
| 분석가 접근 | PostgreSQL 읽기 전용 계정 | `initiative_analyst_reader` — 57개 테이블 |

---

## DB 구조

```
lvup (Supabase)          → 유저 원천 데이터 (읽기만)
                            xp_history, project_attendance, user_badges 등 57개 테이블

Cloudflare D1
  pseudolab-main         → 커뮤니티 데이터 (Discord, GitHub)
                            향후: 데이터 엔지니어가 lvup 기반 피처 테이블 추가 예정
  pseudolab-exp          → 실험 플랫폼 메타데이터 (읽기/쓰기)
                            experiments, experiment_variants, experiment_assignments ✅

실험 분석                 → pseudolab-exp (할당 기록)
                           + lvup Supabase 또는 pseudolab-main 피처 테이블 (결과 지표)
                           를 조인해서 실험 결과 도출
```

---

## API 아키텍처

서버는 단일 FastAPI 인스턴스, 라우터 단위로 모듈 분리. 트래픽 증가 시 라우터 단위로 분리 가능.

```
backend/app/
  api/v1/endpoints/
    experiments.py  ← CRUD + 유저 할당 (/api/v1/experiments)
    dashboard.py    ← 활동 대시보드 (/api/v1/dashboard)
    status.py       ← 헬스체크 (/api/v1/status)
  db/
    d1.py           ← Cloudflare D1 클라이언트
    supabase.py     ← Supabase 클라이언트 (lvup 조회용)
  services/
    experiment.py   ← 실험 CRUD + 결정론적 할당 로직
```

**실험 할당 흐름:**
```
GET /api/v1/experiments/{id}/assign/{user_id}
  → 해시 기반 결정론적 배정
  → experiment_assignments 테이블에 기록
  → variant 정보 반환
```

---

## 선행 개발 항목

### 1. 분석가용 DB 접근 레이어

**상태:** ✅ 완료 (2026-04-10)

- 계정: `initiative_analyst_reader` (읽기 전용)
- 접근 범위: 전체 81개 테이블 중 개인정보 제외 **57개**
- 스크립트: `create_analyst_role.sql` (적용 완료)

---

### 2. 실험 메타데이터 스키마 + CRUD API + 테스트

**상태:** ✅ 완료 (2026-04-13)

`pseudolab-exp` D1에 테이블 생성 완료. FastAPI CRUD API 구현 완료.

**테이블:**
```sql
experiments          -- 실험 정의 (id, name, hypothesis, status, start_at, end_at)
experiment_variants  -- 변형군 (id, experiment_id, name, traffic_ratio)
experiment_assignments -- 유저 할당 기록 (experiment_id, user_id, variant_id, assigned_at)
```

**엔드포인트:**
```
GET    /api/v1/experiments           ← 목록 (status 필터링 지원)
POST   /api/v1/experiments           ← 실험 생성 (variants 포함, traffic_ratio 합계 검증)
GET    /api/v1/experiments/{id}      ← 상세
PATCH  /api/v1/experiments/{id}      ← 수정 (상태 변경 포함)
DELETE /api/v1/experiments/{id}      ← 삭제
GET    /api/v1/experiments/{id}/assign/{user_id}  ← 유저 변형군 배정
```

**테스트:** `backend/tests/test_experiments.py` — 18개 케이스 (CRUD, 필터, 할당, traffic_ratio 검증)

---

### 3. 결정론적 사용자 할당

**상태:** ✅ 완료 (2026-04-13, `services/experiment.py`에 구현)

같은 유저+실험은 항상 같은 변형군으로 배정. 해시 기반 알고리즘으로 DB 조회 없이 계산 후 기록.

```python
bucket = sha256(f"{experiment_id}:{user_id}") % 100
# traffic_ratio 누적합으로 변형군 결정
```

---

### 4. 이벤트 수집 파이프라인

**상태:** 🟡 보류 (실험 설계 구체화 후 결정)

성장 시스템 원천 데이터(xp_history, project_attendance 등)로 대부분의 지표 분석 가능. UI 레벨 이벤트(클릭, 노출)가 필요한 실험이 생길 때 추가.

Lovable에 trackEvent 연동하는 요청서(`요청서.md`) 작성 완료. 필요 시 즉시 적용 가능.

---

### 5. 지표 카탈로그

**상태:** 🔴 초안 필요 (분석가 공동 작성)

EDA 완료 후 분석가와 함께 확정. 성장 시스템 데이터 기반 후보:

| 지표명 | 설명 | 소스 |
|---|---|---|
| `xp_gain_7d` | 7일간 XP 획득량 | `xp_history` |
| `project_attendance_rate` | 프로젝트 세션 출석률 | `project_attendance` |
| `project_completion_rate` | 프로젝트 완료율 | `projects`, `project_members` |
| `quest_completion_rate` | 퀘스트 완료율 | `user_quests` |
| `badge_acquisition_rate` | 뱃지 획득률 | `user_badges` |
| `retention_d7` | 7일 리텐션 | `xp_history` 기반 추정 |

---

### 6. 사용자 세그멘테이션 모듈

**상태:** 🔴 미착수

실험 대상자 필터링. 분석가 접근 가능 테이블 기반 세그멘트:

| 기준 | 소스 테이블 |
|---|---|
| 프로젝트 참여 여부 | `project_members` |
| 출석률 | `project_attendance` |
| 역할 | `user_roles` |
| XP 획득량 | `xp_history` |
| 뱃지 보유 | `user_badges` |

---

### 7. 기본 통계 모듈

**상태:** 🔴 미착수

- 표본 크기 계산기
- 이분형 지표 Z-test (전환율 비교)
- 연속형 지표 T-test (평균 XP 비교)

---

## 진행 상태 요약

| 항목 | 상태 |
|---|---|
| 분석가 DB 접근 레이어 | ✅ 완료 (2026-04-10) |
| 실험 메타데이터 스키마 + CRUD API | ✅ 완료 (2026-04-13) |
| 결정론적 할당 로직 | ✅ 완료 (2026-04-13) |
| API 테스트 코드 (18개 케이스) | ✅ 완료 (2026-04-13) |
| traffic_ratio 합계 검증 | ✅ 완료 (2026-04-13) |
| status 필터링 (`?status=running`) | ✅ 완료 (2026-04-13) |
| 실험 관리 UI (목록/생성/상세/수정/삭제) | ✅ 완료 (2026-04-13) |
| 이벤트 수집 파이프라인 | 🟡 보류 (실험 설계 후 결정) |
| 실험 상태 전환 유효성 검사 | 🔴 미착수 |
| Supabase Auth 연동 | 🔴 미착수 |
| 지표 카탈로그 | 🔴 초안 필요 (분석가 EDA 완료 후) |
| 사용자 세그멘테이션 모듈 | 🔴 미착수 |
| 기본 통계 모듈 | 🔴 미착수 |

---

## 다음 액션

- [x] 분석가 DB 접근 레이어 (2026-04-10 완료)
- [x] 실험 메타데이터 스키마 + CRUD API (2026-04-13 완료)
- [x] 결정론적 할당 로직 (2026-04-13 완료)
- [x] API 테스트 코드 18개 케이스 (2026-04-13 완료)
- [x] traffic_ratio 합계 검증 + status 필터링 (2026-04-13 완료)
- [x] 실험 관리 UI (목록/생성/상세/수정/삭제) (2026-04-13 완료)
- [ ] 실험 상태 전환 유효성 검사 (`draft→running` 허용, `completed→running` 불가)
- [ ] Supabase Auth 연동 (역할 기반 접근 제어)
- [ ] 분석가 EDA 완료 후 → 지표 카탈로그 공동 작성
- [ ] 실험 설계 확정 후 → 세그멘테이션 모듈 개발
- [ ] `profiles` anonymized 뷰 설계 (레벨/XP 세그멘트용)

---

## 관련 문서

| 문서 | 경로 |
|---|---|
| 실험 플랫폼 리서치 | `실험플랫폼_리서치.md` |
| 분석가 DB 접근 범위 | `분석가_DB접근_검토요청.md` |
| 접근 불가 테이블 목록 | `analyst_restricted_tables.md` |
| DB 역할 생성 스크립트 | `create_analyst_role.sql` |
| Lovable 이벤트 요청서 | `요청서.md` |
| 마이그레이션 SQL | `backend/migrations/001_experiment_platform_core.sql` |

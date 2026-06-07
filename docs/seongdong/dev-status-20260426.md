> 업데이트: 2026-04-26
>

---

## 📊 전체 진행 상태 (공통)

| 구분 | 상태 | 비고 |
| --- | --- | --- |
| 실험 플랫폼 API — 기본 (CRUD, 할당) | ✅ 완료 | CRUD, 유저 할당, 필터링, 검증 |
| 실험 플랫폼 API — 결과/분석/플래그 확장 | ✅ 완료 | 결과 분석, 이벤트 수집, Feature Flag, Analytics, 의사결정, 회고 |
| 실험 플랫폼 프론트엔드 | ✅ 완료 (Auth 연동 예정) | 실험 관리·결과·Feature Flag·Analytics 페이지 |
| D1 마이그레이션 실제 적용 | 🔴 대기 | 마이그레이션 005–007 작성 완료, D1에 미적용 |
| Lovable 이벤트 트래킹 연동 | 🔴 대기 | 요청서 작성 완료 |
| 분석가 EDA | 🟡 진행 중 | |
| 실험 계획 확정 | 🟡 진행 중 | 상태 전환 규칙 결정 완료, 가설·지표 확정 필요 |
| DE 피처 테이블 구축 | 🔴 대기 | 실험 계획 확정 후 착수 |

---

## 🎯 분석가팀 (분석가 대상)

### 분석가에게 필요한 것

> 아래 항목이 확정되면 개발팀이 바로 다음 단계로 진행할 수 있어요.

1. **실험 가설(방향성) 확정** — 어떤 기능의 효과를 측정할지, 어떤 이벤트를 primary_metric으로 쓸지 결정해주시면 좋겠습니다.
2. **지표 카탈로그 확정** — 이벤트 이름 규칙 (`weekly_session_attended`, `deliverable_submitted` 등)을 분석가·개발팀이 함께 정리해야 합니다.

### 결정 완료 항목 (2026-04-26)

- ✅ **실험 상태 전환 규칙** — `paused` / `archived` 상태 유지, 아래 전환만 허용
  ```
  draft    → running, archived
  running  → paused, completed, archived
  paused   → running, completed, archived
  completed → (전환 없음)
  archived  → (전환 없음)
  ```
- ✅ **traffic_ratio 방식** — SHA-256 해시 기반 결정론적 배정 유지
- ✅ **Bayesian 통계 방식** — Z-test/T-test 대신 Beta 분포 Monte Carlo 10,000회 샘플링

---

## 🔧 DE팀 (데이터 엔지니어 대상)

### DE에게 필요한 것

> 분석가 실험 계획 확정 후 바로 협업 시작 예정입니다.

- 피처 테이블 설계 (lvup 원천 데이터 기반)
- 현재는 임시로 lvup 원천 데이터 직접 조인으로 대응 가능
- 이벤트 수집 파이프라인이 구축됐으므로, `event_log` 테이블을 피처 테이블의 원천으로 활용 가능

---

## 💻 개발팀 (개발자 대상)

### 개발 완료 내역 (누적 2026-04-26)

| 항목 | 완료일 |
| --- | --- |
| 분석가 DB 읽기 전용 계정 생성 (57개 테이블) | 04-13 |
| 실험 메타데이터 스키마 설계 및 D1 마이그레이션 001–004 | 04-13 |
| 실험 CRUD API (생성/조회/수정/삭제) | 04-13 |
| SHA-256 결정론적 유저 할당 로직 구현 | 04-13 |
| 실험 API 테스트 코드 작성 (18개 케이스) | 04-13 |
| variants traffic_ratio 합계 1.0 검증 | 04-13 |
| 실험 목록 status 필터링 | 04-13 |
| 실험 관리 UI 개발 (목록/생성/상세/수정/삭제, API 연동) | 04-13 |
| **실험 상태 전환 유효성 검사 구현** (VALID_TRANSITIONS) | 04-26 |
| **Bayesian A/B 결과 분석 API** (`GET /experiments/:id/result`) | 04-26 |
| — uplift, probability_treatment_wins, SRM 경고 | 04-26 |
| **이벤트 수집 API** (`POST /capture`, `POST /identify`) | 04-26 |
| **Feature Flag 시스템** (CRUD + CRC32 결정론적 배정) | 04-26 |
| **Analytics API** (트렌드/퍼널/리텐션, SQLite 적응) | 04-26 |
| **의사결정 이력 API** (SHIP/HOLD/ROLLBACK, INSERT-ONLY) | 04-26 |
| **학습 노트 API** | 04-26 |
| **회고 가이드 API** (1인 1실험 제출 제한) | 04-26 |
| **D1 마이그레이션 005–007 작성** (미적용) | 04-26 |
| 프론트엔드: Feature Flags 관리 페이지 | 04-26 |
| 프론트엔드: Analytics 대시보드 (트렌드/퍼널/리텐션 탭) | 04-26 |
| 프론트엔드: 실험 상세 — 결과·의사결정·학습노트 카드 | 04-26 |
| 프론트엔드: 모달 오버레이 버그 수정 (React Portal 적용) | 04-26 |
| **Lovable 연동 요청서 작성** (이벤트 트래킹·Feature Flag·회고) | 04-26 |

### 다음 단계

- [ ] **D1 마이그레이션 005–007 실제 적용** (`backend/.env` 자격증명 입력 후)
  - 마이그레이션 완료 전까지 신규 API(이벤트, Feature Flag 등) 동작 안 함
- [ ] **Lovable 이벤트 트래킹 연동** (요청서 공유 완료, Lovable 작업 착수 필요)
- [ ] Supabase Auth 연동 (역할 기반 접근 제어) — 확인 필요
- [ ] 지표 카탈로그 확정 (분석가 공동 작성)
- [ ] 세그멘테이션 모듈 개발 (실험 대상자 필터링, cohort 연동)
- [ ] DE 피처 테이블 설계 협업
- [ ] ~~실험 상태 전환 유효성 검사 구현~~ ✅
- [ ] ~~통계 모듈 개발 (Z-test, T-test)~~ ✅ (Bayesian으로 대체)
- [ ] ~~실험 결과 분석 API~~ ✅

---

## 🏗️ 현재 인프라 구조 (공통)

```
lvup (Supabase)
  → 가짜연구소 성장 시스템 원천 데이터 (57개 테이블, 분석가 읽기 접근 완료)

Cloudflare D1
  pseudolab-exp   → 실험 플랫폼 DB
    ✅ experiments, experiment_variants, experiment_assignments
    ⏳ event_log, person, feature_flag, cohort        ← 마이그레이션 005 (미적용)
    ⏳ decision_log, learning_note                    ← 마이그레이션 006 (미적용)
    ⏳ reflection                                     ← 마이그레이션 007 (미적용)
  pseudolab-main  → Discord/GitHub 데이터 + 향후 피처 테이블 추가 예정

Cloudflare R2
  → 버그 리포트 첨부파일 스토리지

실험 플랫폼
  FastAPI 백엔드 → k8s + ArgoCD GitOps 배포 (브랜치: feat/add_result_function)
  프론트엔드 → React + Vite (실험 관리·Feature Flag·Analytics UI 완료, Auth 연동 예정)

Lovable (lvup 서비스)
  → 이벤트 트래킹·Feature Flag·회고 가이드 연동 요청서 전달 완료 (작업 대기)
```

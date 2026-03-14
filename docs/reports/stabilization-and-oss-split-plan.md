Status: active
Last-Validated: 2026-03-15

# Stabilization and OSS Split Plan

## 목적
가짜연구소 전용 앱(`experiment-platform-pseudolab`)을 먼저 안정화하고,
그 다음 공통 코어를 OSS 레포(`experiment-platform`)로 분리한다.

---

## Phase 1 — Pseudolab 안정화 (현재 스프린트)

### 1) 기능 안정
- [x] Overview / GitHub / Discord 핵심 플로우 점검
- [x] 7d/30d 전환 시 지표/라벨/설명 문구 일치 확인
- [x] loading / error / empty / success 상태 점검
- [ ] 툴팁 동작 최종 QA
  - [ ] PC: hover
  - [x] 모바일: tap open/close + 외부 터치 닫기
- [x] KO/EN 텍스트 동기화 확인

### 2) 데이터/지표 안정
- [x] KPI 설명 문구와 실제 계산식 정합성 재검증
- [x] 머지율/활성지표 라벨 최종 확정
- [x] API 계약 freeze
  - 예: `pr_merge_rate_28d` 호환 유지 여부와 window 연동 정책 명시
- [x] 데이터 제약사항 명시
  - 예: Discord 닉네임 필드 미확인 범위 / partial source 처리 기준

### 3) 배포 안정
- [x] CI green 유지 기준 명문화 (frontend test/build, backend smoke test, image build)
- [x] backend smoke/API test를 CI validate 단계에 포함
- [ ] 이미지 푸시 → ops 반영 → 롤백 1회 리허설
- [x] docs-only 변경 비배포 path filter 적용 및 검증

### 4) 문서 안정
- [x] `AGENTS.md` 최신 규칙 반영 확인
- [x] `docs/README.md` 구조 규칙과 문서 상태 메타 준수 확인
- [x] `docs/reports/hand-off-12th-study-platform.md` 최신화
- [x] `docs/reports/docs-inventory-final.md`에 신규 active 문서 반영

### Phase 1 완료 기준 (Exit Criteria)
- 주요 기능 회귀 버그 없음
- KO/EN 및 loading/error/empty/success 상태 점검 완료
- CI/CD 연속 성공
- docs-only 변경은 배포 파이프라인 미실행
- 지표 정의 / API 계약 / UI 설명 불일치 없음

---

## Phase 2 — OSS 분리 준비 (다음 스프린트 시작)

### 1) Core 추출 설계
- [ ] OSS로 이동할 공통 모듈 목록 작성
- [ ] pseudolab 전용 코드 목록 분리
- [ ] 인터페이스 계약 정의
  - 데이터 소스 어댑터
  - 지표 계산 인터페이스
  - UI 확장 포인트

### 2) Repo 구조 확정
- [ ] `experiment-platform` (OSS core)
- [ ] `experiment-platform-pseudolab` (internal app)
- [ ] `devfactory-ops` (GitOps/deploy)

### 3) 전환 계획
- [ ] pseudolab의 OSS 참조 방식 결정
  - 패키지 방식 / subtree 방식 중 선택
- [ ] CI/이미지/ops 경로 영향 분석표 작성
  - GHCR 이미지명, workflow env, ops kustomization, import path 포함
- [ ] Cutover 순서 및 롤백 플랜 문서화

### Phase 2 완료 기준 (Exit Criteria)
- 추출 범위 팀 합의 완료
- 전환 리스크 및 롤백 경로 문서화 완료
- OSS 초기 이관 대상(파일/모듈) 확정

---

## 운영 원칙
1. 한 번에 대수술하지 않는다. (안정화 → 분리 순서 고정)
2. 공통은 OSS, 특화는 pseudolab에 유지한다.
3. 배포는 ops repo를 단일 진실 소스로 유지한다.

---

## 참조 문서
- `docs/reports/hand-off-12th-study-platform.md`
- `docs/reports/docs-inventory-final.md`
- `docs/reports/kpi-definition-v2.md`
- `docs/dashboard-test-strategy.md`
- `docs/README.md`
- `AGENTS.md`

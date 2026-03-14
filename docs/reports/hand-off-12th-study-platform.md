Status: active
Last-Validated: 2026-03-14

# Hand-off: 가짜연구소 12기 스터디 실험 플랫폼 진행 요약

## 0) 프로젝트 컨텍스트
- 대상: 가짜연구소 12기 스터디 실험 플랫폼
- 현재 포커스: 대시보드 MVP 고도화, 데이터 신뢰성 검증, UI/UX 일관성
- 운영 전제: app repo / ops repo 분리, k3s + ArgoCD 배포

---

## 1) 완료된 핵심 작업

### A. 대시보드 API/데이터
- 엔드포인트 분리/운영:
  - `GET /api/v1/dashboard/overview?window=7d|30d`
  - `GET /api/v1/dashboard/github/overview`
  - `GET /api/v1/dashboard/discord/overview`
- 초기 404 원인 해소: overview 엔드포인트 추가
- D1 우선 집계 + Supabase fallback 구조 유지
- 기본 조회 기간 7일 UX 유지
- 품질 보정:
  - merge rate 상한 1.0 클램프
  - freshness 음수값 방지

### B. Discord/GitHub 표시/집계
- 채널 표시는 `channel_name`만 사용 (`channel_id` fallback 제거)
- Discord Top Contributors 비노출 버그 해결
  - 원인: 작성자 필드 매핑 누락
  - 조치: `author_username` 기준 집계 정상화
- 닉네임 필드(`nickname/global_name`)는 현재 D1/R2에서 미확인

### C. UI/UX
- Overview/GitHub/Discord 모두 7일/30일 토글 반영
- 툴팁 동작 분기:
  - PC: hover
  - 모바일: tap open/close + 바깥 영역 터치 시 닫힘
- 브라우저 기본 `title` 툴팁과 커스텀 툴팁 2중 노출 문제 해결 (`title` 제거)
- 헤더 검색창 미구현 상태여서 숨김 처리
- 헤더/버튼/토글 배치 반복 조정 후 현재안 적용

### D. i18n/규칙
- KO/EN 동시 반영 원칙을 `AGENTS.md`에 명시
- UI 텍스트 변경 시 양언어 동시 업데이트 규칙 적용

### E. 성능
- 대시보드 API 인메모리 캐시(short TTL) 적용
- 웜 상태 응답 속도 개선 확인

### F. 커밋 정리
- 문서/백엔드/프론트 분리 커밋 완료
- main 최신 pull 완료 (`4fe56fe`)

---

## 2) 현재 오픈 이슈 / 확인 필요

1. **Discord 닉네임 데이터 소스**
   - 현재 접근 가능한 D1/R2 범위에서는 닉네임 전용 필드 미확인
   - DBA 주장과 불일치 시, 다른 계정/버킷/파이프라인 경로 확인 필요

2. **UI 일관성 최종 QA**
   - Overview vs GitHub vs Discord 타이틀/그리드/문구 톤 최종 점검
   - PC 헤더와 액션 버튼 배치 최종 확인

3. **머지율 API 계약 정리**
   - 계산은 window 연동(7d/30d)으로 변경
   - 키명 `merge_rate_28d`는 호환 목적 유지 여부 정책 확정 필요

---

## 3) 운영/배포(Repo Rename 포함) 현황
- k3s + ArgoCD 운영 전제
- 시크릿 전략:
  - 단기: Sealed Secrets 권장
  - 장기: Vault + ESO 전환 가능
- `.env`, `.env.*`는 gitignore 적용, `.env.sample`만 추적
- 네이밍 논의:
  - OSS: `experiment-platform`
  - ops: `devfactory-ops`
  - 내부앱 후보: `experiment-platform-pseudolab`
- CI/배포 영향:
  - GHCR 이미지명 변경 시 workflow env + ops kustomization image name 동시 변경 필요

---

## 4) 다음 담당 에이전트 실행 가이드

### 목표
- UI 최종 일관성 QA
- 닉네임 데이터 소스 확정
- repo rename 시 CI/ArgoCD 영향도 확정

### 작업 순서
1. `/dashboard`, `/metrics/github`, `/metrics/discord` UI 비교 점검
2. 7d/30d 전환 시 라벨/지표/설명 정합성 확인
3. D1/R2 재검증 + 다른 경로(계정/버킷/파이프라인) 가능성 확인
4. `.github/workflows/gitops-ci.yml` + ops kustomization 변경 포인트 문서화
5. 결과를 체크리스트 형태로 제출

### 완료 기준
- KO/EN 동기화 확인
- 모바일/PC 툴팁 동작 정상
- 닉네임 데이터 존재 여부를 근거와 함께 확정
- rename 시 수정 파일 리스트 확정

---

## 5) 참고 경로
- API 구현: `backend/app/api/v1/endpoints/dashboard.py`
- Overview UI: `frontend/src/features/dashboard/overview/OverviewPage.tsx`
- GitHub UI: `frontend/src/features/dashboard/components/GitHubDashboard.tsx`
- Discord UI: `frontend/src/features/dashboard/components/DiscordDashboard.tsx`
- Layout: `frontend/src/layouts/MainLayout.tsx`
- CI: `.github/workflows/gitops-ci.yml`

Status: active
Last-Validated: 2026-03-16

# Core Extraction Candidates (Day 1-2)

## 기준
- 다른 프로젝트에서도 그대로 재사용 가능한가?
- pseudolab 정책이 바뀌어도 코드를 유지할 수 있는가?
- 공개해도 의미가 독립적으로 성립하는가?

---

## P0 (저위험, 먼저 추출)

1. `frontend/src/lib/utils.ts`
- 이유: 도메인 중립 유틸
- 리스크: 낮음

2. `frontend/src/components/ui/*`
- 이유: shadcn 기반 공통 UI 레이어
- 리스크: 테마/토큰 경로만 주의

3. `frontend/src/features/dashboard/types/*.ts`
- 이유: 공통 타입 계약 후보
- 리스크: pseudolab 전용 필드 분리 필요

4. `backend/app/schemas/experiment.py`
- 이유: 공통 스키마 후보
- 리스크: 상태값 enum 정책 확인 필요

5. `backend/app/core/config.py` (중립 항목만)
- 이유: 설정 주입 패턴 재사용 가능
- 리스크: 환경변수 키/벤더 종속 제거 필요

---

## P1 (중간 위험, 2차 추출)

6. `frontend/src/services/api.ts`
- 이유: 공통 API 클라이언트 골격
- 리스크: 경로 정책/프록시 설정 분리 필요

7. `frontend/src/features/dashboard/overview/*` 중 순수 표현 컴포넌트
- 이유: 차트/표현 컴포넌트 재사용 가능
- 리스크: KPI 문구/지표 의미 커스텀 분리 필요

8. `backend/app/services/experiment.py`
- 이유: 도메인 서비스로 확장 가능
- 리스크: 현재 저장소 접근/정책 결합 여부 확인 필요

---

## P2 (고위험, 마지막)

9. `backend/app/api/v1/endpoints/dashboard.py`
- 이유: 유용하지만 현재 pseudolab 문맥 강함
- 리스크: 지표 정의/데이터 소스/정책 결합 높음

10. `frontend/src/features/dashboard/components/{GitHubDashboard,DiscordDashboard}.tsx`
- 이유: 기능은 재사용 가능
- 리스크: 레이블/설명/운영 맥락 커스텀 결합 높음

---

## Overlay 고정 (OSS 제외)
- 조직 전용 문구/정책/운영 워크플로우
- 배포 환경(k3s/ops) 하드코딩
- 가짜연 전용 KPI 해석 로직

## 다음 액션 (Day 3)
- `oss-core-boundary-spec-v1.md` 기준으로
  1) import 경계 규칙 확정
  2) P0 추출 대상 1개 선택
  3) 추출 PoC 브랜치 생성(로컬, push 보류)

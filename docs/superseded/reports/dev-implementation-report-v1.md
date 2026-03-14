Status: superseded
Last-Validated: 2026-03-14
Replaced-By: docs/reports/dev-implementation-report-v2.md

# Dev Implementation Report v1

## 1) 작업 요약
- 목표: **대시보드 메뉴 지표/그래프를 실제 API 데이터 기반으로 전환**
- 대상 화면: `frontend/src/features/dashboard/components/Metrics.tsx`
- 결과:
  - 하드코딩(합성) 데이터 제거
  - `experimentApi.list()` 응답 기반 파생 지표/차트 구현
  - 로딩/에러/빈 상태 UI 추가
  - 테스트 코드 추가 및 실행 결과 첨부

---

## 2) 입력 문서 확인
- 요청된 입력 문서 `docs/reports/data-analyst-report-v1.md`는 현재 워크스페이스에 존재하지 않음.
- 대체 참조 문서:
  - `docs/cloudflare-data-insights-readonly.md`
  - `docs/d1-as-is-structure.md`
  - `docs/dashboard-mvp-plan.md`

위 문서 기반으로 선구현을 진행했으며, 하단 TODO에 데이터 분석 리포트 연계 후속 작업을 명시함.

---

## 3) 코드 변경 사항

### A. Metrics 화면 실데이터화
**파일:** `frontend/src/features/dashboard/components/Metrics.tsx`

#### 주요 변경
1. **합성값 제거**
   - 제거: `conversionData`, `retentionData`, `metricsList` 상수
   - 변경: `experimentApi.list()`로 조회한 실험 데이터 기반 계산

2. **파생 지표 구현**
   - 총 실험 수
   - 활성 비율 (`active / total`)
   - 완료 비율 (`completed / total`)
   - 최근 생성일 (`created_at` 최신값)

3. **그래프 구현 (실데이터 기반)**
   - LineChart: 최근 7일 실험 생성 추이
   - BarChart: 실험 상태 분포(active/draft/completed)

4. **상태 처리 강화**
   - 로딩 상태: progressbar 표시
   - 에러 상태: Alert + Retry 버튼
   - 빈 상태: 안내 empty state 카드

5. **UI 준수**
   - shadcn/ui 컴포넌트 사용 (`Button`, `Card`, `Badge`)
   - 기존 다크모드/테마 스타일 일관성 유지

---

### B. 테스트 추가
**파일:** `frontend/src/__tests__/Metrics.test.tsx`

#### 추가 테스트 케이스
- 로딩 상태 렌더링
- 데이터 로드 후 파생 지표 렌더링
- 빈 데이터(empty) 상태 렌더링
- `experimentApi.list` 호출 검증

---

## 4) 테스트 실행 결과

실행 명령:
- `cd frontend && npm test -- --run`

결과:
- **Test Files:** 6 passed
- **Tests:** 31 passed
- 신규 `Metrics.test.tsx` 포함 전체 통과

참고:
- Recharts의 jsdom 환경 경고(`width(-1), height(-1)`)는 테스트 실패가 아닌 런타임 경고로 관측됨.

---

## 5) 확인된 이슈

실행 명령:
- `cd frontend && npm run build`

결과:
- 실패: `src/services/api.ts(1,34): error TS2339: Property 'env' does not exist on type 'ImportMeta'.`
- 본 이슈는 본 작업 범위(대시보드 실데이터화)와 별개로, Vite 타입 선언(`vite/client`) 설정 이슈로 판단됨.

---

## 6) TODO (후속)
1. `docs/reports/data-analyst-report-v1.md` 확보 후 지표 정의 정합성 재검토
   - 현재는 실험 엔티티(`id, name, status, created_at`) 기반 최소 지표만 구현
2. 백엔드 대시보드 집계 API(`GET /api/v1/dashboard/summary` 등) 도입 시
   - 프론트 파생 계산 로직을 서버 집계 응답 기반으로 전환
3. Recharts 테스트 유틸(ResponsiveContainer mock) 도입으로 jsdom 경고 제거
4. 빌드 오류(`ImportMeta.env` 타입) 별도 수정

---

## 7) 변경 파일 목록
- `frontend/src/features/dashboard/components/Metrics.tsx`
- `frontend/src/__tests__/Metrics.test.tsx`
- `docs/reports/dev-implementation-report-v1.md`

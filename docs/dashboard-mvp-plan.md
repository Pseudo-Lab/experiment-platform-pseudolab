# Dashboard MVP 구현 계획

## 1) 현행 구조 분석 (frontend/src/features/dashboard/components/Dashboard.tsx 중심)

### 현재 동작 요약
- `Dashboard.tsx`는 단일 컴포넌트에서 아래를 모두 처리함:
  - API 호출(`experimentApi.list`) + 로딩/에러 처리
  - 상단 헤더 렌더링
  - KPI 카드 3종 렌더링
  - 실험 리스트 카드 렌더링
  - 빈 상태(empty state) 렌더링
- 라우팅은 `App.tsx`에서 `/dashboard` → `Dashboard`로 직접 연결.
- 스타일은 Tailwind + shadcn/ui(`Button`, `Card`, `Badge`) 기반이며, 다크모드 클래스 사용.

### 확인된 이슈/개선 포인트
1. **책임 과다 (단일 파일 집중)**
   - 데이터 로딩, 계산, 표시가 한 파일에 결합되어 유지보수 비용 증가.
2. **하드코딩 데이터 혼재**
   - KPI 값 `48.2k`, `64%` 등은 API 연동되지 않은 임시값.
3. **재사용성 저하**
   - `cn` 유틸이 로컬 정의되어 있고, 프로젝트 공용 `@/lib/utils`와 중복.
4. **상태 모델 제한**
   - 에러 상태가 UI로 노출되지 않고 콘솔 출력에 그침.
5. **국제화 구조 확장성 부족**
   - 문자열이 컴포넌트 내부 객체에 인라인되어 확장 시 충돌 가능.

---

## 2) MVP 목표 범위

MVP에서 대시보드의 핵심 정보 전달에 집중:
- **KPI 카드**: 총 실험/활성 실험/총 참여자/승률(또는 전환율) 요약
- **시계열 차트**: 최근 N일 주요 지표 트렌드
- **랭킹 컴포넌트**: 실험별 성과 Top N

> 제약 준수: shadcn/ui 기반, 기존 시각 톤/클래스 패턴 유지, 민감정보/비밀키 하드코딩 금지.

---

## 3) 제안 컴포넌트 구조 (MVP)

```text
features/dashboard/
  components/
    Dashboard.tsx                # 컨테이너 (데이터 fetch + 섹션 조합)
    mvp/
      DashboardKpiCards.tsx      # KPI 카드 묶음
      DashboardTrendChart.tsx    # 시계열 차트 카드
      DashboardRankingList.tsx   # 랭킹 리스트 카드
  types/
    dashboard.ts                 # Dashboard 데이터 contract
```

### 컴포넌트 책임 분리
- `Dashboard.tsx`
  - API 호출, 로딩/에러/성공 상태 전환
  - contract 변환(서버 응답 → UI ViewModel)
  - 하위 3개 컴포넌트 조합
- `DashboardKpiCards.tsx`
  - KPI 배열을 받아 카드 그리드 렌더
- `DashboardTrendChart.tsx`
  - 시계열 데이터 렌더 (`recharts` 사용 가능, 기존 `Metrics.tsx` 패턴 재사용)
- `DashboardRankingList.tsx`
  - 순위 리스트 + 상태 badge

---

## 4) 데이터 Contract (초안)

`frontend/src/features/dashboard/types/dashboard.ts`

```ts
export type DashboardLang = 'en' | 'ko';

export interface DashboardKpiItem {
  id: 'active_experiments' | 'total_experiments' | 'participants' | 'win_rate';
  label: string;
  value: string;
  changeText?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export interface DashboardTrendPoint {
  date: string;      // ISO date (YYYY-MM-DD)
  value: number;     // e.g. conversion rate or participants
}

export interface DashboardRankingItem {
  experimentId: string;
  experimentName: string;
  status: 'draft' | 'active' | 'completed';
  score: number;     // normalized score (0-100)
  participants: number;
}

export interface DashboardData {
  kpis: DashboardKpiItem[];
  trend: DashboardTrendPoint[];
  ranking: DashboardRankingItem[];
}
```

### API 연동 가이드
- 이상적 엔드포인트(예시): `GET /api/v1/dashboard/summary`
- 임시 단계에서는 기존 `experimentApi.list()` 기반으로 파생 계산:
  - `total_experiments = experiments.length`
  - `active_experiments = status==='active' count`
  - ranking은 추후 백엔드 점수 필드 추가 전까지 mock 파생값 허용

---

## 5) 단계별 구현 계획

### Phase 1 — 구조 분리 (무중단)
1. `types/dashboard.ts` 추가
2. KPI/차트/랭킹 하위 컴포넌트 뼈대 생성
3. 기존 `Dashboard.tsx` UI를 하위 컴포넌트로 분리하되, 화면 결과 동일 유지

### Phase 2 — 데이터 정합성 개선
1. `Dashboard.tsx`에서 하드코딩 KPI 제거
2. API 응답 기반 파생 계산 함수(`toDashboardData`) 도입
3. 로딩/빈 상태/에러 상태 UI 분기 명시화

### Phase 3 — 차트/랭킹 MVP 완성
1. 시계열 데이터(임시 mock 또는 신규 API) 연결
2. Top N 랭킹 카드 렌더 + 상태 Badge 통일
3. 접근성 점검(heading 레벨, aria-label, 대비)

### Phase 4 — 테스트 보강
1. `Dashboard` 컨테이너 테스트: loading/success/empty/error
2. 각 프리젠테이션 컴포넌트 snapshot 또는 핵심 렌더 테스트
3. 데이터 변환 함수 단위 테스트

---

## 6) 코드 스타일/안전 가이드
- `cn`은 로컬 구현 대신 `@/lib/utils`의 `cn` 사용.
- 환경별 URL은 `import.meta.env` 또는 설정 모듈로 이동(추후 `services/api.ts` 개선).
- 민감정보(토큰, 내부 URL 자격증명) 코드 하드코딩 금지.
- 스타일은 shadcn/ui 컴포넌트 + Tailwind 유틸 클래스 조합 유지.

---

## 7) 구현 시 우선순위 제안
1. 화면 분리(컴포넌트화)
2. KPI 실데이터화
3. 시계열 + 랭킹 데이터 연결
4. 테스트 확장

이 순서가 가장 안전하게 기존 동작을 보존하면서 MVP 품질을 올릴 수 있음.

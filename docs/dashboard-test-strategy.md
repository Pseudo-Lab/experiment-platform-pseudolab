Status: active
Last-Validated: 2026-03-14

# Dashboard Test Strategy

## 1) 현재 테스트 현황 요약

대상 파일 검토:
- `frontend/src/__tests__/Dashboard.test.tsx`
- `frontend/src/App.test.tsx`
- `frontend/src/__tests__/MainLayout.test.tsx`
- `frontend/src/features/dashboard/components/Dashboard.tsx`
- `frontend/src/App.tsx`

이미 커버되는 항목:
- Dashboard 기본 렌더링(환영 문구, 서브타이틀)
- 로딩 상태(`role="progressbar"`)
- 데이터 유무 분기(실험 카드 노출 / empty-state 문구)
- `experimentApi.list` 호출 여부
- App 레벨의 언어/테마 localStorage 연동
- MainLayout의 사이드바 토글/네비게이션 동작

주요 갭:
- API 실패 시 Dashboard 동작(에러 fallback UI 부재, 콘솔 에러만 처리)
- 상태별 배지/아이콘/텍스트 매핑 정확성(특히 `completed`)
- 날짜 포맷 및 locale 의존성으로 인한 취약 테스트 가능성
- 접근성(landmark, heading 구조, 버튼 접근 가능한 이름, 키보드 탐색) 검증 부족

---

## 2) 우선순위 테스트 시나리오

### P0 (회귀 방지 최우선)
1. **렌더링 분기 안정성**
   - 로딩 → 데이터 있음 → 데이터 없음 3개 분기가 항상 배타적으로 동작하는지
   - 비동기 완료 후 로더가 제거되는지
2. **데이터 매핑 정확성**
   - `status` 값(`active|draft|completed`)이 올바른 번역 텍스트/스타일/아이콘으로 매핑되는지
   - 실험 카드 수와 API 응답 배열 길이가 일치하는지
3. **상태(언어) 반영**
   - `lang` prop 전환 시 Dashboard 내 모든 핵심 문자열(헤더/empty-state/status)이 동기화되는지

### P1 (제품 신뢰도 향상)
1. **App-Layout-Dashboard 통합 흐름**
   - `/` 진입 시 `/dashboard` 리다이렉트 + 콘텐츠 표시
   - 언어/테마 전환이 페이지 재마운트 후에도 유지되는지
2. **API 실패 케이스**
   - `experimentApi.list` reject 시 로딩 종료 + 앱이 깨지지 않음
   - (향후) 사용자용 에러 메시지 추가 시 해당 UI 검증

### P2 (품질 고도화)
1. **접근성**
   - 주요 버튼에 접근 가능한 이름 존재
   - heading 계층(`h1` 존재) 및 landmark(`main`, `complementary`) 유지
   - 색상/아이콘 의존 정보의 텍스트 대체 확인
2. **반응형/상호작용 디테일**
   - 모바일 사이드바 열기/닫기 스크림 클릭 및 스와이프 제스처

---

## 3) Mock 전략

### API Mock
- 원칙: `vi.mock('@/services/api')`로 `experimentApi.list`만 최소 mock.
- 시나리오별 분기:
  - 성공: `mockResolvedValue([...])`
  - 빈 배열: `mockResolvedValue([])`
  - 실패: `mockRejectedValue(new Error('...'))`
  - 로딩 지속: `new Promise(() => {})`
- 테스트 간 오염 방지: `beforeEach`에서 `mockClear` + 기본 반환값 재설정.

### 브라우저 API Mock
- `localStorage`: in-memory mock 유지(현재 방식 적절)
- `matchMedia`: dark/light 각각 명시적 mock으로 분기 테스트
- `fetch`: App status API 전용 mock(`connected`, 실패)

### 시간/날짜 Mock
- `created_at` 렌더링은 `toLocaleDateString` 의존.
- 권장:
  - 날짜 문자열 자체를 엄격 비교하지 말고, **텍스트 존재/카드 내 노출 여부** 중심 검증
  - 필요 시 `vi.setSystemTime` 또는 locale 고정 전략 도입

### 테스트 구조 가이드
- 단위(Dashboard)와 통합(App) 경계를 분리
- Assertion은 사용자 관점 우선(`getByRole`, `getByText`), 구현 디테일(class) 의존 최소화

---

## 4) 회귀 체크리스트 (PR 전 빠른 확인)

1. Dashboard 진입 시 제목/서브타이틀 정상 노출
2. API pending 시 로더 노출, 완료 후 로더 제거
3. API empty 시 empty-state 문구 노출
4. API data 시 카드 개수 및 실험명 노출
5. 상태별 배지 문구 매핑
   - active → 활성(ko) / Active(en)
   - draft → 초안(ko) / Draft(en)
   - completed → 종료(ko) / Completed(en)
6. 언어 토글 후 Dashboard 문자열 전체 동기화
7. 테마 토글 시 `document.documentElement`의 `dark` 클래스 반영/저장
8. `/` → `/dashboard` 라우팅 유지
9. 주요 버튼 접근성 이름 유지(`Toggle theme`, `Toggle language`, `Toggle sidebar`)

---

## 5) 빠르게 적용 가능한 테스트 3개 후보 (파일/케이스 단위)

### 후보 1
- **파일:** `frontend/src/__tests__/Dashboard.test.tsx`
- **케이스:** `status 값별 배지 텍스트/아이콘 매핑 검증`
- **목표:** `active/draft/completed` 데이터 3건을 주고 각 카드에 올바른 상태 텍스트가 나오는지 검증.
- **효과:** 데이터 매핑 회귀를 가장 빠르게 탐지.

### 후보 2
- **파일:** `frontend/src/__tests__/Dashboard.test.tsx`
- **케이스:** `API 실패 시 로딩 종료 및 크래시 방지`
- **목표:** `experimentApi.list.mockRejectedValueOnce(...)` 후 progressbar가 사라지고 핵심 레이아웃(제목 등)이 유지되는지 검증.
- **효과:** 네트워크 장애 시 치명적 회귀 방지.

### 후보 3
- **파일:** `frontend/src/App.test.tsx`
- **케이스:** `언어 토글 후 Dashboard 상태 라벨 다국어 동기화`
- **목표:** KO→EN 토글 시 Dashboard의 상태/empty-state 문구가 EN으로 전환되는지 확인.
- **효과:** App 상태(`lang`)가 Dashboard로 정확히 전파되는지 통합 레벨에서 보장.

---

## 6) 실행 우선순위 제안

1. 후보 1 (데이터 매핑 핵심)
2. 후보 2 (장애 복원력)
3. 후보 3 (다국어 회귀)

위 3개만 추가해도 Dashboard 영역 회귀 탐지력이 즉시 개선된다.
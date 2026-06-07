# Lovable 요청서 — 자체 Analytics 플랫폼 연동 + 회고 기능 (v4)

> **API Base**: `${VITE_API_URL}/api/v1` (환경변수 `VITE_API_URL=https://api.lvup.kr` 등)

Lovable이 해줘야 하는 건 네 가지다:
1. 사용자 행동 이벤트를 자체 백엔드로 전송
2. Feature Flag를 자체 백엔드에서 조회해 UI 분기
3. Analytics 어드민 페이지 추가 (이벤트 탐색, 트렌드, 퍼널, 리텐션, Feature Flag 관리)
4. 회고 가이드 페이지 + 대시보드 배너 연결

---

## 요청 1 — 이벤트 트래킹 유틸리티 + 환경변수

### 복붙 프롬프트

```
이벤트 트래킹 유틸리티를 만들어줘. posthog-js는 사용하지 않아.

1. src/utils/trackEvent.ts 생성

export async function trackEvent(
  eventName: string,
  properties: Record<string, unknown> = {}
) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await fetch(`${import.meta.env.VITE_API_URL}/api/v1/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        event_name: eventName,
        properties,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch {
    // fire-and-forget — 실패해도 UX에 영향 없음
  }
}

2. src/hooks/useIdentify.ts 생성
   로그인한 사용자의 프로필 정보를 백엔드에 한 번 전송.
   App.tsx 최상단에서 한 번만 호출.

   전송 엔드포인트: POST ${VITE_API_URL}/api/v1/identify
   전송 데이터: { user_id, cohort_id, cohort_name, team_name, role }
   Supabase 프로필 훅에서 가져오는 방식으로 구현.
   user_id가 있을 때 한 번만 호출 (useEffect + 의존성 [profile?.id]).

3. .env 환경변수 추가
   VITE_API_URL=        # 자체 백엔드 서버 URL (예: https://api.lvup.kr)
   VITE_EXPERIMENT_ID=  # 대시보드 배너에서 사용할 기본 실험 ID

4. posthog-js 패키지가 이미 설치되어 있으면 제거하고, main.tsx의 posthog 관련 코드도 모두 제거해줘.
```

---

## 요청 2 — 이벤트 삽입 위치 3곳

### 복붙 프롬프트

```
아래 3곳에 trackEvent 호출을 추가해줘.
trackEvent는 src/utils/trackEvent.ts에 있어.

1. 주간 세션 출석 처리 핸들러
   trackEvent('weekly_session_attended', { week_number: currentWeek })

2. 과제 제출 완료 핸들러
   trackEvent('deliverable_submitted', { type: 'blog' })

3. 프로그램 완주 처리 핸들러
   trackEvent('program_completed', {})

각 핸들러가 어디 있는지 코드베이스를 탐색해서 적절한 위치에 삽입해줘.
```

---

## 요청 3 — Feature Flag 훅

### 복붙 프롬프트

```
Feature Flag를 자체 백엔드에서 가져오는 훅을 만들어줘.
posthog-js/react의 useFeatureFlagVariantKey는 사용하지 않아.

src/hooks/useFeatureFlag.ts 생성:

export function useFeatureFlag(flagKey: string): string | null {
  // GET ${VITE_API_URL}/api/v1/feature-flags/decide?flag_key=flagKey&user_id=userId
  // 응답 구조: { success: boolean, data: { variant: 'treatment' | 'control' } }
  // 읽는 방법: response.data.variant
  // 로딩 중이거나 오류 시 null 반환 → 기존 UI(control) 렌더링
  // TanStack Query 사용, staleTime: 5분
}

사용 예시:
function WeekMissionSection() {
  const variant = useFeatureFlag('magic-week-v1')
  if (variant === 'treatment') return <NewUI />
  return <DefaultUI />
}
```

---

## 요청 4 — Analytics 어드민: 이벤트 탐색기

### 복붙 프롬프트

```
어드민 Analytics 섹션을 추가해줘.

1. 라우트 추가: /admin/analytics/events
   페이지 파일: src/pages/admin/AnalyticsEvents.tsx

2. UI 구성:
   - 상단 필터: 이벤트 이름(텍스트 검색), 날짜 범위(from/to datepicker)
   - 테이블: event_name | user_id | event_time | properties(JSON 뱃지로 표시)
   - 페이지네이션 (20개씩)

3. 데이터 API:
   GET ${VITE_API_URL}/api/v1/analytics/events
   쿼리 파라미터: event_name?, from?, to?, page?, limit?
   응답 구조:
   {
     total: number,
     page: number,
     limit: number,
     items: EventLog[]   ← 'data'가 아니라 'items' 필드
   }

   EventLog 타입:
   {
     id: number,
     user_id: string,
     cohort_id: string | null,
     event_name: string,
     properties: object | null,
     event_time: string,
     created_at: string
   }

4. 사이드바 어드민 메뉴에 "Analytics > 이벤트" 링크 추가
```

---

## 요청 5 — Analytics 어드민: 트렌드

### 복붙 프롬프트

```
어드민 트렌드 페이지를 추가해줘.

1. 라우트: /admin/analytics/trends
   페이지 파일: src/pages/admin/AnalyticsTrends.tsx

2. UI 구성:
   - 이벤트 선택 드롭다운
     GET ${VITE_API_URL}/api/v1/analytics/event-names
     응답: string[]   ← 배열 직접 반환 (래퍼 없음)
   - 날짜 범위 선택 (기본값: 최근 30일)
   - 일별/주별 이벤트 발생 수 꺾은선 그래프 (Recharts LineChart)
     X축: 날짜, Y축: 이벤트 수, 툴팁 포함

3. 데이터 API:
   GET ${VITE_API_URL}/api/v1/analytics/trends
   쿼리 파라미터: event_name(필수), from(필수), to(필수), granularity(day|week, 기본 day)
   응답 구조:
   {
     event_name: string,
     granularity: string,
     data: [{ date: string, count: number }]
   }
   읽는 방법: response.data (배열)

4. 사이드바에 "Analytics > 트렌드" 링크 추가
```

---

## 요청 6 — Analytics 어드민: 퍼널

### 복붙 프롬프트

```
어드민 퍼널 분석 페이지를 추가해줘.

1. 라우트: /admin/analytics/funnels
   페이지 파일: src/pages/admin/AnalyticsFunnels.tsx

2. UI 구성:
   - 퍼널 스텝 설정: 이벤트 이름 입력 필드 2~5개 (+ 추가 버튼)
   - 날짜 범위 선택
   - "분석" 버튼
   - 결과: 각 스텝의 사용자 수 + 전환율 세로 막대 그래프 (Recharts BarChart)
     스텝명, 사용자 수, 이전 스텝 대비 전환율 % 표시

3. 데이터 API:
   POST ${VITE_API_URL}/api/v1/analytics/funnels
   body: { steps: string[], from: string, to: string }
   응답 구조 (success/data 래퍼 없음, 직접 반환):
   {
     steps: [
       {
         step: string,           ← 이벤트 이름 ('event_name' 아님)
         users: number,
         conversion_rate: number | null   ← 첫 스텝은 null
       }
     ]
   }
   읽는 방법: response.steps (최상위 필드)

4. 사이드바에 "Analytics > 퍼널" 링크 추가
```

---

## 요청 7 — Analytics 어드민: 리텐션

### 복붙 프롬프트

```
어드민 리텐션 페이지를 추가해줘.

1. 라우트: /admin/analytics/retention
   페이지 파일: src/pages/admin/AnalyticsRetention.tsx

2. UI 구성:
   - 기준 이벤트 선택 (예: weekly_session_attended)
   - 리텐션 히트맵 테이블
     행: 코호트 주차 (cohort_week)
     열: 경과 주차 (week_num: 0, 1, 2, ...)
     셀: 리텐션율 % (retention_rate × 100, 높을수록 진한 색)

3. 데이터 API:
   GET ${VITE_API_URL}/api/v1/analytics/retention
   쿼리 파라미터: event_name(필수)
   응답 구조 (success/data 래퍼 없음):
   {
     event_name: string,
     data: [
       {
         cohort_week: string,      ← 코호트 주차 라벨 (예: "2026-17")
         week_num: number,         ← 경과 주차 (0 = 첫 주)
         retained: number,
         cohort_size: number,
         retention_rate: number    ← 0~1 float (UI에서 ×100 하여 % 표시)
       }
     ]
   }
   읽는 방법: response.data (flat 배열)
   테이블 렌더링 시: cohort_week별로 그룹핑 후, week_num을 열로 사용

4. 사이드바에 "Analytics > 리텐션" 링크 추가
```

---

## 요청 8 — Feature Flag 관리 페이지

### 복붙 프롬프트

```
어드민 Feature Flag 관리 페이지를 추가해줘.

1. 라우트: /admin/feature-flags
   페이지 파일: src/pages/admin/FeatureFlags.tsx

2. UI 구성:
   - Flag 목록 테이블: flag_key | 설명 | 롤아웃 % | 상태(켜짐/꺼짐) | 수정
   - "새 Flag 생성" 버튼 → 모달
     입력 필드: flag_key(영문소문자+하이픈), 설명, 롤아웃 %(0~100 슬라이더), 활성화 토글
   - 목록에서 인라인으로 켜기/끄기 토글 가능

3. 데이터 API:
   GET    ${VITE_API_URL}/api/v1/feature-flags           목록
   POST   ${VITE_API_URL}/api/v1/feature-flags           생성
   PATCH  ${VITE_API_URL}/api/v1/feature-flags/:key      수정

   FeatureFlag 타입:
   {
     flag_key: string,
     description: string | null,
     rollout_pct: number,         ← 0~100 정수
     enabled: boolean,
     created_at: string,
     updated_at: string
   }

   생성 body:
   { flag_key: string, description?: string, rollout_pct?: number, enabled?: boolean }

   수정 body (모두 선택):
   { description?: string, rollout_pct?: number, enabled?: boolean }

4. 사이드바에 "Feature Flags" 메뉴 추가
```

---

## 요청 9 — 실험(A/B) 관리 페이지

### 복붙 프롬프트

```
어드민 실험 관리 페이지를 추가해줘.

1. 라우트: /admin/experiments
   페이지 파일: src/pages/admin/Experiments.tsx

2. UI 구성:
   - 실험 목록 테이블: 이름 | 가설 | 상태 | 생성일
   - 상태 필터 탭 (전체 / draft / running / completed)
   - 실험 클릭 시 상세 페이지 /admin/experiments/:id

   상세 페이지 구성:
   ① 기본 정보: 이름, 가설, 예상 효과(expected_effect), primary_metric
   ② 상태 변경 버튼
      - draft → running 버튼
      - running → paused, completed 버튼
      - paused → running, completed 버튼
      - completed, archived 는 변경 불가
      → PATCH /api/v1/experiments/:id   body: { status: "running" }   (소문자)
   ③ Variant 목록 (실험에 포함된 variants 배열 표시, 별도 추가 UI 불필요)
   ④ 결과 조회 버튼
      → GET /api/v1/experiments/:id/result
      응답 (직접 반환, success 래퍼 없음):
      {
        experiment_id: string,
        primary_metric: string | null,
        treatment: { variant_name, users, conversions, rate } | null,
        control:   { variant_name, users, conversions, rate } | null,
        uplift: number | null,
        probability_treatment_wins: number | null,
        srm_warning: boolean,
        sample_size: number,
        message: string | null
      }
   ⑤ 결정 기록 섹션
      - 선택: SHIP / HOLD / ROLLBACK
      - 이유 입력 (textarea)
      - 결정자 입력 (decided_by)
      - 저장 → POST /api/v1/decisions
        body: { experiment_id, decision: "SHIP"|"HOLD"|"ROLLBACK", reason, decided_by }
      - 이력 목록 → GET /api/v1/experiments/:id/decisions
   ⑥ 학습 노트 섹션
      - 텍스트 입력 (textarea)
      - 저장 → POST /api/v1/learning-notes
        body: { experiment_id, content, created_by? }
      - 이력 목록 → GET /api/v1/experiments/:id/learning-notes
   ⑦ 회고 가이드 설정 섹션
      - 노출 시작일 datepicker (reflection_start_date, ISO string)
      - 노출 기간 입력 (reflection_window_days, 기본값 7)
      - 저장 → PATCH /api/v1/experiments/:id/reflection-window
        body: { reflection_start_date: "2026-05-01T00:00:00", reflection_window_days: 7 }
        응답: { success: true }
      - 현재 설정값 표시 ("YYYY-MM-DD 부터 N일간 노출")
      - 회고 작성 현황 → GET /api/v1/reflections/summary?experiment_id=:id
        응답:
        {
          total_completed: number,
          by_project_type: [{ type: string, completed: number }]
        }

3. 데이터 API 요약:
   GET    ${VITE_API_URL}/api/v1/experiments?status=    목록 (status 파라미터 소문자)
   POST   ${VITE_API_URL}/api/v1/experiments            생성
   GET    ${VITE_API_URL}/api/v1/experiments/:id        상세
   PATCH  ${VITE_API_URL}/api/v1/experiments/:id        수정 (상태 포함)
   GET    ${VITE_API_URL}/api/v1/experiments/:id/result 결과
   POST   ${VITE_API_URL}/api/v1/decisions
   GET    ${VITE_API_URL}/api/v1/experiments/:id/decisions
   POST   ${VITE_API_URL}/api/v1/learning-notes
   GET    ${VITE_API_URL}/api/v1/experiments/:id/learning-notes
   PATCH  ${VITE_API_URL}/api/v1/experiments/:id/reflection-window
   GET    ${VITE_API_URL}/api/v1/reflections/summary?experiment_id=

4. 사이드바에 "실험(A/B)" 메뉴 추가
```

---

## 요청 10 — 회고 가이드 페이지

### 복붙 프롬프트

```
중간 회고 가이드 페이지를 만들어줘.
데이터는 모두 ${VITE_API_URL} 백엔드에 저장한다. Supabase에는 회고 데이터를 저장하지 않는다.
첨부한 HTML 파일(___standalone_.html)을 디자인 레퍼런스로 사용해줘.

--- 라우트 ---
/reflection/:experimentId
페이지 파일: src/pages/ReflectionGuide.tsx

--- 색상 토큰 ---
--bg: #0f1923
--surface: #16232f
--surface-2: #1c2e3e
--surface-3: #0d1e2b
--border: rgba(255,255,255,0.06)
--border-strong: rgba(255,255,255,0.12)
--text-primary: #f0f4f8
--text-secondary: #a0aab4
--text-hint: #4a5568
--accent: #4a9eff
--accent-bg: rgba(74,158,255,0.10)
--accent-text: #93c5fd
--green: #4ade80
--green-bg: rgba(74,222,128,0.10)
--green-text: #86efac
--amber: #fbbf24
--amber-bg: rgba(251,191,36,0.10)
--amber-text: #fde68a

--- 진입 시 처리 ---

① 제출 여부 확인
   GET ${VITE_API_URL}/api/v1/reflections/check?user_id=&experiment_id=
   응답: { submitted: boolean, completed_at: string | null }
   submitted: true 이면 "이미 회고를 완료하셨습니다" 완료 화면 표시

② 노출 기간 확인
   GET ${VITE_API_URL}/api/v1/experiments/:experimentId
   응답 필드: reflection_start_date (ISO string | null), reflection_window_days (number, 기본 7)
   현재 날짜가 [reflection_start_date, reflection_start_date + reflection_window_days일] 밖이면
   "현재 회고 기간이 아닙니다" 안내 화면 표시

--- 상단 네비게이션 ---
- 왼쪽: 초록 점(온라인 표시) + "← 돌아가기" 버튼 + 빵부스러기
  ("차세대 지능형 실험 플랫폼 › 중간 회고")
- 오른쪽: 공유 버튼 (⤴)
- 하단: 진행도에 따라 width가 변하는 progress bar (--accent 색)

--- 스텝 인디케이터 ---
섹션 A~E 총 5단계를 점(dot)으로 표시
- 현재 섹션: dot 가로로 늘어남 (width: 20px, border-radius: 4px, --accent 색)
- 완료된 섹션: --accent 색
- 미완료: rgba(255,255,255,0.12)

--- 섹션 A — 우리 프로젝트 성격 ---
section-label: "섹션 A"
section-title: "지금 우리 프로젝트는\n어떤 성격인가요?"
section-desc: "프로젝트 방향과 핵심 산출물이 떠오르는 유형을 선택해주세요."

chip-group (단일 선택):
- 연구형 (research) / 구현형 (implementation) / 발표형 (presentation)
  / 문서형 (document) / 오픈소스형 (opensource)
- 선택 시: --accent 테두리 + --accent-bg 배경
- 선택 후 해당 유형의 힌트 카드 표시:
  - 연구형:    "논문 초안, 실험 결과 문서, 데이터셋 정리, 분석 보고서가 중심이에요. GitHub에 실험 코드와 함께 정리하면 더 탄탄해져요."
  - 구현형:    "GitHub 저장소가 가장 중요해요. README 정비, 실행 가능한 코드, 데모 영상 또는 스크린샷도 챙겨두면 좋아요."
  - 발표형:    "발표 슬라이드와 발표 영상(또는 회고 문서)이 핵심이에요. 발표 횟수를 채우는 것이 완주 기준에 직접 연결돼요."
  - 문서형:    "블로그 게시물, 노션/Docs 정리, 가이드 문서가 중심이에요. 공개 가능한 형태로 정리하면 팀 밖에서도 활용할 수 있어요."
  - 오픈소스형: "GitHub 저장소에 LICENSE, README, CONTRIBUTING 파일까지 포함해야 완성도 있는 오픈소스로 인정돼요."

--- 섹션 B — 지금까지의 진행 상태 ---
section-label: "섹션 B"
section-title: "지금까지의 진행 상태"
section-desc: "현재 기록된 참여 현황이에요. 데이터를 보며 흐름을 정리해봐요."

stat-grid (4열, 600px 이하 2열):
- 출석률 / 발표 횟수 / GitHub 업로드 / 게시물·문서
- Supabase 프로필 데이터에서 읽어옴, 값 없으면 "-" 표시
- 각 카드 하단 stat-bar (--green 색 progress bar)

뱃지: "공개 가능한 결과물 있음" (badge-green) / "내부 공유 자료 포함" (badge-amber) 조건부 표시

--- 섹션 C — 남은 기간 핵심 경로 ---
section-label: "섹션 C"
section-title: "남은 기간, 이렇게 가면\n완주에 가까워져요"

action-list: project_type에 따라 추천 산출물 2~3개 (정적 콘텐츠)
- 번호 뱃지(원형, --accent-bg) + 제목 + 설명 + 우선순위 뱃지
- 공개용/비공개용 정리 가이드 한 줄 표시

warm-box (--green-bg 배경):
"지금까지 잘 걸어오고 있어요. 이제 남은 경로를 함께 정리해볼까요? 🌱"

--- 섹션 D — 회고 입력 ---
section-label: "섹션 D"
section-title: "우리 팀의 지금을\n직접 기록해보세요"
section-desc: "짧아도 괜찮아요. 지금 솔직하게 쓰는 것이 가장 좋은 회고예요."

form-block:
1. textarea "지금 가장 잘 되고 있는 점"
   placeholder: "예) 매주 꾸준히 모이고 있고, 서로 막히는 부분을 빠르게 공유하고 있어요."
2. textarea "현재 막히는 점"
   placeholder: "예) 데이터 전처리에서 예상보다 오래 걸리고 있고, GitHub 업로드가 불규칙해요."
3. textarea "남은 기간 가장 중요한 목표 1가지" (min-height: 64px)
   placeholder: "예) 최종 발표 자료를 완성하고 GitHub에 올리기"
4. output-grid (3열, 600px 이하 2열) — 최종 산출물 형태 (복수 선택)
   - GitHub 저장소 / 블로그·게시물 / 발표 슬라이드 / 문서·보고서 / 공개용 자료 / 내부 공유 자료
   - 선택 시: --accent 테두리 + --accent-bg 배경

--- 섹션 E — 제출 ---
section-label: "섹션 E"
section-title: "거의 다 왔어요"
section-desc: "제출하면 빌더와 운영진이 팀 회고 내용을 확인할 수 있어요.\n남은 기간도 함께 완주해봐요 🎯"

제출 전 확인 체크리스트:
- 프로젝트 성격 선택 여부
- 회고 내용 입력 여부 (최소 1개)
- 최종 산출물 형태 선택 여부
- 완료된 항목: ✓ (--green 색), 미완료: ○ (--text-hint 색)

"회고 제출하기 →" 버튼 (초록 그라디언트, linear-gradient(135deg, #22c55e, #16a34a))

하단 안내 문구 (--text-hint 색):
"프로젝트마다 완주의 모양은 조금씩 다릅니다. 우리 팀만의 완주를 응원해요."

--- 제출 API ---
POST ${VITE_API_URL}/api/v1/reflections
body:
{
  experiment_id: string,
  user_id: string,
  project_id: string,
  project_type: "research"|"implementation"|"presentation"|"document"|"opensource",
  output_types: string[],
  response_good: string,
  response_blocked: string,
  response_goal: string,
  final_output_type: string
}
성공 시 → "회고가 완료되었어요 🎉" 완료 화면 전환

--- 이벤트 트래킹 (trackEvent 사용) ---
- 화면 스크롤 도달 시:    trackEvent('reflection_guide_viewed', { experiment_id })
- 섹션 D 첫 입력 시:     trackEvent('reflection_guide_started', { experiment_id })
- 프로젝트 유형 선택 시:  trackEvent('reflection_project_type_selected', { experiment_id, project_type })
- 산출물 선택 시:         trackEvent('reflection_output_type_selected', { experiment_id, output_types })
- 제출 완료 시:           trackEvent('reflection_guide_completed', { experiment_id })

--- UX 톤 ---
- 평가보다 안내, 따뜻한 문구 유지
- 예: "지금까지 잘 걸어오고 있어요. 이제 남은 경로를 함께 정리해볼까요?"
- 예: "남은 기간에 가장 중요한 한 가지를 정리하면, 완주가 훨씬 또렷해집니다."

--- 사이드바 진입 링크 불필요 ---
직접 URL 접근 또는 대시보드 배너(요청 11)로 연결된다.
```

---

## 요청 11 — 대시보드 배너 카드

### 복붙 프롬프트

```
대시보드 홈에 회고 안내 배너 카드를 추가해줘.
첨부한 image.png를 배너 카드의 왼쪽 이미지 영역에 사용해줘.

--- 배너 카드 UI ---
위치: 대시보드 메인 콘텐츠 상단 또는 stat 카드 아래 별도 "배너 영역"

스타일:
- 배경: #0d2035
- 테두리: 1px solid rgba(99,179,237,0.3), border-radius: 12px
- padding: 16px 20px
- 레이아웃: 가로 flex, align-items: center
  ① image.png 이미지 (width: 48px, height: 48px, border-radius: 8px, object-fit: contain)
  ② 텍스트 영역 (flex: 1, margin-left: 16px)
     - 상단 (font-weight: 600, color: #f0f4f8): "중간 회고 작성하기"
     - 하단 (font-size: 12px, color: #a0aab4): "지금까지의 여정을 정리하고 남은 기간 방향을 잡아봐요"
  ③ 오른쪽 끝 화살표 (color: #4a9eff): "→"
- 호버 시: border-color rgba(74,158,255,0.6), cursor: pointer

--- 노출 조건 (두 조건 모두 충족할 때만 배너 표시) ---

조건 ①: 현재 날짜가 회고 노출 기간 안에 있을 것
  - GET ${VITE_API_URL}/api/v1/experiments/:experimentId 의 응답에서
    reflection_start_date (ISO string | null), reflection_window_days (number) 를 읽는다
  - reflection_start_date 가 null 이면 배너 숨김
  - 현재 날짜 < reflection_start_date → 배너 숨김
  - 현재 날짜 > reflection_start_date + reflection_window_days일 → 배너 숨김

조건 ②: 사용자가 아직 회고를 제출하지 않았을 것
  - GET ${VITE_API_URL}/api/v1/reflections/check?user_id=&experiment_id=
  - 응답: { submitted: boolean }
  - submitted: true 이면 배너 숨김

- 두 API 요청은 TanStack Query 캐싱 (staleTime: 5분)
- 실험 ID: 현재 사용자가 속한 실험의 experimentId (기존 대시보드 데이터에서 추출)
  특정 불가 시 import.meta.env.VITE_EXPERIMENT_ID 를 fallback으로 사용

--- 클릭 동작 ---
배너 클릭 시: navigate(`/reflection/${experimentId}`)
```

---

## 요청 순서 (의존성)

```
요청 1 (trackEvent, useIdentify, .env)
  → 요청 2 (이벤트 삽입)
  → 요청 3 (useFeatureFlag)

요청 4~7 (Analytics 페이지) — 독립적, 순서 무관
요청 8 (Feature Flag 관리) — 독립적
요청 9 (실험 관리) — 독립적

요청 10 (회고 가이드) — 요청 1 완료 후 (trackEvent 의존)
  → 요청 11 (대시보드 배너) — 요청 10 완료 후
```

---

## API 응답 구조 주의사항

| 항목 | 응답 구조 |
|------|-----------|
| 이벤트 목록 | `items` 필드 (data 아님) |
| 이벤트 이름 목록 | 배열 직접 반환 (래퍼 없음) |
| 트렌드 데이터 | `response.data` (배열) |
| 퍼널 응답 | `{ steps: [{ step, users, conversion_rate }] }` 직접 반환 |
| 퍼널 step 필드명 | `step` (event_name 아님) |
| 리텐션 응답 | `{ event_name, data: [...] }` flat 배열 (중첩 구조 아님) |
| 리텐션 비율 필드 | `retention_rate` (0~1 float, UI에서 ×100) |
| 실험 상태 값 | 소문자 (draft, running, completed) |
| 실험 상태 변경 엔드포인트 | `PATCH /experiments/:id` (통합) |
| 실험 결과 | success 래퍼 없이 직접 반환 |

---

## 체크리스트

### 이벤트 트래킹
- [ ] posthog-js 제거 (package.json + main.tsx)
- [ ] `src/utils/trackEvent.ts` 생성
- [ ] `src/hooks/useIdentify.ts` 생성 + App.tsx 호출
- [ ] 주간 세션 출석 이벤트 삽입
- [ ] 과제 제출 이벤트 삽입
- [ ] 프로그램 완주 이벤트 삽입
- [ ] `.env`에 `VITE_API_URL`, `VITE_EXPERIMENT_ID` 추가

### Feature Flag
- [ ] `src/hooks/useFeatureFlag.ts` 생성

### Analytics 어드민
- [ ] `/admin/analytics/events` (응답: `items` 필드)
- [ ] `/admin/analytics/trends` (응답: `data` 배열)
- [ ] `/admin/analytics/funnels` (응답: `steps[].step` 필드)
- [ ] `/admin/analytics/retention` (flat `data` 배열, cohort_week + week_num으로 그룹핑)
- [ ] `/admin/feature-flags`
- [ ] `/admin/experiments` + `/admin/experiments/:id`
- [ ] 실험 상세 — 상태값 소문자
- [ ] 실험 상세 — 결과 카드 (success 래퍼 없이 직접 읽기)
- [ ] 실험 상세 — 회고 가이드 설정 섹션
- [ ] 사이드바 메뉴 연결

### 회고 가이드
- [ ] `/reflection/:experimentId` 페이지 (색상 토큰 적용)
- [ ] 상단 nav + progress bar + 스텝 인디케이터
- [ ] 섹션 A: chip-group 단일 선택 + hint-card
- [ ] 섹션 B: stat-grid 4열 (Supabase 프로필 데이터)
- [ ] 섹션 C: project_type별 action-list 정적 콘텐츠
- [ ] 섹션 D: textarea 3개 + output-grid 복수 선택
- [ ] 섹션 E: 체크리스트 + 제출 버튼 + 완료 화면
- [ ] 반응형 (600px 이하 그리드 2열)
- [ ] 노출 기간 체크 (reflection_start_date + window_days)
- [ ] 제출 여부 체크 (submitted: true 이면 완료 화면)
- [ ] POST /api/v1/reflections 연결
- [ ] trackEvent 5종 삽입

### 대시보드 배너
- [ ] 배너 카드 추가 (image.png 사용)
- [ ] 노출 조건 ① reflection 기간 체크
- [ ] 노출 조건 ② /reflections/check API, submitted: true 이면 숨김
- [ ] 배너 클릭 → navigate(`/reflection/${experimentId}`)
- [ ] TanStack Query 캐싱 (staleTime 5분)

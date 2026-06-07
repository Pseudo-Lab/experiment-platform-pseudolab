# @experibase/sdk 사용 가이드

## 패키지 구조

```
packages/sdk/
├── src/
│   ├── core.ts       # ExperibaseSDK 클래스 (프레임워크 비종속)
│   ├── react.tsx     # React Provider, Hooks
│   ├── types.ts      # DecideResult, SDKConfig 타입 정의
│   └── index.ts      # re-export
├── package.json
└── tsconfig.json
```

### 주요 exports
```ts
// 바닐라 JS / Node.js
import { ExperibaseSDK } from '@experibase/sdk'

// React
import {
  ExperibaseProvider,
  useExperibase,
  useDecide,
  useFlag,
} from '@experibase/sdk/react'
```

---

## DecideResult 타입

```ts
interface DecideResult {
  key: string                           // 조회한 flag_key 또는 placement_key
  type: 'flag' | 'placement'           // Feature Flag / 준실험 Placement 구분
  show: boolean                         // 사용자에게 노출 여부
  variant: string | null               // 'control' | 'treatment' | custom
  payload: Record<string, unknown> | null  // placement: { completed, reason }
}
```

---

## decide() API

### A/B 테스트 (Feature Flag 기반)

```ts
const sdk = new ExperibaseSDK({
  apiKey: 'proj_xxxx',
  baseUrl: 'https://api.experibase.io',
})

const result = await sdk.decide('new-checkout-flow')
// { key: 'new-checkout-flow', type: 'flag', show: true, variant: 'treatment', payload: null }

if (result.show) {
  // treatment variant 노출
  renderNewCheckout()
} else {
  // control variant 노출
  renderLegacyCheckout()
}
```

`decide()` 내부 동작:
1. `POST /decide` 호출 (x-api-key 헤더 포함)
2. 서버에서 Feature Flag 조회 → CRC32 해시 기반 variant 배정
3. 응답 수신 후 자동으로 `POST /events` (impression 이벤트) fire-and-forget
4. `DecideResult` 반환

### 준실험 (Placement 기반)

```ts
const result = await sdk.decide('lvup-reflection-placement', {
  userId: 'user-123',
})
// { type: 'placement', show: true, variant: 'treatment', payload: { completed: false, reason: 'active' } }

if (result.show) {
  renderReflectionUI()
  if (result.payload?.completed) {
    showCompletedBadge()
  }
}
```

Placement는 서버에서 cohort/role/시간 윈도우 조건을 검사한다. impression 이벤트는 SDK가 자동 수집한다.

---

## track() 이벤트 수동 수집

```ts
// 전환 이벤트 수동 추적
await sdk.track('checkout_completed', {
  placement_key: 'new-checkout-flow',  // experiment_event 테이블에 연결
  variant: 'treatment',
  order_value: 49900,
})
```

`track()` 내부 동작:
1. `POST /capture` → `event_log` 테이블 (프로젝트 전체 분석용)
2. `POST /events` (conversion 이벤트) → `experiment_event` 테이블 (실험 모니터링용)

`properties`에 `placement_key` (또는 `key`) + `variant`를 포함해야 실험 모니터링 탭에서 conversion이 집계된다.

---

## React 사용법

### ExperibaseProvider 설정

```tsx
// App.tsx
import { ExperibaseProvider } from '@experibase/sdk/react'

function App() {
  return (
    <ExperibaseProvider
      apiKey="proj_xxxx"
      baseUrl="https://api.experibase.io"
      userId={currentUser?.id}           // 로그인 사용자 ID, 없으면 localStorage UUID 자동 생성
      flagKeys={['new-checkout-flow', 'homepage-banner']}  // 초기 일괄 로드할 flag 목록
    >
      <RouterProvider router={router} />
    </ExperibaseProvider>
  )
}
```

`flagKeys`에 나열된 flag는 Provider mount 시 병렬로 `decide()` 호출 → `sessionStorage`에 캐싱. 이후 `useFlag()`로 동기적으로 조회 가능.

### useFlag() - 이미 Provider에서 로드한 flag 조회

```tsx
function CheckoutPage() {
  const variant = useFlag('new-checkout-flow')
  // null: 아직 로딩 중
  // 'control' | 'treatment': 배정된 variant

  if (variant === null) return <Skeleton />
  return variant === 'treatment' ? <NewCheckout /> : <LegacyCheckout />
}
```

### useDecide() - 개별 flag/placement 실시간 조회

```tsx
function ReflectionModal() {
  const { result, loading } = useDecide('lvup-reflection-placement')

  if (loading) return null
  if (!result?.show) return null
  return <ReflectionForm completed={result.payload?.completed} />
}
```

### useExperibase() - SDK 인스턴스 직접 접근

```tsx
function PurchaseButton() {
  const { sdk } = useExperibase()

  const handlePurchase = async () => {
    await processOrder()
    await sdk.track('purchase_completed', {
      placement_key: 'new-checkout-flow',
      variant: 'treatment',
    })
  }

  return <button onClick={handlePurchase}>구매하기</button>
}
```

---

## 바닐라 JS 사용법

```js
import { ExperibaseSDK } from '@experibase/sdk'

const sdk = new ExperibaseSDK({
  apiKey: 'proj_xxxx',
  baseUrl: 'https://api.experibase.io',
})

// 사용자 식별 (로그인 후)
sdk.identify('user-456')

// decide
const result = await sdk.decide('banner-experiment')
document.getElementById('banner').style.display = result.show ? 'block' : 'none'

// track
document.getElementById('cta-btn').addEventListener('click', () => {
  sdk.track('cta_clicked', {
    placement_key: 'banner-experiment',
    variant: result.variant,
  })
})
```

---

## LVUP 같은 외부 서비스 적용 방법

LVUP (러닝 플랫폼)처럼 별도 도메인의 서비스에 ExperiBase SDK를 연동하는 방법:

### 1. 준실험 (Placement) 연동 - LVUP 프로젝션 반성 예시

```ts
// lvup-frontend/src/lib/experibase.ts
import { ExperibaseSDK } from '@experibase/sdk'

export const sdk = new ExperibaseSDK({
  apiKey: process.env.EXPERIBASE_API_KEY,  // LVUP 프로젝트 API Key
  baseUrl: process.env.EXPERIBASE_API_URL,
})
```

```tsx
// 프로젝션 반성 페이지
async function ProjectReflectionPage({ teamId, userId, role }) {
  sdk.identify(userId)

  const result = await sdk.decide('lvup-reflection-v2', {
    userId,
    role,    // 준실험은 서버에서 role 조건 체크
    cohort: teamId,
  })

  if (!result.show) return null  // 해당 사용자는 미노출

  return (
    <ReflectionForm
      onSubmit={async (data) => {
        await submitReflection(data)
        // 전환 이벤트 수동 수집
        await sdk.track('reflection_submitted', {
          placement_key: 'lvup-reflection-v2',
          variant: 'treatment',
          team_id: teamId,
        })
      }}
    />
  )
}
```

### 2. A/B 테스트 연동 - LVUP UI 변경 실험

```tsx
// ExperibaseProvider를 LVUP App 루트에 추가
function LvupApp({ user }) {
  return (
    <ExperibaseProvider
      apiKey={EXPERIBASE_API_KEY}
      baseUrl={EXPERIBASE_API_URL}
      userId={user.id}
      flagKeys={['lvup-dashboard-redesign']}
    >
      <LvupRouter />
    </ExperibaseProvider>
  )
}

// 대시보드 컴포넌트
function Dashboard() {
  const variant = useFlag('lvup-dashboard-redesign')
  return variant === 'treatment' ? <NewDashboard /> : <LegacyDashboard />
}
```

### 3. 서버 사이드 적용 (Next.js / Node.js)

```ts
// pages/api/get-experiment.ts
import { ExperibaseSDK } from '@experibase/sdk'

const sdk = new ExperibaseSDK({
  apiKey: process.env.EXPERIBASE_API_KEY,
  baseUrl: process.env.EXPERIBASE_API_URL,
  userId: 'server-side',  // 서버 측은 userId를 직접 전달
})

export async function getServerSideProps({ req }) {
  const userId = getUserIdFromCookie(req)
  const result = await sdk.decide('feature-key', { userId })
  return { props: { variant: result.variant } }
}
```

---

## 모니터링 데이터 흐름

```
sdk.decide('flag-key')
    │
    ├──▶ POST /decide          → variant 결정
    │                             feature_flag_exposure 기록
    │                             experiment_assignments 기록 (running 실험)
    │
    └──▶ POST /events          → experiment_event 테이블
         { type: 'impression' }   (실험 모니터링 탭에서 집계)

sdk.track('event', { placement_key, variant })
    │
    ├──▶ POST /capture         → event_log 테이블
    │                             (이벤트 분석 탭: 트렌드/퍼널/리텐션)
    │
    └──▶ POST /events          → experiment_event 테이블
         { type: 'conversion' }   (실험 모니터링 탭에서 집계)

[ExperimentAnalyticsService]
    impression + conversion 집계
        → conversion rate per variant
        → 2-proportion z-test
        → p_value, is_significant, winner
```

`POST /events` 는 `x-api-key` 없이 호출되므로 CORS 이슈 없이 브라우저에서 직접 호출 가능. fire-and-forget으로 네트워크 오류는 무시된다.

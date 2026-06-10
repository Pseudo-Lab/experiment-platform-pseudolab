# @experibase/sdk

ExperiBase A/B 테스트 실험에 사용자를 배정하고, 전환 이벤트를 수집하는 JavaScript/TypeScript SDK.

---

## SDK가 수집하는 데이터

### 자동 수집 — `decide()` 호출 시

사용자가 실험에 배정되는 순간 아래 정보가 자동으로 플랫폼에 전송됩니다.

| 항목 | 설명 |
|------|------|
| `experiment_key` | 어느 실험에 배정됐는지 (예: `home_layout_v1`) |
| `variant` | 어느 그룹에 배정됐는지 (예: `list`, `control`) |
| `timestamp` | 언제 배정됐는지 |
| `url` | 어느 페이지에서 호출됐는지 (`window.location.pathname`) |
| `user_id` | 누가 배정됐는지 |

```json
{
  "event_type": "impression",
  "experiment_key": "home_layout_v1",
  "variant": "list",
  "url": "/home",
  "user_id": "user_abc123",
  "timestamp": "2026-06-11T09:00:00Z"
}
```

### 수동 수집 — `track()` 직접 호출

스폰서 클릭, 프로그램 완료처럼 **개발자가 의미 있다고 판단한 시점**에 직접 전송합니다.

```json
{
  "event_type": "conversion",
  "event_name": "sponsor_clicked",
  "placement_key": "sponsor-slot-sidebar",
  "user_id": "user_abc123"
}
```

> 이 이벤트들은 ExperiBase 플랫폼의 **실험 판단 탭**에서 배정 추이 차트와 전환율로 시각화됩니다.

---

## 설치

```bash
npm install @experibase/sdk
```

---

## 기본 사용법 (React)

### 1. 앱 최상단에 Provider 추가

```tsx
import { ExperibaseProvider } from '@experibase/sdk/react'

function App() {
  return (
    <ExperibaseProvider
      apiKey="pk_live_xxxxx"                   // ExperiBase 프로젝트 API 키
      baseUrl="https://api.experibase.com"      // ExperiBase API 주소
      userId="user_123"                         // 현재 로그인한 유저 ID (선택)
      flagKeys={['home_layout_v1']}             // 앱 시작 시 미리 배정받을 실험 목록
    >
      <MyApp />
    </ExperibaseProvider>
  )
}
```

- `userId`를 생략하면 SDK가 `localStorage`에 익명 ID를 자동 생성합니다.
- `flagKeys`에 등록한 실험은 앱 로드 시 한 번에 배정 결과를 받아와 캐시합니다. 로딩 깜빡임을 줄이려면 사용할 실험 키를 모두 여기에 추가하세요.

### 2. 컴포넌트에서 실험 결과 사용

**방법 A — `useFlag`** (Provider에 `flagKeys`를 등록한 경우 권장)

```tsx
import { useFlag } from '@experibase/sdk/react'

function HeroSection() {
  const variant = useFlag('home_layout_v1') // 'list' | 'control' | null

  if (variant === 'list') {
    return <ListLayout />   // 실험군: 리스트 레이아웃
  }
  return <GridLayout />    // 대조군: 그리드 레이아웃 (기본)
}
```

**방법 B — `useDecide`** (특정 컴포넌트에서 즉시 배정이 필요한 경우)

```tsx
import { useDecide } from '@experibase/sdk/react'

function HeroSection() {
  const { result, loading } = useDecide('home_layout_v1')

  if (loading) return <Skeleton />

  if (result?.variant === 'list') {
    return <ListLayout />
  }
  return <GridLayout />
}
```

> **차이점**: `useFlag`는 Provider가 미리 받아온 캐시를 읽고, `useDecide`는 컴포넌트가 마운트될 때 직접 API를 호출합니다.

---

## 전환 이벤트 직접 전송

스폰서 클릭, 버튼 클릭 등 중요한 행동을 기록하려면 `track()`을 사용합니다.

```tsx
import { useExperibase } from '@experibase/sdk/react'

function SponsorBanner() {
  const { sdk } = useExperibase()

  const handleClick = () => {
    // 이벤트 이름과 함께 원하는 속성을 자유롭게 추가할 수 있습니다
    sdk.track('sponsor_clicked', {
      placement_key: 'sponsor-slot-sidebar',
      sponsor_id: 'sponsor_123',
    })
  }

  return <button onClick={handleClick}>스폰서 보기</button>
}
```

플랫폼 **실험 판단 탭 → 전환율** 항목에서 이 이벤트 기반의 통계를 확인할 수 있습니다.

---

## 바닐라 JS (React 없는 환경)

Next.js 서버 컴포넌트, Node.js, 또는 순수 JS 환경에서는 클래스를 직접 사용합니다.

```ts
import { ExperibaseSDK } from '@experibase/sdk'

const sdk = new ExperibaseSDK({
  apiKey: 'pk_live_xxxxx',
  baseUrl: 'https://api.experibase.com',
  userId: 'user_123', // 생략 시 자동 생성
})

// 실험 배정 (impression 이벤트 자동 전송)
const result = await sdk.decide('home_layout_v1')
console.log(result.variant) // 'list' 또는 'control'

// 전환 이벤트 수동 전송
await sdk.track('sponsor_clicked', { placement_key: 'sponsor-slot-sidebar' })

// 로그인 후 유저 ID를 알게 됐을 때 업데이트
sdk.identify('user_123')
```

---

## 플랫폼에서 결과 확인

ExperiBase 플랫폼의 **실험 판단 탭**에서 다음을 확인할 수 있습니다.

- **배정 추이 차트** — `decide()` 호출 시 자동 전송된 impression 이벤트 기반
- **전환율** — `track()`으로 보낸 이벤트 기반 통계
- **의사결정 로그** — SHIP / HOLD / ROLLBACK 기록

---

## API Key 발급

**ExperiBase 플랫폼 → 프로젝트 선택 → SDK 연동 탭**에서 `pk_live_` 로 시작하는 API 키를 확인할 수 있습니다.

---

## API 요약

### `ExperibaseSDK` (core)

| 메서드 | 설명 |
|--------|------|
| `decide(key)` | 실험 배정 결과를 가져옵니다. impression 이벤트를 자동 전송합니다. |
| `track(event, props?)` | 전환 이벤트를 수동으로 전송합니다. |
| `identify(userId)` | 로그인 후 유저 ID를 업데이트합니다. |

### React 훅

| 훅 | 설명 |
|----|------|
| `useFlag(key)` | Provider가 캐시한 배정 결과를 즉시 반환합니다. |
| `useDecide(key)` | 컴포넌트 마운트 시 배정을 요청하고 `{ result, loading }`을 반환합니다. |
| `useExperibase()` | SDK 인스턴스와 전체 컨텍스트에 접근합니다. |

# @pseudo-lab/experibase-sdk

---

## 설치

### 1. 인증 설정 (.npmrc)
프로젝트 루트에 `.npmrc` 파일을 만들고 아래 내용을 추가합니다.

```
@pseudo-lab:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

> GitHub Personal Access Token은 GitHub → Settings → Developer settings → Personal access tokens에서 발급합니다. `read:packages` 권한이 필요합니다.

### 2. 패키지 설치
```bash
npm install @pseudo-lab/experibase-sdk
```

---

## 시작 전에 — ExperiBase 플랫폼에서 준비할 것

1. 프로젝트 생성
2. API Key 복사 (SDK 연동 탭에서 확인)
3. 실험 생성 후 실험 key 확인 (예: `home_layout_v1`)

---

## Step 1 — 앱에 SDK 등록하기

앱 최상단 (React의 경우 App.tsx나 main.tsx)에 Provider를 추가합니다.
이 한 번만 하면 앱 전체에서 SDK를 쓸 수 있습니다.

```tsx
import { ExperibaseProvider } from '@pseudo-lab/experibase-sdk/react'

function App() {
  return (
    <ExperibaseProvider
      apiKey="pk_live_xxxxx"        // ExperiBase에서 복사한 API Key
      baseUrl="https://api.experibase.com"
    >
      <나머지앱 />
    </ExperibaseProvider>
  )
}
```

---

## Step 2 — 실험을 보여줄 위치에 코드 추가하기

화면을 다르게 보여주고 싶은 컴포넌트에서 `useFlag`를 사용합니다.
이 코드가 실행되는 순간 ExperiBase가 "이 유저에게 어떤 화면을 보여줄지"를 결정합니다.

```tsx
import { useFlag } from '@pseudo-lab/experibase-sdk/react'

function HeroSection() {
  const variant = useFlag('home_layout_v1')
  // variant는 'list' 또는 'control' 중 하나

  if (variant === 'list') {
    return <리스트형레이아웃 />   // B 화면 (실험군)
  }
  return <그리드레이아웃 />       // A 화면 (대조군, 기본)
}
```

---

## Step 3 — 중요한 행동이 일어날 때 기록하기 (선택)

버튼 클릭, 구매, 완료 같은 이벤트를 기록하면
ExperiBase 플랫폼에서 "B 화면이 실제로 더 효과적인가"를 측정할 수 있습니다.

```tsx
import { useExperibase } from '@pseudo-lab/experibase-sdk/react'

function SponsorBanner() {
  const { sdk } = useExperibase()

  return (
    <button onClick={() => sdk.track('sponsor_clicked')}>
      스폰서 보기
    </button>
  )
}
```

---

## Step 4 — 플랫폼에서 결과 확인

ExperiBase → 실험 관리 → 실험 클릭 → **실험 판단** 탭

- **배정 추이**: 몇 명이 각 화면을 봤는지
- **전환율**: `track()`으로 기록한 이벤트가 각 화면에서 얼마나 발생했는지
- **의사결정**: 실험을 계속할지, 배포할지, 되돌릴지 기록

---

## Step 5 — SDK가 자동으로 수집하는 것

Step 2에서 `useFlag()`를 호출하는 순간, 아래 정보가 ExperiBase에 자동으로 전송됩니다.
개발자가 별도로 코드를 작성할 필요 없습니다.

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

Step 3처럼 `sdk.track()`을 호출할 때만 아래 정보가 전송됩니다.

```json
{
  "event_type": "sponsor_clicked",
  "experiment_key": "home_layout_v1",
  "variant": "list",
  "user_id": "user_abc123"
}
```

---

## React 없는 환경 (바닐라 JS)

```ts
import { ExperibaseSDK } from '@pseudo-lab/experibase-sdk'

const sdk = new ExperibaseSDK({
  apiKey: 'pk_live_xxxxx',
  baseUrl: 'https://api.experibase.com'
})

// Step 2: 화면 결정
const result = await sdk.decide('home_layout_v1')
if (result.variant === 'list') {
  showListLayout()
} else {
  showGridLayout()
}

// Step 3: 이벤트 기록
sdk.track('sponsor_clicked')
```

---

## 자주 묻는 질문

**Q. 유저 ID를 따로 넣어야 하나요?**
아니오. 따로 설정하지 않으면 SDK가 자동으로 익명 ID를 만들어 사용합니다.
로그인한 유저 ID가 있다면 `sdk.identify('user_123')`으로 연결할 수 있습니다.

**Q. 실험 key는 어디서 확인하나요?**
ExperiBase → 실험 관리 → 실험 클릭 → 개요 탭에서 확인할 수 있습니다.

**Q. A/B 테스트와 준실험의 차이가 있나요?**
사용 방법은 동일합니다. 차이는 플랫폼 설정에서만 나뉩니다.

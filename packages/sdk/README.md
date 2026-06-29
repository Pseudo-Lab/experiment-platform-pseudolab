# ExperiBase SDK

앱에 붙이면 실험 결과를 자동으로 수집해주는 도구.

---

## 이 SDK를 붙이면 알 수 있는 것

### 1. 몇 명이 어느 화면을 봤는가 (자동 수집)

`decide()` 또는 `useFlag()`를 호출하는 순간, 아래 정보가 자동으로 ExperiBase로 전송됩니다.
별도 코드 없이 즉시 알 수 있습니다.

> 예시: "home_layout 실험에서 control 142명, list 127명이 배정됨"

플랫폼 **실험 판단 > P0 배정 추이** 차트에서 확인할 수 있습니다.

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

---

### 2. 어떤 화면이 더 많은 행동을 이끌어냈는가 (직접 기록)

`sdk.track(이벤트명)`으로 버튼 클릭, 가입 완료, 구매 등을 기록하면
어느 화면을 본 유저가 더 많이 행동했는지 알 수 있습니다.

> 예시: "sidebar variant를 본 유저가 sponsor_clicked를 3.2% 더 많이 눌렀음"

플랫폼 **실험 판단 > P1 전환율** 차트에서 자동으로 계산됩니다.

```json
{
  "event_type": "sponsor_clicked",
  "experiment_key": "sponsor_slot_v1",
  "variant": "sidebar",
  "user_id": "user_abc123"
}
```

---

### 3. 이 차이가 우연인가, 진짜인가 (자동 계산)

수집된 데이터를 바탕으로 통계적 유의성을 자동으로 계산합니다.
직접 계산할 필요 없습니다.

> 확인할 수 있는 수치: p-value, SRM 경고, 표본 수, P(T>C)

플랫폼 **실험 판단 > SRM 경고 / P(T>C) 수치**에서 확인할 수 있습니다.

---

## 수집되지 않는 것

- **개인정보 (이름, 이메일, 전화번호)** — SDK는 수집하지 않습니다.
- **`user_id`** — SDK가 생성하지 않습니다. 서비스에서 직접 전달한 값만 사용합니다.
- **"어떤 버튼을 눌렀는지"** — SDK 설치만으로는 알 수 없습니다. `track()`으로 직접 기록해야 합니다.

---

## 설치

```
npm install @pseudo-lab/experibase-sdk
```

> npmjs public package로 배포합니다. 소비 앱에서는 GitHub token이나 별도 `.npmrc` 설정이 필요하지 않습니다.

---

## 기본 연결 코드 (React)

앱 최상단(App.tsx 또는 main.tsx)에 Provider를 한 번 추가하면 앱 전체에서 SDK를 사용할 수 있습니다.

```tsx
import { ExperibaseProvider } from '@pseudo-lab/experibase-sdk/react'

function App() {
  return (
    <ExperibaseProvider
      apiKey="pk_live_xxxxx"
      baseUrl="https://api.experibase.com"
    >
      <나머지앱 />
    </ExperibaseProvider>
  )
}
```

---

## 더 자세한 설치 및 사용법

→ [SDK_PACKAGING_GUIDE.md](./SDK_PACKAGING_GUIDE.md)

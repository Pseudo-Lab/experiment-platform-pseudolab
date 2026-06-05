# @experibase/sdk

ExperiBase SDK — feature flag & A/B test client for JavaScript/TypeScript and React.

## Install

```bash
npm install @experibase/sdk
```

## Quick start (React)

```tsx
import { ExperibaseProvider, useFlag } from '@experibase/sdk/react'

function App() {
  return (
    <ExperibaseProvider
      apiKey="pk_live_..."
      baseUrl="https://your-api.example.com/api/v1"
      flagKeys={['hero_layout_v1', 'cta_color_v2']}
    >
      <MyApp />
    </ExperibaseProvider>
  )
}

function MyComponent() {
  const variant = useFlag('hero_layout_v1') // 'control' | 'treatment' | null
  return variant === 'treatment' ? <NewHero /> : <DefaultHero />
}
```

## Quick start (vanilla JS)

```ts
import { ExperibaseSDK } from '@experibase/sdk'

const sdk = new ExperibaseSDK({
  apiKey: 'pk_live_...',
  baseUrl: 'https://your-api.example.com/api/v1',
})

const result = await sdk.decide('hero_layout_v1')
console.log(result.variant) // 'control' | 'treatment'

await sdk.track('button_clicked', { page: 'home' })
```

See [SDK_PACKAGING_GUIDE.md](./SDK_PACKAGING_GUIDE.md) for full documentation.

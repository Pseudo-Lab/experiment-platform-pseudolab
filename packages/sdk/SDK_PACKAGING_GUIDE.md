# ExperiBase SDK Packaging Guide

`@pseudo-lab/experibase-sdk` — ExperiBase 플랫폼의 공식 클라이언트 SDK.
Feature flag 결정, A/B 테스트 노출, 이벤트 트래킹을 위한 경량 TypeScript 라이브러리입니다.

---

## 목차

1. [패키지 구조](#1-패키지-구조)
2. [로컬 개발 방법](#2-로컬-개발-방법)
3. [npm 배포 방법](#3-npm-배포-방법)
4. [외부 서비스에서 사용하기](#4-외부-서비스에서-사용하기)
5. [React 환경 예시](#5-react-환경-예시)
6. [바닐라 JS 환경 예시](#6-바닐라-js-환경-예시)
7. [`decide()` API 레퍼런스](#7-decide-api-레퍼런스)
8. [이벤트 트래킹](#8-이벤트-트래킹)
9. [알려진 제한사항](#9-알려진-제한사항)

---

## 1. 패키지 구조

```
packages/sdk/
├── src/
│   ├── types.ts       — 공통 타입 정의 (DecideResult, SDKConfig)
│   ├── core.ts        — ExperibaseSDK 클래스 (프레임워크 의존성 없음)
│   ├── react.tsx      — React 훅 & 프로바이더 (ExperibaseProvider, useFlag, useDecide)
│   └── index.ts       — core + types re-export
├── dist/              — tsc 빌드 결과물 (npm 배포 시 포함)
├── package.json
├── tsconfig.json
├── README.md
└── SDK_PACKAGING_GUIDE.md  ← 이 파일
```

### 각 파일 역할

| 파일 | 내용 |
|------|------|
| `types.ts` | `DecideResult`, `SDKConfig` 인터페이스 정의 |
| `core.ts` | HTTP 통신 담당 `ExperibaseSDK` 클래스. React 불필요 |
| `react.tsx` | `ExperibaseProvider`, `useFlag`, `useDecide`, `useExperibase` |
| `index.ts` | 패키지 진입점. `core` + `types`를 re-export |

---

## 2. 로컬 개발 방법

### 방법 A — 소스 직접 참조 (모노레포 권장)

ExperiBase 모노레포 내부에서 작업할 때 사용합니다.  
별도 빌드 없이 TypeScript 소스를 직접 사용합니다.

**frontend/package.json**
```json
{
  "dependencies": {
    "@pseudo-lab/experibase-sdk": "file:../packages/sdk"
  }
}
```

**frontend/tsconfig.json** — path alias 추가
```json
{
  "compilerOptions": {
    "paths": {
      "@pseudo-lab/experibase-sdk": ["../packages/sdk/src/index.ts"],
      "@pseudo-lab/experibase-sdk/react": ["../packages/sdk/src/react.tsx"]
    }
  }
}
```

**frontend/vite.config.ts** — Vite alias 추가
```ts
import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: [
      { find: '@pseudo-lab/experibase-sdk/react', replacement: path.resolve(__dirname, '../packages/sdk/src/react.tsx') },
      { find: '@pseudo-lab/experibase-sdk', replacement: path.resolve(__dirname, '../packages/sdk/src/index.ts') },
    ],
  },
})
```

```bash
# frontend 디렉토리에서
npm install
npm run dev
```

TypeScript와 Vite가 모두 SDK 소스 파일을 직접 참조하므로 SDK를 수정하면 즉시 반영됩니다.

---

### 방법 B — 빌드 후 참조

SDK를 독립적으로 빌드하고, 빌드 결과물을 사용합니다.

```bash
# SDK 빌드
cd packages/sdk
npm install          # (react를 devDep으로 추가한 경우)
npx tsc

# frontend에서 설치
cd ../frontend
npm install          # file: 참조를 통해 dist/ 파일 사용
```

이 방법에서는 tsconfig paths와 Vite alias가 필요 없습니다.

---

### 방법 C — npm link

```bash
# SDK 빌드
cd packages/sdk
npx tsc
npm link

# 소비 앱에서 링크
cd /path/to/your-app
npm link @pseudo-lab/experibase-sdk
```

변경 시마다 `npx tsc`(또는 `npx tsc --watch`)로 재빌드해야 합니다.

---

## 3. npm 배포 방법

### 사전 준비

1. `packages/sdk/package.json`에 `@types/react`를 devDependencies에 추가합니다.
2. npm 계정이 필요하며 `@pseudo-lab` 스코프에 퍼블리시 권한이 있어야 합니다.
3. GitHub Actions 배포를 쓰는 경우 repository secret `NPM_TOKEN`을 등록합니다.

### npm 계정/권한 준비

1. npmjs.com에서 배포 담당자 계정을 생성하고 2FA를 활성화합니다.
2. `@pseudo-lab` npm organization 또는 scope를 준비합니다.
3. 배포 담당자 계정이 `@pseudo-lab/experibase-sdk`를 publish할 수 있는 권한을 갖는지 확인합니다.
4. GitHub Actions에서 배포할 경우 npm Access Tokens에서 publish 가능한 token을 생성합니다.
   - CI/CD용 token은 2FA 요구를 통과할 수 있어야 합니다.
   - 가능하면 장기 token 대신 npm Trusted Publishing(OIDC) 전환을 우선 검토합니다.
5. 생성한 token 값은 GitHub repository secret `NPM_TOKEN`에만 저장합니다. 문서나 코드에 평문으로 남기지 않습니다.

### 첫 npm publish 체크리스트

목표는 외부 프로젝트에서 아래처럼 설치/import할 수 있게 만드는 것입니다.

```bash
npm install @pseudo-lab/experibase-sdk
```

```tsx
import { ExperibaseProvider } from '@pseudo-lab/experibase-sdk/react'
```

조직 계정 준비 이후 첫 배포는 아래 순서로 진행합니다.

1. npm organization에서 배포 담당자 권한을 확인합니다.
   - `@pseudo-lab` organization 또는 scope가 있어야 합니다.
   - 배포 담당자 계정이 `@pseudo-lab/experibase-sdk`를 publish할 수 있어야 합니다.
   - 첫 publish 전에는 `npm view @pseudo-lab/experibase-sdk`가 404로 나오는 것이 정상입니다.
2. npm access token을 준비합니다.
   - GitHub Actions에서 publish할 수 있는 token을 만듭니다.
   - token 값은 GitHub secret `NPM_TOKEN`에만 저장합니다.
   - token 값, OTP, recovery code는 문서/코드/이슈에 남기지 않습니다.
3. GitHub repository settings를 준비합니다.
   - Environment: `npm-publish`
   - Secret: `NPM_TOKEN`
4. 태그 push 전에 로컬에서 배포 전 검증을 실행합니다.

```bash
cd packages/sdk
npm ci
npm run typecheck
npm run build
npm pack --dry-run
npm publish --dry-run --access public
```

5. `sdk-v*` 태그를 push해 GitHub Actions 배포를 실행합니다.
   - workflow는 install, typecheck, build, `npm pack --dry-run`, `npm publish --dry-run --access public`을 먼저 수행합니다.
   - 모든 검증이 통과하면 같은 workflow에서 `npm publish --access public --provenance`를 실행합니다.
   - 태그 push가 실제 publish까지 수행하므로, 태그 버전과 package version을 push 전에 반드시 확인합니다.

```bash
git tag sdk-v0.1.4
git push origin sdk-v0.1.4
```

6. 배포 후 npm registry에서 확인합니다.

```bash
npm view @pseudo-lab/experibase-sdk version --registry=https://registry.npmjs.org
npm view @pseudo-lab/experibase-sdk dist-tags --registry=https://registry.npmjs.org
```

7. 외부 소비 프로젝트에서 설치를 확인합니다.

```bash
npm install @pseudo-lab/experibase-sdk
```

### 빌드 및 배포

```bash
cd packages/sdk

# 의존성 설치 (빌드 도구용)
npm install

# 빌드
npm run build
# 결과물: dist/index.js, dist/react.js, dist/*.d.ts

# 버전 올리기 (semver)
npm version patch   # 0.1.0 → 0.1.1
npm version minor   # 0.1.0 → 0.2.0
npm version major   # 0.1.0 → 1.0.0

# 배포
npm publish --access public
```

### GitHub Actions 배포

SDK 배포는 `.github/workflows/publish-sdk.yml`에서 수행합니다.
`package.json`의 버전을 올린 뒤 같은 버전의 `sdk-v*` 태그를 push하면 npmjs public registry로 배포됩니다.
아직 배포하지 않을 때는 `sdk-v*` 태그를 push하지 않습니다.

npm registry에는 빈 패키지 페이지를 먼저 만들어두는 절차가 없습니다.
`@pseudo-lab` organization/scope와 GitHub workflow만 먼저 준비하고, 실제 package entry는 첫 publish 시점에 생성됩니다.
Trusted Publishing(OIDC)을 쓰는 경우 package settings에서 trusted publisher를 등록해야 하므로, 첫 publish 이후 전환하는 흐름이 자연스럽습니다.
그 전까지는 repository secret `NPM_TOKEN`을 사용하거나, 로컬에서 2FA로 첫 publish를 수행합니다.

GitHub repository settings에서 environment `npm-publish`를 만듭니다.
리뷰 가능한 사람이 있으면 required reviewers를 설정하고, 없으면 설정하지 않아도 됩니다.

`sdk-v*` 태그를 push하면 workflow가 실제 npm publish까지 수행합니다.
workflow 안에서 install, typecheck, build, `npm pack --dry-run`, `npm publish --dry-run --access public`을 먼저 실행한 뒤 publish합니다.
태그 push 전 로컬에서 같은 검증을 먼저 실행하고, package version과 tag version이 일치하는지 확인합니다.

```bash
cd packages/sdk
npm version patch
cd ../..
git push origin main
git tag sdk-v0.1.5
git push origin sdk-v0.1.5
```

태그 버전과 `packages/sdk/package.json`의 `version`이 다르면 workflow가 실패합니다.

### 배포 전 체크리스트

- [ ] `dist/` 파일이 최신 소스로 빌드되었는지 확인
- [ ] `package.json`의 `version` 업데이트
- [ ] `exports` 필드의 경로가 `dist/` 파일과 일치하는지 확인
- [ ] `peerDependencies`에 `react: ">=18"` 명시되어 있는지 확인
- [ ] `files` 필드에 `dist`, `src`가 포함되어 있는지 확인
- [ ] `npm run typecheck` 통과
- [ ] `npm pack --dry-run` 출력 확인
- [ ] `CHANGELOG.md` (선택) 업데이트

### 빌드 후 패키지 구조 확인

```bash
npm pack --dry-run
# 출력에 dist/, src/ 파일이 포함되어야 합니다
```

---

## 4. 외부 서비스에서 사용하기

### 외부 React 앱

```bash
npm install @pseudo-lab/experibase-sdk
```

```tsx
// app.tsx (또는 진입점)
import { ExperibaseProvider } from '@pseudo-lab/experibase-sdk/react'

export default function App() {
  return (
    <ExperibaseProvider
      apiKey="pk_live_..."
      baseUrl="https://api.experibase.io/api/v1"
      flagKeys={['hero_cta_v1', 'pricing_layout_v2']}
    >
      <Router />
    </ExperibaseProvider>
  )
}
```

```tsx
// 컴포넌트에서
import { useFlag, useDecide } from '@pseudo-lab/experibase-sdk/react'

function HeroSection() {
  const variant = useFlag('hero_cta_v1')

  if (variant === 'bold') return <BoldHero />
  return <DefaultHero />
}
```

### Next.js (App Router)

```tsx
// app/providers.tsx
'use client'
import { ExperibaseProvider } from '@pseudo-lab/experibase-sdk/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ExperibaseProvider
      apiKey={process.env.NEXT_PUBLIC_EXPERIBASE_API_KEY!}
      baseUrl={process.env.NEXT_PUBLIC_EXPERIBASE_URL!}
      flagKeys={['feature_a', 'feature_b']}
    >
      {children}
    </ExperibaseProvider>
  )
}
```

---

## 5. React 환경 예시

### Provider 설정

```tsx
import { ExperibaseProvider } from '@pseudo-lab/experibase-sdk/react'

function App() {
  return (
    <ExperibaseProvider
      apiKey="pk_live_xxxx"
      baseUrl="https://your-backend.com/api/v1"
      // 선택: 특정 userId를 사용할 때
      userId="user_abc123"
      // 앱 시작 시 일괄 prefetch할 플래그 목록
      flagKeys={['layout_v1', 'checkout_flow_v2', 'new_dashboard']}
    >
      <App />
    </ExperibaseProvider>
  )
}
```

### `useFlag` — 간단한 변수 읽기

```tsx
import { useFlag } from '@pseudo-lab/experibase-sdk/react'

function CheckoutButton() {
  const variant = useFlag('checkout_flow_v2')
  // variant: 'control' | 'streamlined' | null (로딩 중)

  return (
    <button className={variant === 'streamlined' ? 'btn-primary' : 'btn-default'}>
      {variant === 'streamlined' ? '바로 결제' : '장바구니에 추가'}
    </button>
  )
}
```

### `useDecide` — 전체 결과 읽기

```tsx
import { useDecide } from '@pseudo-lab/experibase-sdk/react'

function SponsorBanner({ slotId }: { slotId: string }) {
  const { result, loading } = useDecide(slotId)

  if (loading) return <Skeleton />
  if (!result?.show) return null

  return (
    <div>
      <p>Variant: {result.variant}</p>
      <p>Type: {result.type}</p>
    </div>
  )
}
```

### `useExperibase` — SDK 인스턴스 직접 접근

```tsx
import { useExperibase } from '@pseudo-lab/experibase-sdk/react'

function TrackButton() {
  const { sdk, variants } = useExperibase()

  const handleClick = () => {
    sdk.track('button_clicked', {
      page: 'home',
      ...variants,   // 현재 활성 변수들을 자동 포함
    })
  }

  return <button onClick={handleClick}>클릭</button>
}
```

---

## 6. 바닐라 JS 환경 예시

React 없이 순수 TypeScript/JavaScript 환경에서 사용합니다.

### 초기화

```ts
import { ExperibaseSDK } from '@pseudo-lab/experibase-sdk'

const sdk = new ExperibaseSDK({
  apiKey: 'pk_live_xxxx',
  baseUrl: 'https://your-backend.com/api/v1',
  // 선택: userId를 지정하지 않으면 localStorage에서 자동 생성
  userId: 'user_abc123',
})
```

### Feature Flag 결정

```ts
const result = await sdk.decide('hero_layout_v1')

console.log(result.key)     // 'hero_layout_v1'
console.log(result.type)    // 'flag' | 'placement'
console.log(result.show)    // true | false
console.log(result.variant) // 'control' | 'treatment' | null
console.log(result.payload) // 추가 데이터 | null

if (result.variant === 'treatment') {
  document.getElementById('hero')?.classList.add('treatment')
}
```

### userId 설정/변경

```ts
// 로그인 후 실제 userId로 교체
sdk.identify('authenticated-user-123')

// 이후 decide/track 호출은 새 userId 사용
const result = await sdk.decide('premium_feature')
```

### Node.js 서버 사이드

```ts
import { ExperibaseSDK } from '@pseudo-lab/experibase-sdk'

// 요청별로 userId를 직접 주입
const sdk = new ExperibaseSDK({
  apiKey: process.env.EXPERIBASE_API_KEY!,
  baseUrl: process.env.EXPERIBASE_BASE_URL!,
})

app.get('/api/page-config', async (req, res) => {
  const userId = req.session.userId
  const result = await sdk.decide('page_layout', { userId })
  res.json({ layout: result.variant })
})
```

---

## 7. `decide()` API 레퍼런스

### `ExperibaseSDK.decide(key, options?)`

통합 decide 엔드포인트(`POST /decide`)를 호출합니다.  
Feature flag와 placement 모두 처리합니다.

**파라미터**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `key` | `string` | ✓ | flag 또는 placement 키 |
| `options.userId` | `string` | — | SDK 인스턴스의 userId를 재정의 |

**반환값 (`DecideResult`)**

```ts
interface DecideResult {
  key: string                             // 요청한 키
  type: 'flag' | 'placement'             // 결정 타입
  show: boolean                           // 노출 여부
  variant: string | null                  // 배정된 변수 (없으면 null)
  payload: Record<string, unknown> | null // 추가 데이터
}
```

**예시 응답**

```json
{
  "key": "hero_layout_v1",
  "type": "flag",
  "show": true,
  "variant": "treatment",
  "payload": null
}
```

### React의 `useFlag(flagKey)` vs `useDecide(key)`

| 훅 | 반환 | 사용 시나리오 |
|----|------|--------------|
| `useFlag(key)` | `string \| null` | 단순 변수 분기 |
| `useDecide(key)` | `{ result, loading }` | 노출 여부(show), payload, 로딩 상태가 필요한 경우 |

### 세션 캐싱

`ExperibaseProvider`는 결정 결과를 `sessionStorage`에 캐시합니다.

- **캐시 키**: `experibase:flag:{flagKey}:{userId}`
- **캐시 범위**: 브라우저 탭 세션 (탭 닫으면 만료)
- **캐시 무효화**: `sessionStorage.clear()` 또는 새 탭 열기

---

## 8. 이벤트 트래킹

### `ExperibaseSDK.track(event, properties?)`

사용자 이벤트를 `POST /capture` 엔드포인트로 전송합니다.

```ts
await sdk.track('study_card_clicked', {
  study_id: 'study-001',
  position: 3,
  variant: 'grid',    // A/B 테스트 변수 포함 권장
})
```

### React에서의 트래킹

```tsx
import { useExperibase } from '@pseudo-lab/experibase-sdk/react'

function StudyCard({ studyId }: { studyId: string }) {
  const { sdk, variants } = useExperibase()

  const handleClick = () => {
    sdk.track('study_card_clicked', {
      study_id: studyId,
      ...variants,  // 현재 실험 변수 일괄 포함
    })
  }

  return <div onClick={handleClick}>...</div>
}
```

### 트래킹 속성 권장 패턴

| 속성 | 설명 | 예시 |
|------|------|------|
| `variant` | A/B 테스트 변수 | `'control'`, `'treatment'` |
| `flag_key` | 관련 플래그 키 | `'hero_layout_v1'` |
| `page` | 이벤트 발생 페이지 | `'home'`, `'checkout'` |
| `position` | 목록 내 위치 | `0`, `1`, `2` |

---

## 9. 알려진 제한사항

### Visual Changes 미지원

`ExperibaseProvider`는 통합 `/decide` 엔드포인트를 사용합니다.  
플래그별 `/feature-flags/decide` 엔드포인트의 `visual_changes` 응답은 SDK를 통해 전달되지 않습니다.

- **비주얼 에디터 (postMessage 방식)**: 정상 동작
- **API 응답의 `visual_changes`**: ExperibaseProvider를 통해서는 미지원

데모앱에서는 `decideFlag()` (로컬 `lib/sdk.ts`)를 통해 이 기능을 유지하고 있습니다.  
향후 버전에서 `payload`를 통한 visual_changes 전달이 추가될 예정입니다.

### SSR (서버사이드 렌더링)

`ExperibaseSDK`는 `localStorage`, `sessionStorage`, `window` 접근 시 `typeof` 가드를 사용합니다.  
SSR 환경에서는 `userId`를 직접 주입해 사용해야 합니다:

```ts
const sdk = new ExperibaseSDK({
  apiKey: process.env.EXPERIBASE_API_KEY!,
  baseUrl: process.env.EXPERIBASE_BASE_URL!,
  userId: req.cookies.userId,  // 서버에서 직접 userId 주입
})
```

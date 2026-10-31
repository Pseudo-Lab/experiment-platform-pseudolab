# ExperiBase SDK Packaging Guide

`@pseudo-lab/experibase-sdk` — ExperiBase 플랫폼의 공식 클라이언트 SDK.
Feature flag 결정, A/B 테스트 노출, 이벤트 트래킹을 위한 경량 TypeScript 라이브러리입니다.

---

## 현재 배포판 빠른 연동 및 가이드 탭 구성 초안

확인 기준: `origin/main be4485e`의 SDK/키/수집 코드, npm registry `latest=0.1.5` 및 실제 설치한 0.1.5 패키지의 mock-fetch 검증. 현재 운영 런타임 SHA와 실제 운영 이벤트 저장은 이번 작업에서 확인하지 않았습니다. 아래 기존 패키징 절보다 이 절의 현재 계약 구분을 우선합니다. #20 미배포 후보는 [README](./README.md)를 따릅니다.

### 1. 설치·프로젝트·공개 키

```sh
npm install --save-exact @pseudo-lab/experibase-sdk@0.1.5
```

관리자로 플랫폼에 로그인하여 프로젝트를 만들고, 선택한 프로젝트의 SDK 연동 화면에서 **프로젝트 공개 SDK 키**를 확인합니다. 프로젝트 생성 API는 관리자 세션으로 `POST /api/v1/projects/`, 본문 예시는 `{"id":"guide-demo","name":"Guide demo","project_type":"ab_test"}`입니다. 응답은 키를 포함하지 않으며, 키 조회는 인증된 `GET /api/v1/projects/guide-demo/api-key`입니다. 관리 세션이나 서버 credential을 소비 앱에 전달하지 않습니다.

브라우저 SDK의 `apiKey`는 `x-api-key`로 보내는 공개 키입니다. `sk_live_...` 서버 credential은 브라우저/프런트엔드 환경변수에 넣지 않습니다. 현재 main 백엔드는 공개 키와 서버 Bearer credential을 구분합니다. 다만 SDK 연동 화면의 키 설명에는 과거의 “서버 접근 판단에 함께 쓰는 키” 문구가 남아 있어, 탭 구현 담당자가 문구를 별도로 정합화해야 합니다. 화면 설명과 실제 키 용도가 다르면 백엔드의 공개 키/서버 credential 구분을 확인하세요.

`baseUrl`은 **플랫폼 API 주소 + `/api/v1`**입니다. 프로젝트 설정의 “앱 도메인”은 소비 서비스/Visual Editor 대상 URL이므로 SDK API 주소로 복사하지 않습니다. 아래 `.invalid` 주소와 키는 실행 불가능한 가짜 예시입니다.

### 2. 현재 0.1.5의 판단·실제 노출·행동 예시

같은 프로젝트의 flag와 A/B 실험을 만들고 flag를 연결한 뒤 실행 조건을 충족합니다. primary metric은 아래 행동 이름 `purchase_completed`로 맞춥니다. 실제 ID와 키는 해당 테스트 프로젝트 값을 사용합니다.

```ts
import { ExperibaseSDK } from '@pseudo-lab/experibase-sdk'

const sdk = new ExperibaseSDK({
  apiKey: 'pk_example_not_a_real_key',
  baseUrl: 'https://platform.example.invalid/api/v1',
  userId: 'guide-test-user',
})
const flagKey = 'checkout-cta'
const experimentId = 'YOUR_RUNNING_EXPERIMENT_ID'
const decision = await sdk.decide(flagKey)
const variant = decision.variant ?? 'control'
// 이 시점에 0.1.5는 /events impression을 자동 전송합니다.
// 이것을 실제 UI visibility의 증거로 취급하지 않습니다.

// 서비스가 variant를 렌더하고 실제 visibility 조건을 충족했을 때:
await sdk.trackExposure(experimentId, variant, { flag_key: flagKey })

// 실제 구매 완료 콜백에서만:
await sdk.track('purchase_completed', {
  experiment_id: experimentId,
  key: flagKey,
  variant,
})
```

flag의 `show:false`는 control 배정일 수 있습니다. control UI도 실제로 보였다면 노출을 기록합니다. `trackExposure`는 브라우저 sessionStorage에서 실험별 세션 1회 가드이며 개별 UI 노출을 식별하지 않습니다. 오류여도 가드를 먼저 설정하므로 같은 세션의 재시도가 자동 복구를 보장하지 않습니다. 동일 실험의 여러 사용자로 테스트하려면 별도 브라우저 세션을 사용하세요.

0.1.5에는 `expose()`, `tracking_context`, SDK 자동 impression 해제 옵션이 없습니다. `decide()` 호출 자체가 서버 flag 평가 기록 및 `/events` impression을 만들고, `track()`은 `/capture`와 `/events`에 이중 저장합니다. `trackExposure()`는 `/capture`에만 `exp_exposure`를 보냅니다. 이 예시는 현재 API를 정확히 사용하는 방법이며, 과거 집계 오귀속 문제를 해결한 계약이라는 뜻은 아닙니다.

### 3. 첫 수집 확인과 오류 확인

새 테스트 프로젝트에서 개발자 도구 Network의 요청 본문과 응답을 확인합니다. 운영 실험에 가짜 구매 이벤트를 보내서 검증하지 않습니다.

| 단계 | 확인할 요청/응답 | 의미와 주의 |
|---|---|---|
| 판단 | `POST /decide` 200, 응답 variant | UI를 봤다는 증거는 아님 |
| 자동 impression | `POST /events` 202 | 0.1.5 평가 직후의 기록 |
| 실제 노출 호출 | `POST /capture` 202, event_name=`exp_exposure`, properties의 experiment_id/variant | legacy 결과 분모 입력. 반복 호출은 세션 가드로 요청이 없을 수 있음 |
| 행동 | `/capture` 202 + `/events` 202, 동일 실험/flag/variant 확인 | 두 저장소의 합산 금지. 원시 행동과 Live Events의 conversion 의미가 다름 |
| 연결 상태 | 관리자 `GET /projects/{id}/sdk-status` | 최근 30일 event_log **또는 flag 평가 기록** 존재 여부. connected만으로 정확한 수집·귀속을 확정하지 않음 |
| 집계 | 관리자 `GET /experiments/{id}/result`, `/analytics`, `/available-events` | legacy result는 event_log, A/B analytics는 experiment_event. 숫자가 같다는 보장이 없음 |

- 401: 프로젝트 공개 키 유효성, API 도메인 확인. 관리 조회의 401은 관리자 세션 문제일 수 있습니다. 서버 비밀 키로 대체하지 않습니다.
- 404 또는 not_found: URL의 `/api/v1`, 실제 flag/experiment ID와 응답 본문을 확인합니다. 알려지지 않은 decide key는 placement fallback으로 200/show=false가 올 수도 있습니다.
- 422: 필수 user_id, JSON 타입/필드 확인. #20 전용 필드를 현재 API의 지원 증거로 해석하지 않습니다(일부 추가 필드는 무시될 수 있음).
- CORS/네트워크: 브라우저 Console·Network에서 API 주소와 허용 origin을 확인합니다. 클라이언트에서 인증을 우회하는 임시 코드를 넣지 않습니다.
- 502: 수집 저장 실패. 응답과 요청 ID/시각을 운영 담당자에게 전달하되 실제 키·사용자 민감값은 제거합니다.
- 0.1.5의 `track()`/`trackExposure()`는 모든 실패를 호출자에게 throw하지 않습니다. `await` 완료만으로 성공을 판단하지 말고 Network 응답을 확인합니다.
- 빈 결과: primary metric 이름, 실제 exposure 수신, control/treatment 관측 여부를 확인합니다. assignment만 있고 exposure가 없으면 분석 분모가 없습니다. legacy의 ID 없는 전환 범위 문제는 별도 미결 사항입니다.

### 4. #20 전환 비교

| 항목 | 현재 main / npm 0.1.5 | #20 로컬 후보 |
|---|---|---|
| 판단 | 자동 impression + 서버 평가 기록 | 판단만, autoExpose 명시 옵션 |
| 실제 노출 | trackExposure(expId, variant), 세션 가드 | expose(decision), 노출별 ID/시각 |
| 행동 귀속 | properties 직접 전달 | track 3번째 인자 tracking_context |
| 저장 | capture/events 이중 경로 | capture/event_log 단일 경로 |
| 실험 소스 | legacy 경로 분리 | 새 실험 생성 시 불변 event_model=sdk_v1 |
| 연결 키 | session/experiment 정도 | session/assignment/impression/event 구분 |
| 배포 상태 | npm 0.1.5 조회·설치 검증 | migration 038 및 앱/SDK 릴리스 미적용 |

기존 실험은 현재 버전을 고정합니다. #20 검토·반영 이후 새 실험 ID로 v1을 시작하고 README의 예시를 적용합니다. event_model을 기존 실험에서 바꾸거나 현재 npm 0.1.5에 expose를 호출하면 안 됩니다. 후보 코드의 package.json도 아직 0.1.5이므로 버전 문자열만으로 후보 배포 여부를 판단할 수 없습니다. 출시 담당자가 실제 버전·배포 호환 범위를 확정해야 합니다.

후보 SDK에는 별도 `eventModel: 'legacy'` 호환 옵션이 추가됐습니다. 내부 `/example`은 npm 설치본이 아니라 Vite의 SDK 소스 alias를 사용하므로, ExampleApp Provider가 `eventModel="legacy"`를 명시합니다. 이 경로는 기존 자동 impression/track 이중 기록을 보존하며, 기본 v1 경로는 `/events`를 쓰지 않습니다. 후보 출시 버전은 미정이며 현재 npm 0.1.5에는 이 옵션이 없습니다.

v1 Live Events의 건수/전환율은 노출 인스턴스 단위입니다. p-value와 winner는 null, is_significant는 false로 비활성화되며, 반복 노출로 승자를 판단하지 않습니다. SRM은 결과·배치와 같은 고유 사용자 단위로 계산하고 다중 variant 사용자는 제외합니다. 노출 건수와 사용자 표본 수를 같은 단위로 표시하지 마세요. 사용자 단위 추론은 `/result`를 확인합니다.

### 5. 향후 플랫폼 내 SDK 가이드 탭 구성 초안

문서 구성 제안이며 앱 구현 완료 상태가 아닙니다.

1. **지원 버전/준비**: 현재 지원 SDK·API 조합, 프로젝트 선택, 설치 명령.
2. **키와 주소**: 공개 SDK 키 보기/복사, 플랫폼 API 주소와 앱 도메인의 차이. 서버 비밀 키 노출 금지.
3. **첫 실험**: 선택한 실험/flag의 판단 → 실제 노출 → 행동 예제. legacy/v1을 명확히 표시하고 미지원 API 복사를 방지.
4. **수집 확인**: 요청별 성공 응답, 연결 상태의 제한, 결과/Live Events 소스 설명.
5. **문제 해결·전환**: 오류 상태, 버전별 차이, 새 v1 실험으로 전환 절차.

후보 v1 계약은 [README](./README.md)를 참고하세요. 운영 런타임 버전, 운영 키 공개 이행 상태, 실제 외부 서비스 CORS, 최종 출시 버전과 PR #26 통합은 아직 확인되지 않았습니다.

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

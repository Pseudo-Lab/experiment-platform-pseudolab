# ExperiBase SDK

SDK v1 이벤트 모델의 로컬 후보입니다. 아직 npm에 배포하지 않았습니다. 기존 배포판을 사용하는 실험은 해당 버전을 고정하고 새 실험으로 전환하세요. 이 문서의 이벤트 계약은 이전의 자동 impression/이중 저장 계약을 대체합니다.

## 새 실험 준비

관리자 인증으로 `POST /api/v1/experiments/`에 다음 필드를 포함합니다. 프로젝트와 flag는 먼저 만들어져 있어야 하며, 실행 전 기존 실험 시작 조건을 충족해야 합니다.

```json
{
  "name": "Checkout CTA v1",
  "experiment_type": "ab_test",
  "project_id": "my-project",
  "flag_key": "checkout-cta",
  "primary_metric": "purchase_completed",
  "event_model": "sdk_v1"
}
```

`event_model`은 생성 후 변경할 수 없습니다. 생략하면 `legacy`입니다. 기존 UI에서 만든 실험도 `legacy`이며, 기존 실험의 과거 이벤트는 변환하거나 합산하지 않습니다. 서버에는 먼저 migration `038_sdk_event_model.sql`이 필요합니다(운영 적용은 별도 검토 대상).

## 판단 → 실제 노출 → 행동

```ts
import { ExperibaseSDK } from '@pseudo-lab/experibase-sdk'

const sdk = new ExperibaseSDK({
  apiKey: 'YOUR_PUBLIC_SDK_KEY',
  baseUrl: 'https://YOUR_PLATFORM/api/v1',
  userId: 'service-user-id', // 생략하면 localStorage에 익명 UUID 생성
})

const decision = await sdk.decide('checkout-cta', { experimentId: 'YOUR_NEW_EXPERIMENT_ID' })
// decision.variant로 렌더하고, 실제로 보인 시점에 호출합니다.
// flag의 show=false는 control variant입니다. control도 보였다면 expose해야 합니다.
const exposure = await sdk.expose(decision)

await sdk.track('cta_clicked', { button: 'checkout' }, {
  tracking_context: exposure, type: 'click',
})
await sdk.track('purchase_completed', { orderCategory: 'book' }, {
  tracking_context: exposure, type: 'conversion', eventId: crypto.randomUUID(),
})
```

- `decide()`는 판단만 합니다. 서버의 평가 exposure 로깅도 끕니다. 한 flag에 여러 실행 중 v1 실험이 연결됐으면 `experimentId`를 명시해야 합니다. 명시한 실험이 실행 중이 아니거나 flag/project가 다르면 실패합니다.
- `expose(decision)`는 실제 렌더 또는 서비스가 정한 viewport 기준을 만족한 뒤 호출합니다. 같은 decision 객체는 같은 노출 ID를 재사용합니다. 다른 화면 인스턴스라면 새 decision 또는 `{ impressionId: crypto.randomUUID() }`를 사용합니다.
- `track()`의 세 번째 인자에 받은 문맥을 그대로 전달합니다. 행동 이름이 실험의 primary metric과 일치하면 click/conversion 어느 타입이든 전환 지표에 반영합니다. 무관한 pageview/클릭은 전환이 아닙니다.
- 판단 당시 `userId`가 attribution에 유지됩니다. 이후 `identify()`를 호출해도 이미 발생한 익명 노출을 로그인 사용자에게 임의 재귀속하지 않습니다. 새 사용자로 판단하려면 다시 `decide()`하세요.
- 명시 attribution 호출은 HTTP/네트워크 실패 시 reject합니다. 같은 노출은 같은 decision/ID, 같은 행동 재시도는 같은 `eventId`를 사용하세요. 자동 재시도 큐는 없습니다. 새 행동마다 새 ID가 필요합니다.
- `autoExpose: true`는 평가 시 바로 v1 노출을 보내는 명시적 이행 옵션입니다. 실제 visibility를 증명하지 않으며 이전 `/events` 저장을 복원하지 않습니다. 기본값은 false입니다.

## 식별자와 저장 계약

| 필드 | 의미 |
|---|---|
| `tracking_context.experiment_id` | 서버가 확인한 실행 중 v1 실험. 연결 실험 없는 flag는 null이며 실험 결과에 포함되지 않음 |
| `key`, `variant`, `project_id`, `source` | 평가 flag/variant, SDK 키의 프로젝트, `sdk_v1`. 서버가 관계 검증 |
| `assignment_id` | project/experiment/key/user/variant 조합의 결정적 ID. 재평가 시 같은 조합이면 동일. 세션이나 노출 ID가 아니며 variant 고정 보장도 아님 |
| `session_id` | sessionStorage 기반 탭 방문. 비브라우저에서는 SDK 인스턴스 수명 |
| `impression_id` | 한 실제 UI 노출. 같은 화면의 노출/클릭/전환이 공유 |
| `event_id` | 한 전송 이벤트의 멱등 키. 노출은 impression ID, 행동은 별도 ID |
| `exposed_at` | SDK가 처음 노출을 기록한 시각. 재시도에도 유지 |

기본 `eventModel: "sdk_v1"`의 이벤트 호출은 `/capture → event_log`에만 저장합니다. 노출 이름은 기존 `exp_exposure`를 재사용합니다. 서버는 명시 `tracking_context`가 있을 때만 v1 계약을 적용하고, 검증된 attribution을 상위 컬럼과 properties에 저장합니다. 임의 properties로 attribution을 덮어쓸 수 없습니다. 공개 SDK 키는 방문자 신원 인증이나 부정 이벤트 방지 수단이 아닙니다. 서버 credential을 브라우저에 넣지 마세요.

## 결과와 대시보드의 기준

| 실험/화면 | 기준 |
|---|---|
| `sdk_v1` 결과·guardrail·SRM 배치 | 해당 experiment/project의 v1 `event_log`. 노출된 고유 사용자 분모, 연결된 metric 행동 사용자 분자. 여러 variant에 노출된 사용자는 결과·SRM에서 제외 |
| `sdk_v1` Live Events | 같은 v1 소스. 노출 인스턴스 수와 primary metric을 달성한 노출 인스턴스 수(동일 노출에서 반복 행동은 1회) |
| `sdk_v1` available events | 같은 소스의 원시 이벤트 목록/건수. 미귀속 행동도 진단용으로 포함 |
| `legacy` 결과·SRM | 기존 `event_log.exp_exposure` 및 기존 metric 정책 유지 |
| `legacy` A/B Live Events | 기존 `/events → experiment_event` 유지 |
| 준실험/12기 회고 | 기존 경로 유지, SDK v1 대상 아님 |

v1 행동은 같은 project/experiment/user/variant/session/assignment/impression의 선행 노출과 연결될 때만 집계합니다. 발생 시각으로 판단하므로 행동이 먼저 도착해도 원래 시각의 노출이 뒤늦게 도착하면 다음 조회에서 반영됩니다. 클라이언트 시계가 잘못된 이벤트는 미귀속될 수 있습니다. 별도 attribution 만료 기간은 없습니다.

Live Events의 건수·전환율은 인스턴스 단위, 결과는 고유 사용자 단위라 반복 노출 시 숫자가 다릅니다. v1 Live Events는 반복 관측으로 독립 표본을 만들지 않도록 p_value=null, is_significant=false, winner=null을 반환합니다. 이는 통계 검정이 비활성화됐다는 의미이며, 효과가 없다는 판정이 아닙니다. 추론은 사용자 단위 `/result`를 확인하세요. Live Events의 SRM도 결과·SRM 배치와 동일하게 고유 사용자 수를 사용하고 다중 variant 사용자를 제외합니다. 기존 legacy 전환의 ID 없는 이벤트 정책과 과거 이중 저장 문제는 이 작업에서 소급 수정하지 않습니다.

## 지원 계약과 내부 예제

| 소비처 | 선택한 계약 | 저장/추론 |
|---|---|---|
| npm 0.1.5 | 기존 계약 고정; eventModel 옵션 없음 | 자동 impression 및 capture/events 이중 기록 |
| 후보 SDK 기본값 | eventModel: "sdk_v1" | 명시 노출·단일 capture, v1 Live 유의성/승자 비활성 |
| 내부 `/example` | Provider의 eventModel="legacy" | 소스 alias로 후보 SDK를 사용하면서 기존 자동 impression/행동 mirror 유지 |

후보 SDK의 기존 소비처는 `new ExperibaseSDK({ apiKey, baseUrl, eventModel: 'legacy' })` 또는 `<ExperibaseProvider eventModel="legacy" ...>`로 계약을 명시할 수 있습니다. 이 모드에서 decide는 기존 서버 평가/자동 impression, trackExposure는 기존 capture, 두 인자 track은 capture/events 이중 기록을 유지합니다. v1의 expose/명시 tracking_context와 autoExpose 조합은 거절합니다. Provider 모드는 생애 동안 고정되므로 바꾸려면 remount하세요. 이 호환 모드는 기존 집계 한계를 수정하거나 v1으로 이행한 상태를 의미하지 않습니다.

내부 예제는 `frontend/vite.config.ts`가 SDK 소스를 직접 alias하므로 npm 버전 고정만으로 보호되지 않습니다. ExampleApp의 명시 legacy 설정을 유지하며 새 v1 실험은 별도 이행 검증 뒤 연결합니다. 현재 npm/후보/내부 예제 검증은 각각 설치한 패키지의 mock 요청, SDK/API 테스트, 실제 Provider/bridge/hook 회귀 및 로컬 브라우저 stub으로 구분합니다. 후보 출시 버전은 아직 정하지 않았습니다.

## 기존 연동과 React

`placement()`, `experimentPlacement()`, `getAssignment()`, `trackExposure()`와 기존 서버 `/events` 계약은 유지합니다. 이 경로는 v1 attribution을 만들지 않습니다. 기본 v1 모드의 `track(event, properties)` 두 인자 호출과 Provider의 pageview 수집은 `/capture`에 남지만 더 이상 모든 행동을 `/events` conversion으로 복제하지 않습니다. 기존 대시보드가 그 복제에 의존한다면 이전 SDK 또는 명시 legacy 모드를 유지하고 새 실험에서 전환하세요.

`useDecide()`의 성공 result를 `sdk.expose()`에 전달할 수 있습니다. `useFlag`, `<Experiment>`, `<ExperimentSwitch>`는 variant 렌더링만 하며 실제 visibility를 자동 측정하지 않습니다. 캐시된 variant만으로 attribution을 만들지 마세요. React StrictMode/remount를 넘어 동일 노출을 유지하려면 서비스가 impression ID와 성공한 decision을 보관해야 합니다. viewport helper는 이번 범위에 포함하지 않습니다.

패키징: [SDK_PACKAGING_GUIDE.md](./SDK_PACKAGING_GUIDE.md). 검증: `npm test --prefix packages/sdk`.

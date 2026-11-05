import { IterglowLogo } from '@/components/IterglowLogo';
import { Link, useLocation } from 'react-router-dom';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/features/auth/AuthContext';
import { safeReturnPath } from '@/lib/returnPath';

interface Props {
  lang: 'ko' | 'en';
  setLang: (lang: 'ko' | 'en') => void;
  theme?: 'light' | 'dark';
  setTheme?: (theme: 'light' | 'dark') => void;
}

const setupCode = `import { IterglowSDK } from '@pseudo-lab/iterglow-sdk'

const sdk = new IterglowSDK({
  apiKey: 'pk_example_not_a_real_key',
  baseUrl: 'https://platform.example.invalid/api/v1',
  eventModel: 'sdk_v1',
})
const flagKey = 'checkout-cta'
const experimentId = 'YOUR_RUNNING_EXPERIMENT_ID'
const decision = await sdk.decide(flagKey, { experimentId })
if (decision.key !== flagKey || decision.type !== 'flag' || !decision.variant || !decision.tracking_context) {
  throw new Error('Expected a flag decision with a variant')
}
const variant = decision.variant`;
const exposureCode = `const exposure = await sdk.expose(decision)`;
const actionCode = `await sdk.track('signup_completed', {}, {
  tracking_context: exposure,
  eventId: crypto.randomUUID(),
})`;

const copy = {
  ko: {
    title: '개발자 SDK 가이드', intro: '서비스에 실험을 연결하고 첫 이벤트를 확인하세요.', home: '서비스 소개', login: '로그인', language: 'Switch to English', contents: '이 페이지에서', code: '코드 예시',
    sections: ['지원 버전과 이용 조건', '프로젝트와 공개 키 준비', '설치와 API 주소', '판단 → 실제 노출 → 행동', '첫 수집 확인', '오류 진단', '0.1.5에서 전환 · 외부 수집'],
    support: "이 가이드는 SDK 0.3.0 계약 기준입니다. Google 계정과 프로젝트 공개 SDK 키가 필요합니다. JavaScript/TypeScript 및 React 18 이상을 지원합니다. 패키지명은 @pseudo-lab/iterglow-sdk, 클래스명은 IterglowSDK입니다.",
    scope: "아래 코드는 새 sdk_v1 flag 연결 A/B 실험용입니다. 현재 일반 UI의 실험 생성은 legacy이며 /result 조회는 설치 관리자 권한이 필요합니다. 이 제한은 아직 해결되지 않았습니다. 관리자가 새 sdk_v1 실험을 API로 준비하기 전에는 아래 코드를 기존 실험에 연결하지 마세요. 일반 UI만으로 v1 성과 분석까지 완료되는 흐름은 아닙니다.",
    prepare: ['Google로 로그인하고 프로젝트를 만들거나 선택합니다.', '선택한 프로젝트의 SDK 연동 화면에서 프로젝트 공개 SDK 키를 확인합니다.', '설치 관리자가 API로 event_model=sdk_v1인 새 테스트 실험을 만들고 같은 프로젝트의 새 flag를 연결해야 합니다. 주요 지표는 예시의 signup_completed로 맞추고 실험 ID와 flag key를 적어둡니다.', '자동 생성한 flag는 비활성·공개 비율 0%로 시작합니다. 테스트 프로젝트에서 flag를 활성화하고 공개 비율을 50%로 설정합니다. 별도 규칙이나 강제 variant가 있으면 먼저 확인하세요. 실험 variant 이름은 flag 응답(control/treatment 등)과 일치시킵니다.', '실험을 실행 중으로 전환합니다. 계정 소유 프로젝트는 주요 지표와 같은 프로젝트의 활성 flag가 필요합니다. 연결된 flag의 규칙·공개 비율이 분배를 결정하며 실험의 비율 입력만 바꿔서는 분배가 바뀌지 않습니다.'],
    collection: "기본 모드는 사용자 ID를 원격 판단 API에 보내고 실제 노출·행동을 Iterglow에 수집합니다. 외부 eventTransport는 선택 사항이며 이 빠른 시작의 선행조건이 아닙니다. 고객 서비스 적용 전에 이벤트·속성·식별 방식을 정하고 테스트 환경에서 확인하세요.",
    identity: '예시는 userId를 생략하여 SDK가 브라우저 localStorage에 익명 UUID를 생성·재사용하게 합니다. 모든 방문자에게 같은 테스트 ID를 넣지 마세요. 직접 지정한다면 이메일 등 개인정보 대신 서비스의 안정적인 가명 ID를 쓰고 판단부터 노출·전환까지 같은 ID를 유지하세요. 이 예시는 SDK 인스턴스를 한 번 만들고 별도의 자동 수집은 시작하지 않습니다.',
    key: '공개 SDK 키는 x-api-key로 전송합니다. 계정 세션·서버 credential을 브라우저나 프런트엔드 환경변수에 넣지 마세요. 공개 키는 방문자의 신원을 보증하지 않습니다. 키·flag·실험 ID는 모두 같은 프로젝트의 값을 사용하세요. 다른 프로젝트 키를 섞거나 오류 해결을 위해 키를 제거하지 마세요.',
    address: 'baseUrl은 플랫폼 API 주소에 /api/v1을 붙인 값입니다. 프로젝트의 앱 도메인은 소비 서비스/Visual Editor 대상이므로 API 주소가 아닙니다. 예시의 .invalid 주소·키·ID는 가짜 값이며 테스트 프로젝트 값으로 바꿔야 합니다.',
    decide: "1. 판단: variant로 화면을 렌더합니다. 기본 sdk_v1의 decide()는 자동 impression을 기록하지 않습니다. 응답에 tracking_context가 있어야 합니다. 실패하면 기본 화면을 표시하고 아래 노출·행동 코드를 실행하지 마세요.",
    exposure: '2. 실제 노출: 렌더 후 서비스가 정한 visibility 조건을 만족한 시점에만 아래 코드를 호출합니다. flag의 show:false는 control 배정일 수 있으며 control 화면도 보였다면 기록합니다.',
    guard: "expose()는 실제 노출 문맥을 반환하고 /capture에 기록합니다. 같은 decision 객체로 재시도하면 같은 노출 ID·시각을 유지합니다. 새 화면 인스턴스는 새 impressionId를 사용하세요. 자동 재시도는 없으며 실패는 호출자에게 전달됩니다.",
    action: '3. 행동: 실제 가입 완료 콜백에서만 호출합니다. 가입이 목표가 아니라면 주요 지표와 이벤트 이름을 함께 바꾸세요. 이 코드를 초기 렌더나 노출 콜백에 넣지 마세요.',
    limits: "문맥을 전달한 track()은 같은 사용자·실험·노출에 행동을 연결합니다. /events에 자동 복제하지 않습니다. 행동 재시도는 같은 eventId를 사용하고 새 행동에는 새 ID를 쓰세요. React Provider는 별도 pageview를 수집하지만 그것이 전환을 의미하지는 않습니다.",
    verify: "새 테스트 실험에서 Network의 본문과 응답을 확인하세요. 운영 실험에 가짜 전환을 보내지 마세요. expose()와 문맥을 전달한 track()의 실패를 처리하세요. 두 인자 일반 track()은 귀속 없는 이벤트이며 같은 실패 계약이 아닙니다.",
    checks: [
      ['판단', 'POST /decide · 200', '응답 key/type/variant를 확인합니다.'],
      ['자동 impression 없음', '/events 요청 없음', '판단만으로 노출을 기록하지 않습니다.'],
      ['실제 노출', 'POST /capture · 202', 'event_name=exp_exposure와 tracking_context/event_id를 확인합니다.'],
      ['행동', 'POST /capture · 202', '동일 실험/flag/variant와 signup_completed를 확인합니다.'],
    ],
    firstCheck: "현재 일반 UI가 만드는 legacy 실험과 sdk_v1 실험을 혼용하지 마세요. v1 결과 /result는 설치 관리자 권한이 필요하며 일반 계정의 기존 analytics 집계와 같지 않습니다. 먼저 Network에서 노출·행동의 tracking_context와 event_id를 확인하고 관리자와 v1 결과를 검증하세요. 403을 키 교체로 우회하지 마세요.",
    status: 'SDK 연동 화면의 연결 상태는 최근 30일 이벤트 또는 flag 평가 기록의 존재를 뜻합니다. connected만으로 정확한 수집·귀속을 확정하지 마세요. 기존 A/B 이벤트 집계는 소유 프로젝트별 이벤트를 사용합니다. 관리자 공용 실험과 SDK v1 실험은 집계 원본이 다르므로 서로 숫자를 합산하지 마세요. 이벤트 수신은 개선 효과의 증명이 아닙니다.',
    errors: [
      ['401', '공개 키와 API 도메인을 확인하세요. 관리 조회라면 계정 세션도 확인합니다. 서버 비밀 키로 대체하지 마세요.'],
      ['404 / not_found', '/api/v1, flag/실험 ID와 응답 본문을 확인하세요. 계정 소유 프로젝트의 키는 같은 프로젝트의 flag만 판단하며, 알 수 없는 key나 다른 프로젝트 참조는 404일 수 있습니다. 예전 공용 경로의 placement fallback을 성공한 A/B 판단으로 취급하지 마세요.'],
      ['422', '필수 user_id와 JSON 필드·타입을 확인하세요. 추가 필드가 무시되어도 새 API 지원을 뜻하지 않습니다.'],
      ['CORS / Network', 'Console과 Network에서 API 주소·허용 origin을 확인하세요.'],
      ['502', '수집 저장 실패입니다. 키·개인정보를 제거한 요청 시각과 오류를 운영 담당자에게 전달하세요.'],
      ['빈 결과', '주요 지표 이름, 실제 exposure 수신, control/treatment 관측을 확인하세요. 배정만 있고 노출이 없으면 분석 분모가 없습니다.'],
    ],
    future: "0.1.5는 자동 impression과 capture/events 이중 기록을 사용하며 expose/eventModel/eventTransport가 없습니다. 0.1.5 getAssignment()는 키를 전송하지 않아 강화된 서버에서 401 후 control로 대체됩니다. 해당 소비자는 업데이트가 필요합니다. 0.3.0은 기본 sdk_v1이며 기존 동작이 필요하면 eventModel: legacy를 명시하세요. 기존 실험·데이터는 자동 변환되지 않으며 새 sdk_v1 실험으로 전환하세요. 선택형 eventTransport는 고객 수집기로 전달할 뿐 BigQuery나 Iterglow 결과를 자동 연결하지 않습니다. 외부 이벤트만 보내면 Live Events/결과/연결 상태가 그 이벤트로 갱신되지 않습니다. 사용자 ID는 여전히 원격 decide에 전송됩니다.",
  },
  en: {
    title: 'Developer SDK guide', intro: 'Connect your service to an experiment and verify your first events.', home: 'Introduction', login: 'Sign in', language: '한국어로 변경', contents: 'On this page', code: 'Code example',
    sections: ['Supported version and access', 'Prepare a project and public key', 'Install and set the API URL', 'Decide → actual exposure → action', 'Verify the first events', 'Troubleshooting', 'Migrate from 0.1.5 · external collection'],
    support: "This guide targets SDK 0.3.0. A Google account and project public SDK key are required. JavaScript/TypeScript and React 18+ are supported. The package is @pseudo-lab/iterglow-sdk and the class is IterglowSDK.",
    scope: "These snippets require a new sdk_v1 flag-linked A/B experiment. The current UI creates legacy experiments and /result requires an installation administrator; these limitations remain unresolved. Ask an administrator to prepare a new sdk_v1 experiment through the API before using this flow. The regular UI alone does not complete v1 outcome analysis.",
    prepare: ['Sign in with Google, then create or select a project.', 'Find the project public SDK key in the selected project’s SDK Integration screen.', 'An installation administrator must create a new event_model=sdk_v1 test experiment through the API and connect a new flag in the same project. Set the primary metric to signup_completed for this example and note the experiment ID and flag key.', 'An automatically created flag starts disabled with 0% rollout. In the test project, enable it and set rollout to 50%. Check any rules or forced variant first. Match experiment variant names to the flag response (such as control/treatment).', 'Start the experiment. Account-owned projects require a primary metric and an active flag in the same project. Flag rules and rollout control allocation; changing only the experiment traffic ratios does not change it.'],
    collection: "The default mode sends the user ID to the remote decision API and collects actual exposures and actions in Iterglow. Optional eventTransport is not required for this quickstart. Agree on events, properties and identifiers before testing in a customer service.",
    identity: 'The example omits userId so the SDK creates and reuses an anonymous UUID in browser localStorage. Do not assign the same test ID to every visitor. If supplying an ID, use a stable pseudonymous service ID rather than personal data such as email, and keep it consistent through decision, exposure and conversion. Create the SDK instance once; this example does not start additional autocapture.',
    key: 'The public SDK key is sent as x-api-key. Never put account sessions or server credentials in a browser or frontend environment variables. A public key does not authenticate visitors. Use a key, flag and experiment ID from the same project. Do not mix project keys or remove the key to work around an error.',
    address: 'baseUrl is the platform API address plus /api/v1. The project app domain points to the consuming service/Visual Editor target, not the API. The .invalid address, key and ID are fake placeholders; replace them with your test project values.',
    decide: "1. Decide: render using variant. In default sdk_v1 mode, decide() does not record automatic impressions. Require tracking_context in the response. On failure, show the default UI and skip the exposure/action snippets.",
    exposure: '2. Actual exposure: call the code below only after rendering and satisfying your service’s visibility rule. A flag with show:false can represent the control assignment; record exposure when the control UI is seen too.',
    guard: "expose() returns exposure context and writes to /capture. Retrying the same decision object preserves the exposure ID and time. Use a new impressionId for a new visible instance. Failures propagate; there is no automatic retry.",
    action: '3. Action: call this only from an actual signup completion callback. If signup is not your goal, change both the primary metric and event name. Do not run it on initial render or in the exposure callback.',
    limits: "An attributed track() links an action to the same user, experiment and exposure, without mirroring to /events. Reuse eventId for retries and create a new ID for a new action. The React Provider also collects pageviews; those are not conversions.",
    verify: "Inspect request bodies and responses in a new test experiment. Do not send fake conversions to production. Handle failures from expose() and attributed track(). Two-argument generic track() is unattributed and has a different failure contract.",
    checks: [
      ['Decision', 'POST /decide · 200', 'Check the response key/type/variant.'],
      ['No automatic impression', 'No /events request', 'Evaluation alone is not exposure.'],
      ['Actual exposure', 'POST /capture · 202', 'Check event_name=exp_exposure and tracking_context/event_id.'],
      ['Action', 'POST /capture · 202', 'Check the same experiment/flag/variant and signup_completed.'],
    ],
    firstCheck: "Do not mix UI-created legacy experiments with sdk_v1 experiments. The v1 /result endpoint requires an installation administrator and is distinct from member-facing legacy analytics. First check tracking_context and event_id in Network, then verify v1 results with the administrator. Do not bypass 403 by changing keys.",
    status: 'SDK Integration connection status means an event or flag evaluation exists in the last 30 days. Connected does not prove correct collection or attribution. Legacy A/B aggregates use project-scoped events for owned projects. Administrator shared experiments and SDK v1 experiments use different sources; do not sum their counts. Receiving events does not prove an improvement.',
    errors: [
      ['401', 'Check the public key and API domain. For admin queries, also check the admin session. Do not substitute a server secret.'],
      ['404 / not_found', 'Check /api/v1, flag/experiment IDs and the response body. An account-owned project key evaluates flags in that project only; unknown keys or other-project references can return 404. Do not treat a legacy shared-path placement fallback as a successful A/B decision.'],
      ['422', 'Check required user_id and JSON fields/types. Ignored extra fields do not prove support for a new API.'],
      ['CORS / Network', 'Check the API address and allowed origin in Console and Network.'],
      ['502', 'Collection storage failed. Share the request time and error with the operator after removing keys and personal data.'],
      ['Empty results', 'Check the primary metric name, actual exposure receipt, and control/treatment observations. Assignment without exposure does not supply the analysis denominator.'],
    ],
    future: "Version 0.1.5 uses automatic impressions and capture/events dual writes and has no expose/eventModel/eventTransport. Its getAssignment() omits the key, so the hardened server returns 401 and the old SDK falls back to control; those consumers must update. Version 0.3.0 defaults to sdk_v1; explicitly set eventModel: legacy when preserving the old event behavior. Existing experiments/data are not converted: use a new sdk_v1 experiment. Optional eventTransport forwards to your collector, without automatically connecting BigQuery or Iterglow results. External-only events do not update Live Events/results/connection status. Remote decide still receives the user ID.",
  },
};
const sectionIds = ['support', 'prepare', 'install', 'flow', 'verify', 'errors', 'migration'];

export function SdkGuidePage({ lang, setLang }: Props) {
  const t = copy[lang];
  const location = useLocation();
  const { state } = useAuth();
  const authenticated = state === 'authenticated';
  const workspacePath = safeReturnPath((location.state as { from?: unknown } | null)?.from) || '/projects';
  const workspaceLabel = lang === 'ko' ? '작업공간으로 돌아가기' : 'Back to workspace';
  const code = (value: string) => <pre tabIndex={0} aria-label={t.code} className="max-w-full overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 text-xs leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><code>{value}</code></pre>;
  return (
    <div className="service-entry min-h-screen bg-background text-foreground" lang={lang}>
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-5 md:px-6">
        <Link to={authenticated ? workspacePath : '/'} state={location.state} aria-label={lang === 'ko' ? 'Iterglow 홈' : 'Iterglow home'} className="rounded font-bold focus-visible:ring-2 focus-visible:ring-ring"><IterglowLogo lang={lang} /></Link>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm"><Link to={authenticated ? workspacePath : '/'} state={location.state}>{authenticated ? workspaceLabel : t.home}</Link></Button>
          <Button variant="outline" size="sm" aria-label={t.language} onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}><Globe aria-hidden="true" />{lang === 'ko' ? 'EN' : 'KO'}</Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <p className="text-sm font-semibold text-primary">SDK · 0.3.0</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">{t.title}</h1>
        <p className="mt-3 text-muted-foreground">{t.intro}</p>
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <nav aria-label={t.contents} className="lg:sticky lg:top-6">
            <p className="mb-3 text-sm font-semibold">{t.contents}</p>
            <ol className="space-y-3 text-sm text-muted-foreground">{t.sections.map((title, index) => <li key={title}><a className="rounded hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" href={`#${sectionIds[index]}`}>{index + 1}. {title}</a></li>)}</ol>
          </nav>
          <article className="min-w-0 space-y-8 text-sm leading-7">
            {t.sections.map((title, index) => <section key={sectionIds[index]} id={sectionIds[index]} aria-labelledby={`sdk-${sectionIds[index]}`} className="min-w-0 scroll-mt-6 space-y-4 border-t border-border pt-6">
              <h2 id={`sdk-${sectionIds[index]}`} className="text-xl font-semibold">{title}</h2>
              {index === 0 && <><p>{t.support}</p><p>{t.collection}</p><p className="text-muted-foreground">{t.scope}</p></>}
              {index === 1 && <><ol className="list-decimal space-y-2 pl-5">{t.prepare.map(step => <li key={step}>{step}</li>)}</ol><p>{t.key}</p><Button asChild variant="outline"><Link to={authenticated ? workspacePath : '/login'} state={location.state}>{authenticated ? workspaceLabel : t.login}</Link></Button></>}
              {index === 2 && <>{code('npm install --save-exact @pseudo-lab/iterglow-sdk@0.3.0')}<p>{t.address}</p></>}
              {index === 3 && <><p>{t.decide}</p><p>{t.identity}</p>{code(setupCode)}<p>{t.exposure}</p>{code(exposureCode)}<p className="text-muted-foreground">{t.guard}</p><p>{t.action}</p>{code(actionCode)}<Card className="shadow-none"><CardContent className="p-4">{t.limits}</CardContent></Card></>}
              {index === 4 && <><p>{t.verify}</p><dl className="space-y-4">{t.checks.map(([label, request, detail]) => <div key={label}><dt className="font-semibold">{label} <span className="block break-words font-mono text-xs text-primary">{request}</span></dt><dd className="text-muted-foreground">{detail}</dd></div>)}</dl><p>{t.firstCheck}</p><p>{t.status}</p></>}
              {index === 5 && <dl className="space-y-4">{t.errors.map(([label, detail]) => <div key={label}><dt className="font-semibold">{label}</dt><dd className="text-muted-foreground">{detail}</dd></div>)}</dl>}
              {index === 6 && <p>{t.future}</p>}
            </section>)}
          </article>
        </div>
      </main>
    </div>
  );
}

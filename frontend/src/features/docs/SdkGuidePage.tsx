import { Link, useLocation } from 'react-router-dom';
import { Globe, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  lang: 'ko' | 'en';
  setLang: (lang: 'ko' | 'en') => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

const setupCode = `import { ExperibaseSDK } from '@pseudo-lab/experibase-sdk'

const sdk = new ExperibaseSDK({
  apiKey: 'pk_example_not_a_real_key',
  baseUrl: 'https://platform.example.invalid/api/v1',
  userId: 'guide-test-user',
})
const flagKey = 'checkout-cta'
const experimentId = 'YOUR_RUNNING_EXPERIMENT_ID'
const decision = await sdk.decide(flagKey)
const variant = decision.variant ?? 'control'`;
const exposureCode = `await sdk.trackExposure(experimentId, variant, {
  flag_key: flagKey,
})`;
const actionCode = `await sdk.track('purchase_completed', {
  experiment_id: experimentId,
  key: flagKey,
  variant,
})`;

const copy = {
  ko: {
    title: '개발자 SDK 가이드', intro: '서비스에 실험을 연결하고 첫 이벤트를 확인하세요.', home: '서비스 소개', login: '관리자 로그인', language: 'Switch to English', theme: '화면 테마 변경', contents: '이 페이지에서', code: '코드 예시',
    sections: ['지원 버전과 이용 조건', '프로젝트와 공개 키 준비', '설치와 API 주소', '판단 → 실제 노출 → 행동', '첫 수집 확인', '오류 진단', '출시 예정 · 이벤트 모델 전환'],
    support: '현재 npm 배포판 0.1.5 기준입니다. 관리자 계정과 프로젝트 공개 SDK 키가 필요합니다. JavaScript/TypeScript에서 사용하며 React 연동은 React 18 이상을 지원합니다. 가이드는 로그인 없이 읽을 수 있습니다.',
    scope: '아래 예시는 flag에 연결된 기존 A/B 실험용입니다. 준실험·placement 연동은 별도 계약입니다. 실제 운영 API 버전과 CORS 허용 origin은 관리자에게 확인하세요.',
    prepare: ['관리자로 로그인하고 프로젝트를 만들거나 선택합니다.', '선택한 프로젝트의 SDK 연동 화면에서 프로젝트 공개 SDK 키를 확인합니다.', '같은 프로젝트에 flag와 A/B 실험을 만들고 연결한 뒤 실행 조건을 충족합니다. 주요 지표 이름은 예시의 purchase_completed와 맞춥니다.'],
    key: '공개 SDK 키는 x-api-key로 전송합니다. 관리자 세션·서버 credential을 브라우저나 프런트엔드 환경변수에 넣지 마세요. 공개 키는 방문자의 신원을 보증하지 않습니다.',
    address: 'baseUrl은 플랫폼 API 주소에 /api/v1을 붙인 값입니다. 프로젝트의 앱 도메인은 소비 서비스/Visual Editor 대상이므로 API 주소가 아닙니다. 예시의 .invalid 주소·키·ID는 가짜 값이며 테스트 프로젝트 값으로 바꿔야 합니다.',
    decide: '1. 판단: variant로 서비스 화면을 렌더합니다. 0.1.5의 decide()는 서버 flag 평가 기록과 /events impression을 자동으로 만듭니다. 실제로 화면을 봤다는 증거는 아닙니다.',
    exposure: '2. 실제 노출: 렌더 후 서비스가 정한 visibility 조건을 만족한 시점에만 아래 코드를 호출합니다. flag의 show:false는 control 배정일 수 있으며 control 화면도 보였다면 기록합니다.',
    guard: 'trackExposure는 /capture에 exp_exposure를 보냅니다. sessionStorage의 실험별 세션 1회 가드이며 개별 UI 노출을 식별하지 않습니다. 실패 전에 가드가 설정되므로 재시도가 자동 복구를 보장하지 않습니다. 여러 사용자 테스트는 별도 브라우저 세션을 사용하세요.',
    action: '3. 행동: 실제 구매 완료 콜백에서만 호출합니다. 이 코드를 초기 렌더나 노출 콜백에 넣지 마세요.',
    limits: 'track은 /capture와 /events에 이중 기록하며 /events에서는 일반 행동도 conversion으로 복제합니다. 두 저장소의 건수를 합산하지 마세요. 이 예시는 과거 집계·귀속 문제를 해결하지 않습니다. React Provider는 pageview도 수집하므로 자동 수집 범위를 검토하세요.',
    verify: '새 테스트 프로젝트에서 브라우저 개발자 도구 Network의 본문과 응답을 확인하세요. 운영 실험에 가짜 구매 이벤트를 보내지 마세요. track/trackExposure의 await 완료만으로 성공을 판단할 수 없습니다. 모든 실패가 throw되지는 않습니다.',
    checks: [
      ['판단', 'POST /decide · 200', '응답 key/type/variant를 확인합니다.'],
      ['자동 impression', 'POST /events · 202', '판단 직후 자동 기록이며 실제 노출이 아닙니다.'],
      ['실제 노출', 'POST /capture · 202', 'event_name=exp_exposure와 experiment_id/variant를 확인합니다. 가드로 반복 요청이 없을 수 있습니다.'],
      ['행동', 'POST /capture + /events · 202', '동일 실험/flag/variant와 purchase_completed를 확인합니다.'],
    ],
    status: 'SDK 연동 화면의 연결 상태는 최근 30일 이벤트 또는 flag 평가 기록의 존재를 뜻합니다. connected만으로 정확한 수집·귀속을 확정하지 마세요. 관리자 결과는 event_log, 기존 A/B Live Events는 experiment_event를 사용하므로 숫자가 다를 수 있습니다. 이벤트 수신은 개선 효과의 증명이 아닙니다.',
    errors: [
      ['401', '공개 키와 API 도메인을 확인하세요. 관리 조회라면 관리자 세션도 확인합니다. 서버 비밀 키로 대체하지 마세요.'],
      ['404 / not_found', '/api/v1, flag/실험 ID와 응답 본문을 확인하세요. 알 수 없는 decide key는 placement fallback으로 200/show=false를 반환할 수도 있습니다.'],
      ['422', '필수 user_id와 JSON 필드·타입을 확인하세요. 추가 필드가 무시되어도 새 API 지원을 뜻하지 않습니다.'],
      ['CORS / Network', 'Console과 Network에서 API 주소·허용 origin을 확인하세요.'],
      ['502', '수집 저장 실패입니다. 키·개인정보를 제거한 요청 시각과 오류를 운영 담당자에게 전달하세요.'],
      ['빈 결과', '주요 지표 이름, 실제 exposure 수신, control/treatment 관측을 확인하세요. 배정만 있고 노출이 없으면 분석 분모가 없습니다.'],
    ],
    future: '명시적 expose(), tracking_context, event_model을 사용하는 새 이벤트 모델은 아직 출시되지 않았습니다. 0.1.5에는 이 API와 자동 impression 해제 옵션이 없습니다. 현재 예시에 혼용하지 마세요. 출시 후 지원 버전과 서버 호환성을 확인하고 새 실험 ID로 전환해야 하며, 기존 실험·과거 데이터가 자동 변환되지는 않습니다.',
  },
  en: {
    title: 'Developer SDK guide', intro: 'Connect your service to an experiment and verify your first events.', home: 'Introduction', login: 'Admin sign in', language: '한국어로 변경', theme: 'Toggle theme', contents: 'On this page', code: 'Code example',
    sections: ['Supported version and access', 'Prepare a project and public key', 'Install and set the API URL', 'Decide → actual exposure → action', 'Verify the first events', 'Troubleshooting', 'Upcoming · event model migration'],
    support: 'This guide targets the published npm version 0.1.5. An administrator account and a project public SDK key are required. Use JavaScript/TypeScript; the React integration supports React 18 and later. Reading this guide does not require sign in.',
    scope: 'These examples cover legacy flag-linked A/B experiments. Quasi-experiments and placements use separate contracts. Confirm the deployed API version and allowed CORS origin with your administrator.',
    prepare: ['Sign in as an administrator and create or select a project.', 'Find the project public SDK key in the selected project’s SDK Integration screen.', 'Create and connect a flag and A/B experiment in the same project, then meet its start requirements. Match the primary metric to purchase_completed in this example.'],
    key: 'The public SDK key is sent as x-api-key. Never put administrator sessions or server credentials in a browser or frontend environment variables. A public key does not authenticate visitors.',
    address: 'baseUrl is the platform API address plus /api/v1. The project app domain points to the consuming service/Visual Editor target, not the API. The .invalid address, key and ID are fake placeholders; replace them with your test project values.',
    decide: '1. Decide: render your service UI using variant. In 0.1.5, decide() automatically creates a server flag evaluation record and an /events impression. This is not evidence that the UI was seen.',
    exposure: '2. Actual exposure: call the code below only after rendering and satisfying your service’s visibility rule. A flag with show:false can represent the control assignment; record exposure when the control UI is seen too.',
    guard: 'trackExposure sends exp_exposure to /capture. Its sessionStorage guard allows one call per experiment per session, not one per UI exposure. The guard is set before a failure, so retrying does not guarantee recovery. Use separate browser sessions to test multiple users.',
    action: '3. Action: call this only from an actual purchase completion callback. Do not run it on initial render or in the exposure callback.',
    limits: 'track writes to both /capture and /events, mirroring even general actions as conversion in /events. Do not add the two stores’ counts together. This example does not fix historical aggregation or attribution issues. The React Provider also collects pageviews; review automatic collection scope.',
    verify: 'Inspect request bodies and responses in browser DevTools Network using a new test project. Do not send fake purchases to production experiments. Awaiting track/trackExposure is not proof of success: not all failures are thrown.',
    checks: [
      ['Decision', 'POST /decide · 200', 'Check the response key/type/variant.'],
      ['Automatic impression', 'POST /events · 202', 'Recorded immediately after evaluation, not actual visibility.'],
      ['Actual exposure', 'POST /capture · 202', 'Check event_name=exp_exposure and experiment_id/variant. The guard can suppress repeated requests.'],
      ['Action', 'POST /capture + /events · 202', 'Check the same experiment/flag/variant and purchase_completed.'],
    ],
    status: 'SDK Integration connection status means an event or flag evaluation exists in the last 30 days. Connected does not prove correct collection or attribution. Admin results use event_log; legacy A/B Live Events use experiment_event, so counts can differ. Receiving events does not prove an improvement.',
    errors: [
      ['401', 'Check the public key and API domain. For admin queries, also check the admin session. Do not substitute a server secret.'],
      ['404 / not_found', 'Check /api/v1, flag/experiment IDs and the response body. An unknown decide key can fall back to placement and return 200/show=false.'],
      ['422', 'Check required user_id and JSON fields/types. Ignored extra fields do not prove support for a new API.'],
      ['CORS / Network', 'Check the API address and allowed origin in Console and Network.'],
      ['502', 'Collection storage failed. Share the request time and error with the operator after removing keys and personal data.'],
      ['Empty results', 'Check the primary metric name, actual exposure receipt, and control/treatment observations. Assignment without exposure does not supply the analysis denominator.'],
    ],
    future: 'The new event model using explicit expose(), tracking_context and event_model is not released yet. Version 0.1.5 has neither these APIs nor an option to disable automatic impressions. Do not mix them into the current examples. After release, confirm the supported version and server compatibility, then migrate using a new experiment ID. Existing experiments and historical data are not automatically converted.',
  },
};
const sectionIds = ['support', 'prepare', 'install', 'flow', 'verify', 'errors', 'migration'];

export function SdkGuidePage({ lang, setLang, theme, setTheme }: Props) {
  const t = copy[lang];
  const location = useLocation();
  const code = (value: string) => <pre tabIndex={0} aria-label={t.code} className="max-w-full overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 text-xs leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><code>{value}</code></pre>;
  return (
    <div className="service-entry min-h-screen bg-background text-foreground" lang={lang}>
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-5 md:px-6">
        <Link to="/" state={location.state} className="rounded font-bold focus-visible:ring-2 focus-visible:ring-ring">ExperiBase</Link>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm"><Link to="/" state={location.state}>{t.home}</Link></Button>
          <Button variant="ghost" size="icon" aria-label={t.theme} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon /> : <Sun />}</Button>
          <Button variant="outline" size="sm" aria-label={t.language} onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}><Globe aria-hidden="true" />{lang === 'ko' ? 'EN' : 'KO'}</Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <p className="text-sm font-semibold text-primary">SDK · npm 0.1.5</p>
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
              {index === 0 && <><p>{t.support}</p><p className="text-muted-foreground">{t.scope}</p></>}
              {index === 1 && <><ol className="list-decimal space-y-2 pl-5">{t.prepare.map(step => <li key={step}>{step}</li>)}</ol><p>{t.key}</p><Button asChild variant="outline"><Link to="/login" state={location.state}>{t.login}</Link></Button></>}
              {index === 2 && <>{code('npm install --save-exact @pseudo-lab/experibase-sdk@0.1.5')}<p>{t.address}</p></>}
              {index === 3 && <><p>{t.decide}</p>{code(setupCode)}<p>{t.exposure}</p>{code(exposureCode)}<p className="text-muted-foreground">{t.guard}</p><p>{t.action}</p>{code(actionCode)}<Card className="shadow-none"><CardContent className="p-4">{t.limits}</CardContent></Card></>}
              {index === 4 && <><p>{t.verify}</p><dl className="space-y-4">{t.checks.map(([label, request, detail]) => <div key={label}><dt className="font-semibold">{label} <span className="block break-words font-mono text-xs text-primary">{request}</span></dt><dd className="text-muted-foreground">{detail}</dd></div>)}</dl><p>{t.status}</p></>}
              {index === 5 && <dl className="space-y-4">{t.errors.map(([label, detail]) => <div key={label}><dt className="font-semibold">{label}</dt><dd className="text-muted-foreground">{detail}</dd></div>)}</dl>}
              {index === 6 && <p>{t.future}</p>}
            </section>)}
          </article>
        </div>
      </main>
    </div>
  );
}

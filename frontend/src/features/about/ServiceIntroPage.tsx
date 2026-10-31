import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Diamond, Globe, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ProductPreview } from './ProductPreview';

interface Props {
  lang: 'ko' | 'en';
  setLang: (lang: 'ko' | 'en') => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  authenticated: boolean;
}

const copy = {
  ko: {
    label: '오픈소스 실험 플랫폼', title: '더 나은 제품을 만드는', titleAccent: '실험의 시작.',
    description: '화면과 기능을 비교하고, 사용자 행동을 수집해 다음 결정을 돕는 오픈소스 실험 플랫폼입니다.',
    login: '관리자 로그인', manage: '관리 화면 열기', features: '제품 기능', featuresLink: '제품 기능 살펴보기', flowLink: '사용 흐름',
    access: '현재 관리자 계정으로 이용합니다.', integration: '서비스에 SDK 또는 API를 연동해 실험 데이터를 수집하세요.',
    cycle: '실험에서 다음 결정까지', uses: '가설부터 다음 결정까지.',
    usesText: '실험을 설계하고, 기능 공개와 수집 상태를 확인하고, 판단의 근거를 남기세요.',
    scenarios: [
      ['질문을 검증하는 A/B 테스트', '가설과 비교할 버전을 정하고, 판단에 필요한 행동 지표를 설정합니다.'],
      ['단계적으로 공개하는 기능', 'Feature Flag의 활성 상태와 공개 비율을 관리하고 연동된 서비스에 적용합니다.'],
      ['다음으로 이어지는 실험', '수집 상태와 결과를 확인하고, 팀의 판단과 근거를 함께 기록합니다.'],
    ],
    sample: '설명용 예시', experiment: '가입 안내 문구 비교', versions: ['A · 기존 안내', 'B · 다음 행동 강조'], metric: '주요 지표', metricValue: '가입 완료', draft: '초안 · 데이터 수집 전',
    flag: '새로운 가입 화면', status: '활성 상태', disabled: '비활성', rollout: '공개 비율', sdk: 'SDK/API 연동이 필요합니다.',
    decision: '결정 기록', collection: '수집 상태', noData: '데이터 수집 전', reasoning: '판단 · 근거', pending: '기록 대기', next: '관찰한 결과와 다음 행동을 남깁니다.',
    flow: '설정에서 다음 결정까지', flowText: '서비스와 연결해 실험을 이어가는 네 단계',
    steps: [
      ['프로젝트·실험 설정', '가설, 비교할 버전과 주요 지표를 정합니다.'],
      ['SDK/API 연동', '서비스에 연결해 노출·행동 이벤트를 전송합니다.'],
      ['수집 확인', '이벤트가 들어오는지 수집 이력을 확인합니다.'],
      ['결과·결정', '결과를 검토하고 판단과 그 근거를 기록합니다.'],
    ],
    measurement: '이벤트 수집과 개선 효과의 확인은 다릅니다. 결과는 수집된 데이터와 실험 설계를 함께 살펴 해석하세요.',
    sdkGuide: 'SDK 가이드', teamLink: '팀 활동 보기', language: 'Switch to English', theme: '화면 테마 변경',
  },
  en: {
    label: 'Open-source experimentation', title: 'Better products start', titleAccent: 'with an experiment.',
    description: 'An open-source experimentation platform for comparing screens and features, collecting user behavior, and informing your next decision.',
    login: 'Admin sign in', manage: 'Open workspace', features: 'Product', featuresLink: 'Explore the product', flowLink: 'Workflow',
    access: 'Access currently requires an administrator account.', integration: 'Connect your service through the SDK or API to collect experiment data.',
    cycle: 'From an experiment to your next decision', uses: 'From a hypothesis to your next decision.',
    usesText: 'Design experiments, check feature rollout and collection health, and record your reasoning.',
    scenarios: [
      ['A/B tests that explore a question', 'Define a hypothesis, variants, and the behavior metric that will inform your decision.'],
      ['Features you can release gradually', 'Manage feature availability and rollout percentages for your connected service.'],
      ['Experiments that inform what comes next', 'Review collection health and results, then record your team’s decision and reasoning.'],
    ],
    sample: 'Illustrative example', experiment: 'Compare signup messages', versions: ['A · Original message', 'B · Clear next step'], metric: 'Primary metric', metricValue: 'Signup completion', draft: 'Draft · No data collected',
    flag: 'A new signup experience', status: 'Availability', disabled: 'Disabled', rollout: 'Rollout', sdk: 'SDK/API integration is required.',
    decision: 'Decision log', collection: 'Collection status', noData: 'No data collected', reasoning: 'Decision & reasoning', pending: 'Not recorded yet', next: 'Record what you observed and what to do next.',
    flow: 'From setup to your next decision', flowText: 'Four steps to connect your service and run an experiment',
    steps: [
      ['Set up a project and experiment', 'Define your hypothesis, variants, and primary metric.'],
      ['Connect the SDK or API', 'Connect your service to send exposure and behavior events.'],
      ['Check collection health', 'Check the collection history to see whether events are arriving.'],
      ['Review results and decide', 'Review the results and record your decision and reasoning.'],
    ],
    measurement: 'Receiving events and demonstrating an improvement are different checks. Interpret results alongside your data and experiment design.',
    sdkGuide: 'SDK guide', teamLink: 'Team activities', language: '한국어로 변경', theme: 'Toggle theme',
  },
};

export function ServiceIntroPage({ lang, setLang, theme, setTheme, authenticated }: Props) {
  const t = copy[lang];
  const location = useLocation();
  const destination = authenticated ? '/experiments' : '/login';
  const action = authenticated ? t.manage : t.login;
  return (
    <div className="service-entry min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 border-b border-border px-4 py-5 md:px-6">
        <Link to="/" state={location.state} className="flex items-center gap-2 rounded-md text-lg font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Diamond aria-hidden="true" className="h-8 w-8 rounded-lg bg-primary p-1.5 text-primary-foreground" />ExperiBase
        </Link>
        <nav aria-label={t.features} className="ml-auto hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#features" className="rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">{t.features}</a>
          <Link to="/docs/sdk" state={location.state} className="rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">{t.sdkGuide}</Link>
          <a href="#how-it-works" className="rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">{t.flowLink}</a>
        </nav>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={t.theme}>{theme === 'light' ? <Moon /> : <Sun />}</Button>
          <Button variant="outline" size="sm" onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')} aria-label={t.language}><Globe aria-hidden="true" />{lang === 'ko' ? 'EN' : 'KO'}</Button>
          <Button asChild className="ml-2 hidden lg:inline-flex"><Link to={destination} state={location.state}>{action}<ArrowRight aria-hidden="true" /></Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-10 md:px-6">
        <section aria-labelledby="intro-title" className="pt-10 text-center md:pt-14">
          <p className="inline-flex rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold tracking-wide text-primary">{t.label}</p>
          <h1 id="intro-title" className="mt-5 break-keep text-4xl font-bold leading-tight tracking-tight md:text-[3.375rem] md:leading-tight">{t.title}<br /><span className="text-primary">{t.titleAccent}</span></h1>
          <p className="mx-auto mt-5 max-w-2xl break-keep text-base leading-relaxed text-muted-foreground">{t.description}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg"><Link to={destination} state={location.state}>{action}<ArrowRight aria-hidden="true" /></Link></Button>
            <Button asChild variant="outline" size="lg"><a href="#features">{t.featuresLink}</a></Button>
          </div>
          <p className="mx-auto mt-4 max-w-xl text-xs leading-loose text-muted-foreground">{t.access}<br />{t.integration}</p>
        </section>
        <section aria-label={t.cycle} className="mx-auto mt-9 max-w-[1000px]">
          <ProductPreview lang={lang} />
        </section>
        <section id="features" aria-labelledby="intro-uses" className="mt-14 scroll-mt-6">
          <p className="text-xs font-semibold tracking-widest text-primary">CORE CAPABILITIES</p>
          <h2 id="intro-uses" className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">{t.uses}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.usesText}</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {t.scenarios.map(([title, description], index) => <Card key={index} className="shadow-none">
              <CardContent className="flex h-full flex-col p-6">
                <p className="text-[10px] font-semibold tracking-wide text-primary">0{index + 1} / {['EXPERIMENTATION', 'FEATURE FLAGS', 'DECISIONS'][index]}</p>
                <h3 className="mt-3 text-base font-semibold leading-relaxed">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:min-h-20">{description}</p>
                <div className="mt-5 flex-1 rounded-lg border border-border bg-muted/30 p-4 text-xs">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3"><span className="font-semibold">{[t.experiment, t.flag, t.decision][index]}</span><span className="text-[10px] text-muted-foreground">{t.sample}</span></div>
                  {index === 0 && <><div className="mb-3 flex flex-wrap gap-2">{t.versions.map(v => <span key={v} className="rounded border border-border bg-background px-2 py-1">{v}</span>)}</div><div className="flex justify-between gap-3"><span className="text-muted-foreground">{t.metric}</span><span className="text-right">{t.metricValue}</span></div><p className="mt-3 text-[10px] text-muted-foreground">{t.draft}</p></>}
                  {index === 1 && <><div className="flex justify-between gap-3"><span className="text-muted-foreground">{t.status}</span><span>{t.disabled}</span></div><div className="mt-3 flex justify-between gap-3"><span className="text-muted-foreground">{t.rollout}</span><span>0%</span></div><div aria-hidden="true" className="my-3 h-1.5 rounded-full bg-border" /><p className="text-[10px] leading-relaxed text-muted-foreground">{t.sdk}</p></>}
                  {index === 2 && <><div className="flex justify-between gap-3"><span className="text-muted-foreground">{t.collection}</span><span className="text-right">{t.noData}</span></div><div className="mt-3 flex justify-between gap-3"><span className="text-muted-foreground">{t.reasoning}</span><span className="text-right">{t.pending}</span></div><p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">{t.next}</p></>}
                </div>
              </CardContent>
            </Card>)}
          </div>
        </section>
        <section id="how-it-works" aria-labelledby="intro-flow" className="mt-11 scroll-mt-6 border-t border-border pt-9">
          <div className="flex flex-wrap items-baseline justify-between gap-3"><h2 id="intro-flow" className="text-xl font-semibold tracking-tight">{t.flow}</h2><p className="text-xs text-muted-foreground">{t.flowText}</p></div>
          <ol className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {t.steps.map(([title, description], index) => <li key={index} className="border-t border-border pt-4">
              <span className="text-[10px] font-semibold tracking-wide text-primary">0{index + 1} / {['CONFIGURE', 'CONNECT', 'VERIFY', 'DECIDE'][index]}</span>
              <h3 className="mt-3 text-sm font-semibold">{title}</h3><p className="mt-2 text-xs leading-loose text-muted-foreground">{description}</p>
            </li>)}
          </ol>
          <p className="mt-6 max-w-3xl text-xs leading-relaxed text-muted-foreground">{t.measurement}</p>
        </section>
      </main>
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-border px-4 py-6 text-xs text-muted-foreground md:px-6">
        <span>ExperiBase · {t.label}</span><Link to="/docs/sdk" state={location.state} className="rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">{t.sdkGuide}</Link><a className="inline-flex items-center gap-2 rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" href="https://pseudo-lab.github.io/experiment-platform-pseudolab/">{t.teamLink}<ArrowRight aria-hidden="true" className="h-3 w-3" /></a>
      </footer>
    </div>
  );
}

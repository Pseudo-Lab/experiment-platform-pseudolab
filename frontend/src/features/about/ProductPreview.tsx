import { useState } from 'react';
import { GitBranch, Flag, ChartNoAxesCombined } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const copy = {
  ko: {
    workspace: '실험 관리', sdk: 'SDK 연동', project: '가입 경험 개선', hypothesisLabel: 'HYPOTHESIS / 가설', versionRoles: ['기준안', '비교안'], collection: '데이터 수집 전', label: '제품 미리보기', example: '예시 프로젝트', sample: '설명용 예시',
    tabs: ['실험 설계', '기능 공개', '결과·결정'],
    titles: ['가입 안내 문구 비교', '새로운 가입 화면', '결과를 다음 결정으로'],
    descriptions: ['가설과 비교할 버전을 한곳에서 정리합니다.', 'Feature Flag로 활성 상태와 공개 비율을 관리합니다.', '수집 상태를 먼저 확인하고 판단의 근거를 남깁니다.'],
    question: '가설', hypothesis: '다음 행동을 명확하게 안내하면 가입 완료에 도움이 될까요?',
    versions: ['기존 안내', '다음 행동을 강조한 안내'], metric: '주요 지표', metricValue: '가입 완료 이벤트',
    draft: '초안', disabled: '비활성', rollout: '공개 비율', rolloutHelp: '연동된 서비스가 설정에 따라 기능을 표시합니다.',
    noData: '아직 수집된 데이터가 없습니다', noDataHelp: 'SDK/API를 연결하고 노출·행동 이벤트가 들어오는지 확인하세요.',
    decision: '결정 기록', decisionHelp: '관찰한 결과와 다음 행동을 함께 남깁니다.',
    foot: '설정 → 서비스 연동 → 수집 확인 → 결정',
  },
  en: {
    workspace: 'Experiments', sdk: 'SDK integration', project: 'Signup experience', hypothesisLabel: 'HYPOTHESIS', versionRoles: ['Control', 'Variation'], collection: 'No data collected', label: 'Product preview', example: 'Example project', sample: 'Illustrative example',
    tabs: ['Experiment design', 'Feature rollout', 'Results & decisions'],
    titles: ['Compare signup messages', 'A new signup experience', 'Turn results into decisions'],
    descriptions: ['Keep your hypothesis and variants together.', 'Manage feature availability and rollout with Feature Flags.', 'Check collection health, then record your reasoning.'],
    question: 'Hypothesis', hypothesis: 'Does a clearer next step help people complete signup?',
    versions: ['Original message', 'Message with a clear next step'], metric: 'Primary metric', metricValue: 'Signup completion event',
    draft: 'Draft', disabled: 'Disabled', rollout: 'Rollout', rolloutHelp: 'Your connected service renders the feature using this configuration.',
    noData: 'No data collected yet', noDataHelp: 'Connect the SDK or API and check that exposure and behavior events are arriving.',
    decision: 'Decision log', decisionHelp: 'Record what you observed and what to do next.',
    foot: 'Configure → Integrate → Check events → Decide',
  },
};

export function ProductPreview({ lang }: { lang: 'ko' | 'en' }) {
  const t = copy[lang];
  const [selected, setSelected] = useState(0);
  const icons = [GitBranch, Flag, ChartNoAxesCombined];
  return (
    <Card className="min-w-0 overflow-hidden rounded-xl border-border shadow-xl shadow-primary/5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/20 px-5 py-3.5 text-xs">
        <span><span aria-hidden="true" className="mr-3 tracking-widest text-muted-foreground">•••</span>ExperiBase / {t.example}</span>
        <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] text-primary">{t.sample}</span>
      </div>
      <div className="grid md:grid-cols-[155px_minmax(0,1fr)]">
        <div className="hidden border-r border-border bg-muted/20 px-3 py-6 text-xs text-muted-foreground md:block" aria-hidden="true">
          <p className="px-2 pb-4 text-[9px] tracking-widest">WORKSPACE</p>
          <p className="rounded-md border border-border bg-background px-2 py-2 font-semibold text-primary">{t.workspace}</p>
          <p className="px-2 py-3">Feature Flags</p><p className="px-2 py-2">{t.sdk}</p>
          <p className="px-2 pb-2 pt-6 text-[9px] tracking-widest">PROJECT</p><p className="px-2 py-2 leading-relaxed">{t.project}</p>
        </div>
        <CardContent className="min-w-0 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-semibold tracking-tight sm:text-xl">{t.titles[selected]}</h3><span className="shrink-0 rounded-full border border-border bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground">{selected === 1 ? t.disabled : t.draft}</span></div>
          <div role="group" aria-label={t.label} className="mt-3 flex flex-wrap gap-1 border-b border-border pb-2">
            {t.tabs.map((label, index) => { const Icon = icons[index]; return <Button key={index} variant="ghost" size="sm" aria-pressed={selected === index} onClick={() => setSelected(index)} className={`px-2 text-xs ${selected === index ? 'bg-primary/5 text-primary hover:text-primary' : 'text-muted-foreground'}`}><Icon aria-hidden="true" className="h-3.5 w-3.5" />{label}</Button>; })}
          </div>
          <div className="min-h-[235px] pt-4" aria-live="polite">
            {selected === 0 && <>
              <div className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-3.5"><p className="mb-2 text-[10px] font-semibold tracking-wide text-primary">{t.hypothesisLabel}</p><p className="text-sm leading-relaxed">{t.hypothesis}</p></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">{t.versions.map((label, index) => <div key={index} className={`rounded-lg border p-4 ${index === 1 ? 'border-primary/25 bg-primary/[0.02]' : 'border-border'}`}><div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><span className="rounded bg-primary/5 px-2 py-1 font-semibold text-primary">{index === 0 ? 'A' : 'B'}</span>{t.versionRoles[index]}</div><p className="text-sm font-medium leading-relaxed">{label}</p></div>)}</div>
              <div className="mt-4 flex flex-wrap gap-x-7 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground"><span>{t.metric}<strong className="ml-2 font-medium text-foreground">{t.metricValue}</strong></span><span>{t.collection}</span></div>
            </>}
            {selected === 1 && <><p className="mb-4 text-sm text-muted-foreground">{t.descriptions[1]}</p><div className="space-y-4 rounded-lg border border-border p-5"><div className="flex justify-between gap-3 text-sm"><span>{t.rollout}</span><span className="font-semibold">0%</span></div><div aria-hidden="true" className="h-2 rounded-full bg-secondary" /><p className="text-sm leading-relaxed text-muted-foreground">{t.rolloutHelp}</p></div></>}
            {selected === 2 && <><div className="rounded-lg border border-dashed border-border p-5"><p className="text-sm font-medium">{t.noData}</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.noDataHelp}</p></div><div className="mt-4"><p className="text-sm font-medium">{t.decision}</p><p className="mt-2 text-sm text-muted-foreground">{t.decisionHelp}</p></div></>}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

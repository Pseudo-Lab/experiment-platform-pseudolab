import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { projectApi, type Experiment, type ProjectSdkDiagnostics } from '../../../services/api';

const copy = {
  ko: {
    title: '실험 연동 진단', select: '진단할 실험', placeholder: '실험을 선택하세요',
    hint: '실험을 선택하면 노출과 행동이 집계에 반영됐는지 확인할 수 있습니다.',
    loading: '진단 기록을 확인하는 중입니다.', error: '진단 기록을 불러오지 못했습니다. 다시 시도해 주세요.',
    refresh: '새로고침', retry: '다시 시도', unsupported: '이전 수집 방식의 실험은 상세 진단을 지원하지 않습니다. 실험 상세 화면에서 기존 결과를 확인하세요.',
    raw: '현재 보존된 원본 기준', snapshot: '봉인된 입력 기준',
    snapshotNote: '결과 확정에 사용한 입력입니다. 이후 도착한 기록이나 확정 전에 제외된 일부 기록은 이 입력에 포함되지 않습니다.',
    caption: '실험 노출과 행동의 입력·집계 건수', records: '입력 기록', included: '집계 반영',
    exposure: '노출', action: '행동', goal: '목표 이벤트', goals: '목표 행동 반영', noGoal: '미설정',
    unmatched: '노출에 연결되지 않은 행동', window: '전환 인정 기간 밖 행동', policy: '그 밖의 집계 기준에서 제외된 기록',
    empty: '진단 대상 SDK 기록이 없습니다. 브라우저의 요청 응답, 프로젝트 키·API 주소와 experimentId를 확인하고, 화면이 표시된 시점에 expose()를 호출했는지 확인하세요.',
    matchHelp: 'decide()에서 받은 같은 tracking_context로 노출과 행동을 전송했는지 확인하세요. 행동보다 이른 노출이 수신돼야 합니다.',
    windowHelp: '전환 인정 기간은 첫 적격 노출부터 계산합니다. 행동 발생 시각과 실험에 설정한 기간을 확인하세요.',
    policyHelp: '실행 상태, 시작 시 고정한 변형, 발생 시각과 수신 지연 등을 확인하세요. 이 건수만으로 세부 원인을 확정할 수는 없습니다.',
    goalHelp: '노출은 반영됐지만 목표 행동 기록은 없습니다. 목표 이벤트 이름과 실제 행동 시점의 전송 여부를 확인하세요.',
    unit: '이벤트 건수입니다. 결과 화면의 사용자 수·전환율과는 다를 수 있습니다.',
    traffic: '점검용 전송도 포함될 수 있으며 실제 방문자 여부는 자동 판별하지 않습니다. 테스트는 별도 프로젝트나 실험에서 진행하세요. 저장 전에 거부된 요청이나 고객 수집기로만 보낸 기록은 여기서 확인할 수 없습니다.',
  },
  en: {
    title: 'Experiment integration diagnostics', select: 'Experiment to inspect', placeholder: 'Select an experiment',
    hint: 'Select an experiment to check whether exposures and actions contribute to its readout.',
    loading: 'Checking diagnostic records.', error: 'Could not load diagnostic records. Please retry.',
    refresh: 'Refresh', retry: 'Retry', unsupported: 'Detailed diagnostics are unavailable for experiments using older collection methods. Check the existing results in experiment details.',
    raw: 'Currently retained raw input', snapshot: 'Sealed input',
    snapshotNote: 'This is the input used to freeze the readout. Later arrivals and some records rejected before freezing are not part of this input.',
    caption: 'Input and included exposure and action event counts', records: 'Input records', included: 'Included',
    exposure: 'Exposures', action: 'Actions', goal: 'Goal event', goals: 'Included goal actions', noGoal: 'Not configured',
    unmatched: 'Actions without a matching exposure', window: 'Actions outside the conversion window', policy: 'Records excluded by other readout rules',
    empty: 'No SDK input records are available. Check browser request responses, the project key, API URL and experimentId, and whether expose() is called when the UI is displayed.',
    matchHelp: 'Send exposures and actions with the same tracking_context returned by decide(). An earlier exposure must have been received.',
    windowHelp: 'The conversion window starts at the first eligible exposure. Check action timestamps and the configured window.',
    policyHelp: 'Check lifecycle state, launch-declared variants, occurrence timestamps and delivery delay. This count alone cannot identify the exact cause.',
    goalHelp: 'Exposures are included but no goal actions are included. Check the goal event name and whether the actual action sends it.',
    unit: 'These are event counts and may differ from user counts and conversion rates in results.',
    traffic: 'Test traffic may be included; real visitors are not identified automatically. Use a separate project or experiment for testing. Requests rejected before storage or sent only to your own collector are not visible here.',
  },
};

export function SdkDiagnostics({ projectId, experiments, lang }: {
  projectId: string; experiments: Experiment[]; lang: 'ko' | 'en';
}) {
  const t = copy[lang];
  const [selected, setSelected] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ experimentId: string; data?: ProjectSdkDiagnostics; failed?: boolean } | null>(null);
  const experimentId = experiments.some(e => e.id === selected) ? selected : '';
  const current = result?.experimentId === experimentId ? result : null;
  const d = current?.data;
  const format = (n: number) => new Intl.NumberFormat(lang).format(n);

  useEffect(() => {
    let active = true;
    setResult(null);
    if (experimentId) {
      projectApi.sdkStatus(projectId, experimentId).then(response => {
        if (!active) return;
        const data = response.diagnostics;
        if (response.project_id !== projectId || !data || data.experiment_id !== experimentId) {
          setResult({ experimentId, failed: true });
        } else setResult({ experimentId, data });
      }).catch(() => { if (active) setResult({ experimentId, failed: true }); });
    }
    return () => { active = false; };
  }, [projectId, experimentId, attempt]);

  return <section aria-label={t.title} className="space-y-4 border-t border-border pt-5">
    <h2 className="text-base font-semibold">{t.title}</h2>
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1 basis-48 space-y-2">
        <label htmlFor="sdk-diagnostic-experiment" className="text-sm font-medium">{t.select}</label>
        <Select value={experimentId} onValueChange={setSelected} disabled={experiments.length === 0}>
          <SelectTrigger id="sdk-diagnostic-experiment" className="min-h-11 w-full"><SelectValue placeholder={t.placeholder} /></SelectTrigger>
          <SelectContent>{experiments.map(e =>
            <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {experimentId && <Button variant="outline" disabled={!current} onClick={() => setAttempt(n => n + 1)}>{current?.failed ? t.retry : t.refresh}</Button>}
    </div>
    {!experimentId ? <p className="text-sm text-muted-foreground">{t.hint}</p>
      : current?.failed ? <p role="alert" className="text-sm text-destructive">{t.error}</p>
      : !d ? <p role="status" className="text-sm text-muted-foreground">{t.loading}</p>
      : !d.supported ? <p className="text-sm text-muted-foreground">{t.unsupported}</p>
      : <div className="space-y-4" aria-live="polite">
        <p className="text-sm font-medium">{d.source === 'snapshot' ? t.snapshot : t.raw}</p>
        {d.source === 'snapshot' && <p className="text-sm text-muted-foreground">{t.snapshotNote}</p>}
        <table className="w-full text-sm tabular-nums">
          <caption className="sr-only">{t.caption}</caption>
          <thead><tr className="border-b border-border text-muted-foreground"><th scope="col" className="p-2 text-left"><span className="sr-only">{t.caption}</span></th><th scope="col" className="p-2 text-right">{t.records}</th><th scope="col" className="p-2 text-right">{t.included}</th></tr></thead>
          <tbody>{[[t.exposure, d.exposures, d.included_exposures], [t.action, d.actions, d.included_actions]].map(([label, total, included]) =>
            <tr key={label} className="border-b border-border"><th scope="row" className="p-2 text-left font-medium">{label}</th><td className="p-2 text-right">{format(Number(total))}</td><td className="p-2 text-right">{format(Number(included))}</td></tr>)}</tbody>
        </table>
        <p className="break-words text-sm">{t.goal}: <span className="font-medium">{d.goal_event || t.noGoal}</span> · {t.goals}: {format(d.goal_actions)}</p>
        <dl className="space-y-2 text-sm tabular-nums">{[
          [t.unmatched, d.unmatched_actions], [t.window, d.outside_window_actions], [t.policy, d.policy_excluded_events],
        ].map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt>{label}</dt><dd className="shrink-0 font-medium">{format(Number(value))}</dd></div>)}</dl>
        <div className="space-y-2 text-sm text-muted-foreground">
          {d.exposures + d.actions === 0 && <p>{t.empty}</p>}
          {d.unmatched_actions > 0 && <p>{t.matchHelp}</p>}
          {d.outside_window_actions > 0 && <p>{t.windowHelp}</p>}
          {d.policy_excluded_events > 0 && <p>{t.policyHelp}</p>}
          {d.included_exposures > 0 && d.goal_actions === 0 && <p>{t.goalHelp}</p>}
          <p>{t.unit}</p><p>{t.traffic}</p>
        </div>
      </div>}
  </section>;
}

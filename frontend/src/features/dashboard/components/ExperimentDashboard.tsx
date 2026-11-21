import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProject } from '../../../contexts/ProjectContext';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import {
  experimentAnalyticsApi,
  experimentResultApi,
  availableEventsApi,
  decisionApi,
  type ExperimentAnalyticsResponse,
  type ExperimentResult,
  type AvailableEventsResponse,
  type Decision,
  type Experiment,
  type DecisionType,
} from '../../../services/api';

const copy = {
  ko: {
    health: '연동·수집 확인',
    healthHint: '이 실험에 이벤트가 들어오는지 먼저 확인하세요.',
    results: '결과',
    resultsHint: '수집 상태와 분석 조건을 확인한 뒤 결과를 해석하세요.',
    decisions: '결정 기록',
    decisionsHint:
      '판단과 근거를 남깁니다. 기록을 저장해도 실험 상태나 트래픽은 바뀌지 않습니다.',
    loading: '불러오는 중…',
    retry: '다시 시도',
    error: '데이터를 불러오지 못했습니다. 수집 여부를 확인할 수 없습니다.',
    resultError: '분석 결과를 불러오지 못했습니다.',
    decisionError: '결정 이력을 불러오지 못했습니다.',
    noEvents: '아직 수집된 이벤트가 없습니다.',
    sdk: 'SDK 연동 확인',
    events: '수집된 이벤트',
    totalEvents: '이벤트 건수',
    impressions: '노출 관련 이벤트 건수',
    trend: '일별 노출 관련 이벤트',
    distribution: '그룹별 이벤트 분포',
    noTrend: '표시할 이벤트 추이가 없습니다.',
    total: '전체',
    balance: '배정 비율 확인 (SRM)',
    imbalance: '배정 비율 경고가 있습니다.',
    noWarning: '현재 집계에서 배정 비율 경고가 없습니다.',
    unknown: '확인할 데이터가 부족합니다.',
    noResult: '결과를 계산할 노출 데이터가 부족합니다.',
    metric: '주요 지표',
    unspecified: '미설정',
    uplift: '전환율 차이',
    probability: '실험군이 더 나을 확률',
    sample: '분석 표본',
    exposure: '노출 이벤트를 기록한 사용자 기준',
    assignment: '배정 기준',
    analysisHint:
      '현재 분석의 참고값입니다. 관찰 기간과 수집 누락을 함께 검토하고, 자동 판단만으로 적용을 결정하지 마세요.',
    judgment: '자동 분석 참고',
    ship: '채택 검토',
    hold: '보류 검토',
    rollback: '되돌리기 검토',
    need_more_data: '추가 데이터 필요',
    variant: '그룹',
    users: '사용자',
    conversions: '전환 사용자',
    rate: '전환율',
    guardrails: '보호 지표',
    noGuardrail: '보호 지표 분석 결과가 없습니다.',
    deteriorating: '악화 감지',
    stable: '악화 미감지',
    aggregate: '이벤트 집계 기준 전환율',
    aggregateHint: '위의 노출 사용자 기준 분석과 집계 기준이 다를 수 있습니다.',
    eventComparison: '그룹별 노출·전환',
    rateComparison: '그룹별 전환율 비교',
    rateScale: '같은 전환율 척도 · 0–{max}',
    rateUnavailable: '전환율을 비교할 정보가 부족합니다.',
    countDetails: '노출·전환 건수 자세히 보기',
    eventImpressions: '노출',
    eventConversions: '전환',
    eventUnit: '노출·전환 이벤트 집계이며 고유 방문자 수가 아닙니다. 사용자 단위 분석·보호 지표·출시 판단은 제공하지 않습니다.',
    instanceUnit: '노출 횟수와 목표 행동이 연결된 노출 횟수입니다. 같은 노출에서 반복된 목표 행동은 한 번으로 집계합니다.',
    countScale: '모든 막대에 같은 건수 척도 적용 · 최대 {count}',
    noCounts: '아직 집계된 노출·전환이 없습니다.',
    noBreakdown: '그룹별 비교 데이터가 없습니다. 전체 건수는 합계를 참고하세요.',
    significance: '이벤트 집계 z-test p값',
    record: '결정 저장',
    reason: '결정 이유',
    reasonHint: '관찰한 결과와 다음 행동을 남겨주세요.',
    saving: '저장 중…',
    saved: '결정을 기록했습니다.',
    saveError: '저장하지 못했습니다. 입력한 내용은 유지됩니다.',
    history: '결정 이력',
    noDecisions: '아직 기록한 결정이 없습니다.',
    SHIP: '채택',
    HOLD: '보류',
    ROLLBACK: '되돌리기',
  },
  en: {
    health: 'Collection health',
    healthHint: 'First check whether this experiment is receiving events.',
    results: 'Results',
    resultsHint:
      'Check collection health and analysis assumptions before interpreting results.',
    decisions: 'Decision log',
    decisionsHint:
      'Record your judgment and reasoning. Saving a decision does not change experiment status or traffic.',
    loading: 'Loading…',
    retry: 'Retry',
    error: 'Could not load data. Collection status is unknown.',
    resultError: 'Could not load analysis results.',
    decisionError: 'Could not load decision history.',
    noEvents: 'No events have been collected yet.',
    sdk: 'Check SDK integration',
    events: 'Collected events',
    totalEvents: 'Event count',
    impressions: 'Impression event count',
    trend: 'Daily impression events',
    distribution: 'Events by group',
    noTrend: 'No event trend to display.',
    total: 'All',
    balance: 'Allocation balance (SRM)',
    imbalance: 'An allocation imbalance was detected.',
    noWarning: 'No allocation warning in the current aggregate.',
    unknown: 'Not enough data to check.',
    noResult: 'Not enough exposure data to calculate results.',
    metric: 'Primary metric',
    unspecified: 'Not configured',
    uplift: 'Conversion rate difference',
    probability: 'Probability treatment wins',
    sample: 'Analysis sample',
    exposure: 'Users with recorded exposure events',
    assignment: 'Based on assignments',
    analysisHint:
      'These are provisional analysis values. Review the observation period and missing events before acting on the automated assessment.',
    judgment: 'Automated assessment',
    ship: 'Consider adopting',
    hold: 'Consider holding',
    rollback: 'Consider reverting',
    need_more_data: 'More data needed',
    variant: 'Group',
    users: 'Users',
    conversions: 'Converted users',
    rate: 'Conversion rate',
    guardrails: 'Guardrail metrics',
    noGuardrail: 'No guardrail analysis results.',
    deteriorating: 'Deterioration detected',
    stable: 'No deterioration detected',
    aggregate: 'Event aggregate conversion rates',
    aggregateHint:
      'This aggregate may use a different denominator from the exposure analysis above.',
    eventComparison: 'Impressions and conversions by group',
    rateComparison: 'Conversion rates by group',
    rateScale: 'Shared conversion-rate scale · 0–{max}',
    rateUnavailable: 'Not enough information to compare this rate.',
    countDetails: 'View impression and conversion counts',
    eventImpressions: 'Impressions',
    eventConversions: 'Conversions',
    eventUnit: 'These are impression/conversion event counts, not unique visitors. User-level analysis, guardrails and launch judgments are unavailable.',
    instanceUnit: 'Counts exposures and exposures linked to the goal action. Repeated goal actions on the same exposure count once.',
    countScale: 'All bars share the same count scale · maximum {count}',
    noCounts: 'No impressions or conversions have been counted yet.',
    noBreakdown: 'No group breakdown is available. Refer to the totals.',
    significance: 'Event aggregate z-test p-value',
    record: 'Save decision',
    reason: 'Decision reason',
    reasonHint: 'Describe what you observed and what to do next.',
    saving: 'Saving…',
    saved: 'Decision recorded.',
    saveError: 'Could not save. Your input has been kept.',
    history: 'Decision history',
    noDecisions: 'No decisions recorded yet.',
    SHIP: 'Adopt',
    HOLD: 'Hold',
    ROLLBACK: 'Revert',
  },
};

type View = 'health' | 'results' | 'decisions';
interface Props {
  isAdmin?: boolean;
  experimentId: string;
  experiment: Experiment;
  lang: 'en' | 'ko';
  view?: View;
}

export const ExperimentDashboard: React.FC<Props> = ({
  experimentId,
  experiment,
  lang,
  view = 'health',
  isAdmin = true,
}) => {
  const t = copy[lang];
  const { setCurrentProjectId } = useProject();
  const [analytics, setAnalytics] =
    useState<ExperimentAnalyticsResponse | null>(null);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [events, setEvents] = useState<AvailableEventsResponse | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [choice, setChoice] = useState<DecisionType>('HOLD');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>(
    'idle',
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrors([]);
    Promise.allSettled([
      experimentAnalyticsApi.get(experimentId),
      isAdmin ? experimentResultApi.getResult(experimentId) : Promise.resolve(null),
      availableEventsApi.get(experimentId),
      isAdmin ? decisionApi.list(experimentId) : Promise.resolve([]),
    ]).then(([a, r, e, d]) => {
      if (cancelled) return;
      setAnalytics(a.status === 'fulfilled' ? a.value : null);
      setResult(r.status === 'fulfilled' ? r.value : null);
      setEvents(e.status === 'fulfilled' ? e.value : null);
      setDecisions(d.status === 'fulfilled' ? d.value : []);
      setErrors(
        [
          a.status === 'rejected' ? 'analytics' : '',
          r.status === 'rejected' ? 'result' : '',
          e.status === 'rejected' ? 'events' : '',
          d.status === 'rejected' ? 'decisions' : '',
        ].filter(Boolean),
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [experimentId, revision, isAdmin]);

  const saveDecision = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reason.trim() || submitting) return;
    setSubmitting(true);
    setSaveState('idle');
    try {
      const decision = await decisionApi.createForExperiment(experimentId, {
        decision: choice,
        reason: reason.trim(),
      });
      setDecisions((previous) => [decision, ...previous]);
      setReason('');
      setSaveState('saved');
    } catch {
      setSaveState('error');
    } finally {
      setSubmitting(false);
    }
  };

  const retry = (message: string) => (
    <Card role="alert" className="p-5 space-y-3 border-destructive/40">
      <p className="text-sm">{message}</p>
      <Button
        variant="outline"
        onClick={() => setRevision((value) => value + 1)}
      >
        {t.retry}
      </Button>
    </Card>
  );
  const byVariant = analytics?.impressions.time_series_by_variant ?? {};
  const variants = Object.keys(byVariant);
  const dates = [
    ...new Set(
      Object.values(byVariant).flatMap((points) =>
        points.map((point) => point.date),
      ),
    ),
  ].sort();
  const trend = variants.length
    ? dates.map((date) =>
        Object.fromEntries([
          ['date', date],
          ...variants.map((variant) => [
            variant,
            byVariant[variant].find((point) => point.date === date)?.count ?? 0,
          ]),
        ]),
      )
    : (analytics?.impressions.time_series.map((point) => ({
        date: point.date,
        [t.total]: point.count,
      })) ?? []);
  const series = variants.length ? variants : [t.total];
  const locale = lang === 'ko' ? 'ko-KR' : 'en-US';
  const readout = isAdmin ? result : analytics;
  const percentage = (value: number | null | undefined) =>
    value == null ? '—' : `${(value * 100).toFixed(2)}%`;
  const impressionCounts = new Map(Object.entries(analytics?.impressions.by_variant ?? {}));
  const conversionCounts = new Map(Object.entries(analytics?.conversions.by_variant ?? {}));
  const conversionRates = new Map(Object.entries(analytics?.conversions.rate ?? {}));
  const countGroups = [...new Set([...impressionCounts.keys(), ...conversionCounts.keys()])].sort();
  const maxCount = Math.max(0, ...impressionCounts.values(), ...conversionCounts.values());
  const groupRates = countGroups.map((variant) => {
    const impressions = impressionCounts.get(variant) ?? 0;
    const rate = conversionRates.get(variant);
    return {
      variant,
      impressions,
      conversions: conversionCounts.get(variant) ?? 0,
      rate: impressions > 0 && rate != null && Number.isFinite(rate) && rate >= 0 ? rate : null,
    };
  });
  const largestRate = Math.max(0, ...groupRates.map(({ rate }) => rate ?? 0));
  const rateStep = largestRate > 0 ? 10 ** Math.floor(Math.log10(largestRate)) : 1;
  const rateCeiling = largestRate > 0 ? Math.ceil(largestRate / rateStep) * rateStep : 1;
  const observedRate = (rate: number | null | undefined) =>
    rate != null && rate > 0 && rate < 0.0001 ? '<0.01%' : percentage(rate);

  return (
    <section className="space-y-6" aria-label={t[view]}>
      <div>
        <h2 className="text-xl font-semibold">{t[view]}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t[`${view}Hint`]}</p>
      </div>
      {loading ? (
        <p role="status" className="py-10 text-muted-foreground">
          {t.loading}
        </p>
      ) : (
        <>
          {view === 'health' && (
            <>
              {(errors.includes('events') || errors.includes('analytics')) &&
                retry(t.error)}
              {events && (
                <Card className="p-5 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {t.totalEvents}
                  </p>
                  <p className="text-3xl font-semibold tabular-nums">
                    {events.total_events.toLocaleString(locale)}
                  </p>
                  {events.total_events === 0 ? (
                    <>
                      <p>{t.noEvents}</p>
                      <Button asChild variant="outline">
                        <Link to="/api-key" onClick={() => setCurrentProjectId(experiment.project_id || experiment.product || null)}>{t.sdk}</Link>
                      </Button>
                    </>
                  ) : (
                    <>
                      <h3 className="text-sm font-medium">{t.events}</h3>
                      <div className="flex flex-wrap gap-2">
                        {events.event_types.map((name) => (
                          <code
                            key={name}
                            className="rounded-md bg-muted px-2 py-1 text-xs break-all"
                          >
                            {name}
                          </code>
                        ))}
                      </div>
                    </>
                  )}
                </Card>
              )}
              {analytics && (
                <div className="grid lg:grid-cols-3 gap-4">
                  <Card className="lg:col-span-2 min-w-0">
                    <CardHeader>
                      <CardTitle className="text-base">{t.trend}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {trend.length ? (
                        <ResponsiveContainer width="100%" height={230}>
                          <LineChart data={trend}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="hsl(var(--border))"
                            />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip
                              contentStyle={{
                                background: 'hsl(var(--background))',
                                borderColor: 'hsl(var(--border))',
                              }}
                            />
                            <Legend />
                            {series.map((variant, index) => (
                              <Line
                                key={variant}
                                dataKey={variant}
                                stroke={
                                  ['#6366f1', '#10b981', '#f59e0b', '#ec4899'][
                                    index % 4
                                  ]
                                }
                                strokeWidth={2}
                                dot={false}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="py-12 text-sm text-muted-foreground">
                          {t.noTrend}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="p-5 space-y-5">
                    <div>
                      <h3 className="text-sm text-muted-foreground">
                        {t.impressions}
                      </h3>
                      <p className="text-2xl font-semibold">
                        {analytics.impressions.total.toLocaleString(locale)}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium mb-2">
                        {t.distribution}
                      </h3>
                      {Object.entries(analytics.impressions.by_variant).map(
                        ([variant, count]) => (
                          <div
                            key={variant}
                            className="flex justify-between gap-2 text-sm"
                          >
                            <span className="break-all">{variant}</span>
                            <span>{count.toLocaleString(locale)}</span>
                          </div>
                        ),
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">{t.balance}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {analytics.impressions.total === 0 ||
                        analytics.srm_warning == null
                          ? t.unknown
                          : analytics.srm_warning
                            ? t.imbalance
                            : t.noWarning}
                      </p>
                    </div>
                  </Card>
                </div>
              )}
            </>
          )}
          {view === 'results' && (
            <>
              <p className="text-sm text-muted-foreground">
                {t.metric}:{' '}
                <code className="text-foreground break-all">
                  {experiment.primary_metric || t.unspecified}
                </code>
              </p>
              {readout?.readout_state && <div role="status" className="space-y-1 text-sm">
                <p className="font-medium">{lang === 'ko'
                  ? ({ collecting: '집계 중', observing: '관찰 중', finalized: '결과 확정' } as const)[readout.readout_state]
                  : ({ collecting: 'Collecting', observing: 'Observing', finalized: 'Results finalized' } as const)[readout.readout_state]}</p>
                <p className="max-w-prose text-muted-foreground">{readout.readout_state === 'finalized'
                  ? (lang === 'ko' ? '확정 당시의 입력과 결과를 보존하며, 이후 도착한 이벤트를 합산하지 않습니다.' : 'The finalized inputs and results are preserved. Events arriving later are excluded.')
                  : (lang === 'ko' ? '관찰과 지연 전송 반영이 끝나기 전까지 결과가 바뀔 수 있습니다.' : 'Results can change until observation and late-event processing finish.')}</p>
                {readout.finalizes_at && readout.readout_state !== 'finalized' && <p className="text-muted-foreground">
                  {lang === 'ko' ? '확정 가능 시각' : 'Finalization available after'}: {new Date(readout.finalizes_at).toLocaleString(locale)}
                </p>}
              </div>}
              {!isAdmin && errors.includes('analytics') ? retry(t.error) : !isAdmin ? (
                <Card className="p-5 sm:p-6 space-y-6">
                  <figure aria-label={t.rateComparison} className="space-y-3">
                    <figcaption className="space-y-2">
                      <h3 className="text-lg font-semibold">{t.rateComparison}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">{t.eventUnit}</p>
                    </figcaption>
                    {maxCount === 0 ? (
                      <p className="py-4 text-sm text-muted-foreground">{analytics?.impressions.total === 0 && analytics?.conversions.total === 0 ? t.noCounts : t.noBreakdown}</p>
                    ) : (
                      <>
                        {groupRates.some(({ rate }) => rate != null) && <p className="break-words text-xs text-muted-foreground">{t.rateScale.replace('{max}', new Intl.NumberFormat(locale, { style: 'percent', maximumSignificantDigits: 3 }).format(rateCeiling))}</p>}
                        <table className="w-full table-fixed text-sm">
                          <caption className="sr-only">{t.rateComparison}</caption>
                          <colgroup>
                            <col className="w-[32%] sm:w-[28%]" />
                            <col className="w-[32%] sm:w-[36%]" />
                            <col className="w-[36%]" />
                          </colgroup>
                          <thead className="border-b text-xs text-muted-foreground">
                            <tr>
                              <th scope="col" className="pb-2 pr-3 text-left font-medium">{t.variant}</th>
                              <th scope="col" className="px-2 pb-2 text-right font-medium">{t.rate}</th>
                              <th scope="col" className="break-words pb-2 pl-3 text-right font-medium">{t.eventConversions} / {t.eventImpressions}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {groupRates.map(({ variant, impressions, conversions, rate }) => (
                              <tr key={variant}>
                                <th scope="row" className="break-all py-3 pr-3 text-left font-semibold">{variant}</th>
                                <td className="px-2 py-3 text-right tabular-nums">
                                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                                    <span className="shrink-0 font-semibold">{observedRate(rate)}</span>
                                    {rate != null && (
                                      <div aria-hidden="true" className="h-1.5 min-w-0 rounded-sm bg-muted sm:order-first sm:flex-1">
                                        <div className="h-full rounded-sm bg-foreground" style={{ width: `${rate / rateCeiling * 100}%` }} />
                                      </div>
                                    )}
                                  </div>
                                  {rate == null && <p className="mt-1 break-words text-xs text-muted-foreground">{t.rateUnavailable}</p>}
                                </td>
                                <td className="break-all py-3 pl-3 text-right text-xs tabular-nums sm:text-sm">{conversions.toLocaleString(locale)} / {impressions.toLocaleString(locale)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                    {experiment.event_model === 'sdk_v1' && <p className="text-sm leading-relaxed text-muted-foreground">{t.instanceUnit}</p>}
                  </figure>
                  <dl className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-4 border-y py-6">
                    {([
                      [t.eventImpressions, analytics?.impressions.total],
                      [t.eventConversions, analytics?.conversions.total],
                    ] as const).map(([label, count]) => (
                      <div key={label} className="min-w-0">
                        <dt className="text-sm text-muted-foreground">{label}</dt>
                        <dd className="mt-1 break-words text-2xl sm:text-3xl font-semibold tabular-nums">{count?.toLocaleString(locale) ?? '—'}</dd>
                      </div>
                    ))}
                  </dl>
                  <details>
                    <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">{t.countDetails}</summary>
                  <figure aria-label={t.eventComparison} className="space-y-5 pt-3">
                    <figcaption className="space-y-2">
                      <h3 className="font-semibold">{t.eventComparison}</h3>
                    </figcaption>
                    {maxCount === 0 ? (
                      <p className="py-4 text-sm text-muted-foreground">{analytics?.impressions.total === 0 && analytics?.conversions.total === 0 ? t.noCounts : t.noBreakdown}</p>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">{t.countScale.replace('{count}', maxCount.toLocaleString(locale))}</p>
                        <ul className="space-y-6">
                          {groupRates.map(({ variant, impressions, conversions, rate }) => (
                              <li key={variant} className="space-y-3">
                                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                  <p className="min-w-0 break-all text-sm font-semibold">{variant}</p>
                                  <p className="text-sm tabular-nums text-muted-foreground">{t.rate}: <span className="font-medium text-foreground">{observedRate(rate)}</span></p>
                                </div>
                                {([
                                  [t.eventImpressions, impressions, 'bg-foreground'],
                                  [t.eventConversions, conversions, 'bg-ring'],
                                ] as const).map(([label, count, color]) => (
                                  <div key={label} className="flex items-center gap-3 text-sm">
                                    <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
                                    <span aria-hidden="true" className="h-3 min-w-0 flex-1 rounded-sm bg-muted">
                                      <span className={`block h-full rounded-sm ${color}`} style={{ width: `${count / maxCount * 100}%` }} />
                                    </span>
                                    <span className="w-20 shrink-0 text-right tabular-nums">{count.toLocaleString(locale)}</span>
                                  </div>
                                ))}
                              </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </figure>
                  </details>
                </Card>
              ) : errors.includes('result') ? (
                retry(t.resultError)
              ) : !result || result.sample_size === 0 ? (
                <Card className="p-6 text-muted-foreground">{t.noResult}</Card>
              ) : (
                <>
                  <Card className="p-5 space-y-2 bg-muted/40">
                    <p className="font-medium">
                      {t.judgment}:{' '}
                      {result.judgment ? t[result.judgment] : t.unknown}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t.analysisHint}
                    </p>
                  </Card>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <Card className="p-5">
                      <p className="text-sm text-muted-foreground">
                        {t.uplift}
                      </p>
                      <p className="text-2xl font-semibold mt-2">
                        {result.uplift == null
                          ? '—'
                          : `${(result.uplift * 100).toFixed(2)} pp`}
                      </p>
                      {result.confidence_interval && (
                        <p className="text-xs text-muted-foreground mt-2">
                          95% CI [
                          {result.confidence_interval
                            .map((value) => (value * 100).toFixed(2))
                            .join(', ')}
                          ] pp
                        </p>
                      )}
                    </Card>
                    <Card className="p-5">
                      <p className="text-sm text-muted-foreground">
                        {t.probability}
                      </p>
                      <p className="text-2xl font-semibold mt-2">
                        {percentage(result.probability_treatment_wins)}
                      </p>
                    </Card>
                    <Card className="p-5">
                      <p className="text-sm text-muted-foreground">
                        {t.sample}
                      </p>
                      <p className="text-2xl font-semibold mt-2">
                        {result.sample_size.toLocaleString(locale)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {result.denominator_source === 'exposure'
                          ? t.exposure
                          : result.denominator_source === 'assignment'
                            ? t.assignment
                            : '—'}
                      </p>
                    </Card>
                  </div>
                  <Card className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/40">
                        <tr>
                          {[t.variant, t.users, t.conversions, t.rate].map(
                            (label) => (
                              <th
                                key={label}
                                className="p-4 font-medium whitespace-nowrap"
                              >
                                {label}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {[result.control, result.treatment]
                          .filter((item) => item != null)
                          .map((item) => (
                            <tr key={item.variant_name} className="border-t">
                              <td className="p-4">{item.variant_name}</td>
                              <td className="p-4">
                                {item.users.toLocaleString(locale)}
                              </td>
                              <td className="p-4">
                                {item.conversions.toLocaleString(locale)}
                              </td>
                              <td className="p-4">{percentage(item.rate)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </Card>
                  <Card className="p-5 space-y-3">
                    <h3 className="font-medium">{t.guardrails}</h3>
                    {result.guardrail_results?.length ? (
                      result.guardrail_results.map((metric) => (
                        <div
                          key={metric.metric}
                          className="border-t pt-3 text-sm space-y-1"
                        >
                          <p className="break-all font-medium">
                            {metric.metric} ·{' '}
                            {metric.deteriorating ? t.deteriorating : t.stable}
                          </p>
                          <p className="text-muted-foreground">
                            control {percentage(metric.control_rate)} /
                            treatment {percentage(metric.treatment_rate)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t.noGuardrail}
                      </p>
                    )}
                  </Card>
                </>
              )}
              {isAdmin && (errors.includes('analytics')
                ? (isAdmin ? retry(t.resultError) : null)
                : analytics && (
                    <details className="rounded-xl border p-5">
                      <summary className="cursor-pointer font-medium text-sm">
                        {t.aggregate}
                      </summary>
                      <p className="text-sm text-muted-foreground my-3">
                        {t.aggregateHint}
                      </p>
                      {Object.entries(analytics.conversions.rate).map(
                        ([variant, rate]) => (
                          <p key={variant} className="text-sm">
                            {variant}: {percentage(rate)}
                          </p>
                        ),
                      )}
                      <p className="text-sm mt-3">
                        {t.significance}:{' '}
                        {analytics.statistical_significance?.p_value?.toFixed(
                          4,
                        ) ?? '—'}
                      </p>
                    </details>
                  ))}
            </>
          )}
          {view === 'decisions' && (
            <>
              <Card className="p-5">
                <form onSubmit={saveDecision} className="space-y-4">
                  <fieldset disabled={submitting} className="space-y-4">
                    <legend className="sr-only">{t.decisions}</legend>
                    <div className="flex flex-wrap gap-2">
                      {(['SHIP', 'HOLD', 'ROLLBACK'] as const).map((type) => (
                        <Button
                          type="button"
                          key={type}
                          variant={choice === type ? 'default' : 'outline'}
                          aria-pressed={choice === type}
                          onClick={() => {
                            setChoice(type);
                            setSaveState('idle');
                          }}
                        >
                          {t[type]}
                        </Button>
                      ))}
                    </div>
                    <label
                      className="block text-sm font-medium"
                      htmlFor="decision-reason"
                    >
                      {t.reason}
                    </label>
                    <Textarea
                      id="decision-reason"
                      value={reason}
                      onChange={(event) => {
                        setReason(event.target.value);
                        setSaveState('idle');
                      }}
                      placeholder={t.reasonHint}
                      rows={3}
                      required
                    />
                    <Button
                      type="submit"
                      disabled={submitting || !reason.trim()}
                    >
                      {submitting ? t.saving : t.record}
                    </Button>
                  </fieldset>
                  {saveState === 'error' && (
                    <p role="alert" className="text-sm text-destructive">
                      {t.saveError}
                    </p>
                  )}
                  {saveState === 'saved' && (
                    <p role="status" className="text-sm">
                      {t.saved}
                    </p>
                  )}
                </form>
              </Card>
              <h3 className="font-medium">{t.history}</h3>
              {errors.includes('decisions') && retry(t.decisionError)}
              {!errors.includes('decisions') && !decisions.length && (
                <p className="text-sm text-muted-foreground">{t.noDecisions}</p>
              )}
              {decisions.map((decision) => (
                <Card key={decision.id} className="p-5 space-y-2">
                  <p className="font-medium">{t[decision.decision]}</p>
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {decision.reason}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {decision.decided_by} ·{' '}
                    {new Date(decision.decided_at).toLocaleString(locale)}
                  </p>
                </Card>
              ))}
            </>
          )}
        </>
      )}
    </section>
  );
};

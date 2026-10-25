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
      experimentResultApi.getResult(experimentId),
      availableEventsApi.get(experimentId),
      decisionApi.list(experimentId),
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
  }, [experimentId, revision]);

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
  const percentage = (value: number | null | undefined) =>
    value == null ? '—' : `${(value * 100).toFixed(2)}%`;

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
              {errors.includes('result') ? (
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
              {errors.includes('analytics')
                ? retry(t.resultError)
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
                  )}
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

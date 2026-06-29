import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  AlertTriangle, CheckCircle, Clock, X,
  Ship, Pause, RotateCcw, TrendingUp, Shield,
  Activity, Layers, ClipboardList, Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
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
  type JudgmentType,
} from '../../../services/api';

// ── 4-state 판단 배너 ─────────────────────────────────────────────
const JUDGMENT_CONFIG: Record<JudgmentType, {
  label: string;
  desc: string;
  icon: React.ReactNode;
  className: string;
}> = {
  ship: {
    label: 'SHIP 권장',
    desc: 'P(T>C) ≥ 95% · Uplift 양수 · 샘플 충분',
    icon: <Ship className="h-4 w-4" />,
    className: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-700 dark:text-emerald-300',
  },
  hold: {
    label: 'HOLD',
    desc: 'SRM 감지 또는 가드레일 이상 — 추가 모니터링 필요',
    icon: <Pause className="h-4 w-4" />,
    className: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-300',
  },
  rollback: {
    label: 'ROLLBACK 권장',
    desc: 'P(T>C) ≤ 5% · Uplift 음수 — treatment가 control보다 나쁨',
    icon: <RotateCcw className="h-4 w-4" />,
    className: 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-700 dark:text-rose-300',
  },
  need_more_data: {
    label: '데이터 부족',
    desc: '샘플이 충분히 수집될 때까지 대기',
    icon: <Clock className="h-4 w-4" />,
    className: 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400',
  },
};

function JudgmentBanner({ judgment }: { judgment: JudgmentType | null | undefined }) {
  if (!judgment) return null;
  const cfg = JUDGMENT_CONFIG[judgment];
  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-5 py-3.5 ${cfg.className}`}>
      <span className="shrink-0">{cfg.icon}</span>
      <div>
        <span className="font-bold text-sm mr-2">{cfg.label}</span>
        <span className="text-xs opacity-75">{cfg.desc}</span>
      </div>
    </div>
  );
}

// ── KPI 카드 그룹 (Δ%p + CI + P(T>C)) ─────────────────────────────
function KpiCards({ result }: { result: ExperimentResult }) {
  const uplift = result.uplift;
  const prob = result.probability_treatment_wins;
  const ci = result.confidence_interval;

  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Δ%p */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <p className="text-xs font-semibold text-slate-500 mb-1">Δ%p (Uplift)</p>
        {uplift !== null && uplift !== undefined ? (
          <>
            <p className={`text-xl font-extrabold ${uplift > 0 ? 'text-emerald-600' : uplift < 0 ? 'text-rose-600' : 'text-slate-600'}`}>
              {uplift > 0 ? '+' : ''}{(uplift * 100).toFixed(2)}%p
            </p>
            {ci && (
              <p className="text-xs text-slate-400 mt-1">
                95% CI [{(ci[0] * 100).toFixed(2)}%, {(ci[1] * 100).toFixed(2)}%]
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-400 flex items-center gap-1"><Clock className="h-3.5 w-3.5" />데이터 부족</p>
        )}
      </div>

      {/* P(T>C) */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <p className="text-xs font-semibold text-slate-500 mb-1">P(T&gt;C)</p>
        {prob !== null && prob !== undefined ? (
          <>
            <p className={`text-xl font-extrabold ${prob >= 0.95 ? 'text-emerald-600' : prob >= 0.80 ? 'text-amber-500' : 'text-slate-600'}`}>
              {(prob * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {prob >= 0.95 ? '통계적 유의' : prob >= 0.80 ? '경계 수준' : '유의하지 않음'}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-400 flex items-center gap-1"><Clock className="h-3.5 w-3.5" />데이터 부족</p>
        )}
      </div>

      {/* Sample */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <p className="text-xs font-semibold text-slate-500 mb-1">총 표본</p>
        <p className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
          {result.sample_size.toLocaleString()}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {result.control ? `control: ${result.control.users.toLocaleString()}` : '—'}
          {result.treatment ? ` / treatment: ${result.treatment.users.toLocaleString()}` : ''}
        </p>
      </div>
    </div>
  );
}

// ── P-value significance badge ──────────────────────────────────
function SigCard({ pValue }: { pValue: number | null }) {
  if (pValue === null) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
        <p className="text-xs font-semibold text-slate-500 mb-2">P(T&gt;C) — 통계적 유의성</p>
        <span className="inline-flex items-center gap-1.5 text-sm text-slate-400">
          <Clock className="h-3.5 w-3.5" />
          데이터 부족
        </span>
      </div>
    );
  }
  const isSignificant = pValue < 0.05;
  const isBorderline = pValue >= 0.05 && pValue < 0.1;
  return (
    <div className={`rounded-xl border p-4 ${
      isSignificant
        ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800'
        : isBorderline
        ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800'
        : 'border-slate-200 bg-slate-50 dark:bg-slate-900 dark:border-slate-800'
    }`}>
      <p className="text-xs font-semibold text-slate-500 mb-2">P(T&gt;C) — 통계적 유의성</p>
      <div className="flex items-center gap-1.5">
        {isSignificant ? (
          <>
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">통계적으로 유의함</span>
          </>
        ) : isBorderline ? (
          <>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">경계 수준</span>
          </>
        ) : (
          <>
            <Clock className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-400">유의하지 않음</span>
          </>
        )}
      </div>
      <p className="text-xs text-slate-400 mt-1">p = {pValue.toFixed(4)}</p>
    </div>
  );
}

const VARIANT_COLORS: Record<string, string> = {
  control: '#94a3b8',
  treatment: '#6366f1',
};
const EXTRA_COLORS = ['#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

function variantColor(variant: string, index: number): string {
  return VARIANT_COLORS[variant] ?? EXTRA_COLORS[index % EXTRA_COLORS.length];
}

const DECISION_CONFIG: Record<DecisionType, { label: string; icon: React.ReactNode; btnClass: string; badgeClass: string }> = {
  SHIP: {
    label: 'SHIP',
    icon: <Ship className="h-4 w-4" />,
    btnClass: 'bg-emerald-500 hover:bg-emerald-600 text-white',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  HOLD: {
    label: 'HOLD',
    icon: <Pause className="h-4 w-4" />,
    btnClass: 'bg-amber-500 hover:bg-amber-600 text-white',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  ROLLBACK: {
    label: 'ROLLBACK',
    icon: <RotateCcw className="h-4 w-4" />,
    btnClass: 'bg-rose-500 hover:bg-rose-600 text-white',
    badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  },
};

interface ExperimentDashboardProps {
  experimentId: string;
  experiment: Experiment;
  lang: 'en' | 'ko';
}

export const ExperimentDashboard: React.FC<ExperimentDashboardProps> = ({
  experimentId,
  experiment,
  lang,
}) => {
  const [analytics, setAnalytics] = useState<ExperimentAnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [experimentResult, setExperimentResult] = useState<ExperimentResult | null>(null);
  const [availableEvents, setAvailableEvents] = useState<AvailableEventsResponse | null>(null);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [decisionsLoading, setDecisionsLoading] = useState(true);

  // Decision modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<DecisionType>('SHIP');
  const [decisionReason, setDecisionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setAnalyticsLoading(true);
    experimentAnalyticsApi.get(experimentId)
      .then(setAnalytics)
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false));

    experimentResultApi.getResult(experimentId)
      .then(setExperimentResult)
      .catch(() => {});

    setEventsLoading(true);
    availableEventsApi.get(experimentId)
      .then(setAvailableEvents)
      .catch(() => {})
      .finally(() => setEventsLoading(false));

    setDecisionsLoading(true);
    decisionApi.list(experimentId)
      .then(setDecisions)
      .catch(() => {})
      .finally(() => setDecisionsLoading(false));
  }, [experimentId]);

  const openModal = (type: DecisionType) => {
    setSelectedDecision(type);
    setDecisionReason('');
    setSubmitError(null);
    setModalOpen(true);
  };

  const submitDecision = async () => {
    if (!decisionReason.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const d = await decisionApi.createForExperiment(experimentId, {
        decision: selectedDecision,
        reason: decisionReason.trim(),
      });
      setDecisions(prev => [d, ...prev]);
      setModalOpen(false);
      setDecisionReason('');
    } catch {
      setSubmitError('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  // P0: assignment trend data (per-variant time series)
  const trendData = useMemo(() => {
    if (!analytics) return [];
    const byVariantDate = analytics.impressions.time_series_by_variant ?? {};
    const variantKeys = Object.keys(byVariantDate);

    if (variantKeys.length === 0) {
      return analytics.impressions.time_series.map(p => ({ date: p.date, '전체': p.count }));
    }

    const allDates = new Set<string>();
    variantKeys.forEach(v => byVariantDate[v].forEach(p => allDates.add(p.date)));

    return Array.from(allDates).sort().map(date => {
      const point: Record<string, string | number> = { date };
      variantKeys.forEach(v => {
        const found = byVariantDate[v].find(p => p.date === date);
        point[v] = found?.count ?? 0;
      });
      return point;
    });
  }, [analytics]);

  const variantNames = analytics ? Object.keys(analytics.impressions.by_variant) : [];
  const trendKeys = trendData.length > 0
    ? Object.keys(trendData[0]).filter(k => k !== 'date')
    : variantNames;

  // P1: conversion rate bar data
  const convRateData = analytics
    ? Object.entries(analytics.conversions.rate).map(([v, r]) => ({
        variant: v,
        '전환율 (%)': +(r * 100).toFixed(2),
      }))
    : [];

  // Panel visibility derived from available events
  const hasImpressions = availableEvents?.has_impressions ?? false;
  const hasConversions = availableEvents?.has_conversions ?? false;
  const conversionEvents = availableEvents?.conversion_events ?? [];
  const eventTypes = availableEvents?.event_types ?? [];
  const totalEvents = availableEvents?.total_events ?? 0;

  const showP1 = !eventsLoading && (hasImpressions || hasConversions);
  const showP2 = !eventsLoading && eventTypes.includes('weekly_session_attended');
  const showP3 = !eventsLoading && conversionEvents.length >= 2;

  // Conversion event label for P1 chart title
  const convEventLabel = conversionEvents.length > 0
    ? conversionEvents.join(' / ')
    : '전환';

  return (
    <div className="space-y-8">
      {/* ─────────── Judgment 배너 ─────────── */}
      {experimentResult && (
        <JudgmentBanner judgment={experimentResult.judgment} />
      )}

      {/* ─────────── KPI 카드 ─────────── */}
      {experimentResult && experimentResult.sample_size > 0 && (
        <KpiCards result={experimentResult} />
      )}

      {/* ─────────── P0: 실험 헬스 ─────────── */}
      <section>
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100 mb-3">
          <Activity className="h-4 w-4 text-indigo-500" />
          P0 — 실험 헬스
        </h3>

        {/* No events at all */}
        {!eventsLoading && totalEvents === 0 ? (
          <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <CardContent className="pt-6 pb-6 flex flex-col items-center gap-3 text-center">
              <Info className="h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">
                아직 수집된 이벤트가 없습니다.<br />
                앱에서 SDK <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">decide()</code> 또는{' '}
                <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">track()</code>을 호출하면 여기에 표시됩니다.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Assignment trend */}
            <Card className="lg:col-span-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  배정 추이 (Variant별 누적)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsLoading ? (
                  <div className="h-44 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-slate-300 animate-spin" />
                  </div>
                ) : trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={trendData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {trendKeys.map((v, i) => (
                        <Line
                          key={v}
                          type="monotone"
                          dataKey={v}
                          stroke={variantColor(v, i)}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-44 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Clock className="h-8 w-8 opacity-30" />
                    <p className="text-xs">배정 데이터를 불러오는 중...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SRM + sample stats */}
            <div className="space-y-3">
              <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs font-semibold text-slate-500 mb-2">SRM 경고</p>
                  {analyticsLoading ? (
                    <span className="text-xs text-slate-400">로딩 중...</span>
                  ) : analytics?.srm_warning ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      ⚠ SRM 감지
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle className="h-3.5 w-3.5" />
                      정상
                    </span>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs font-semibold text-slate-500 mb-1">현재 표본 수</p>
                  <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                    {analytics?.impressions.total.toLocaleString() ?? '—'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">목표: 운영팀 확인 필요</p>
                  {analytics && analytics.impressions.total > 0 && (
                    <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-400 transition-all"
                        style={{ width: `${Math.min((analytics.impressions.total / 1000) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs font-semibold text-slate-500 mb-2">분모 기준</p>
                  {analyticsLoading ? (
                    <span className="text-xs text-slate-400">로딩 중...</span>
                  ) : experimentResult?.denominator_source === 'exposure' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle className="h-3.5 w-3.5" />
                      노출 기준 (exp_exposure)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      배정 기준 (폴백)
                    </span>
                  )}
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    {experimentResult?.denominator_source === 'exposure'
                      ? 'exp_exposure 이벤트 기록 유저 기준'
                      : 'exp_exposure 이벤트 없음 — experiment_assignments 기준'}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </section>

      {/* ─────────── P1: Primary (수집된 이벤트가 있을 때만) ─────────── */}
      {showP1 && (
        <section>
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100 mb-3">
            <TrendingUp className="h-4 w-4 text-indigo-500" />
            P1 — Primary 지표
          </h3>
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Conversion rate bar chart */}
            <Card className="lg:col-span-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  전환율 — {convEventLabel}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsLoading ? (
                  <div className="h-44 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-slate-300 animate-spin" />
                  </div>
                ) : convRateData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={convRateData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="variant" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} unit="%" />
                        <Tooltip formatter={(value) => [`${value}%`, '전환율']} />
                        <Bar dataKey="전환율 (%)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      시즌 종료 전 확정 불가
                    </p>
                  </>
                ) : (
                  <div className="h-44 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Clock className="h-6 w-6 opacity-40 animate-spin" />
                    <p className="text-xs">전환 데이터 집계 중...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Statistical significance */}
            <div className="space-y-3">
              <SigCard pValue={analytics?.statistical_significance?.p_value ?? null} />

              {/* Variant distribution breakdown */}
              {hasImpressions && analytics && Object.keys(analytics.impressions.by_variant).length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
                  <p className="text-xs font-semibold text-slate-500 mb-2">배정 분포</p>
                  {Object.entries(analytics.impressions.by_variant).map(([v, cnt], i) => (
                    <div key={v} className="flex items-center justify-between text-xs py-0.5">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: variantColor(v, i) }}
                        />
                        {v}
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {cnt.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ─────────── P2: Guardrail ─────────── */}
      {(showP2 || (experimentResult?.guardrail_results && experimentResult.guardrail_results.length > 0)) && (
        <section>
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100 mb-3">
            <Shield className="h-4 w-4 text-amber-500" />
            P2 — Guardrail
          </h3>

          {/* guardrail_results가 있으면 실제 데이터 패널 표시 */}
          {experimentResult?.guardrail_results && experimentResult.guardrail_results.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {experimentResult.guardrail_results.map(g => (
                <div
                  key={g.metric}
                  className={`rounded-xl border p-4 ${
                    g.deteriorating
                      ? 'border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-800'
                      : 'border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-slate-500 font-mono">{g.metric}</p>
                    {g.deteriorating ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
                        <AlertTriangle className="h-3.5 w-3.5" />악화
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                        <CheckCircle className="h-3.5 w-3.5" />정상
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 text-xs text-slate-600 dark:text-slate-400">
                    <div>
                      <span className="text-slate-400">control</span>
                      <br />
                      <span className="font-bold">{(g.control_rate * 100).toFixed(2)}%</span>
                    </div>
                    {g.treatment_rate !== null && (
                      <div>
                        <span className="text-slate-400">treatment</span>
                        <br />
                        <span className="font-bold">{(g.treatment_rate * 100).toFixed(2)}%</span>
                      </div>
                    )}
                    {g.uplift !== null && (
                      <div>
                        <span className="text-slate-400">Δ</span>
                        <br />
                        <span className={`font-bold ${g.uplift >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {g.uplift > 0 ? '+' : ''}{(g.uplift * 100).toFixed(2)}%p
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* guardrail_results 없으면 수집된 이벤트 목록만 */
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">가드레일 미설정</p>
                <p className="text-xs text-slate-400">
                  실험에 <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">guardrail_metrics</code> 를 설정하면<br />
                  variant별 이상 감지 결과가 여기 표시됩니다.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">수집된 이벤트</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {eventTypes.filter(e => e !== 'impression').map(e => (
                    <span
                      key={e}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ─────────── P3: Supporting (conversion_events 2개 이상일 때만) ─────────── */}
      {showP3 && (
        <section>
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100 mb-3">
            <Layers className="h-4 w-4 text-indigo-400" />
            P3 — Supporting 지표
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Funnel preview */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3">퍼널 차트</p>
              <div className="space-y-1.5">
                {['impression', ...conversionEvents].map((label, idx, arr) => (
                  <div key={label} className="flex items-center gap-2">
                    <div
                      className="h-5 rounded bg-indigo-300 dark:bg-indigo-700 transition-all"
                      style={{ width: `${100 - idx * (60 / arr.length)}%` }}
                    />
                    <span className="text-xs text-slate-500 whitespace-nowrap">{label}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-3">실제 집계 데이터 연동 예정</p>
            </div>

            {/* Event type list */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3">수집된 이벤트 타입</p>
              <div className="flex flex-col gap-1.5">
                {eventTypes.map(e => (
                  <div key={e} className="flex items-center gap-2 text-xs">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="font-mono text-slate-600 dark:text-slate-400">{e}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─────────── P5: 의사결정 로그 ─────────── */}
      <section>
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100 mb-3">
          <ClipboardList className="h-4 w-4 text-indigo-500" />
          P5 — 의사결정 로그
        </h3>
        <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <CardContent className="pt-5 space-y-5">
            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {(['SHIP', 'HOLD', 'ROLLBACK'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => openModal(type)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${DECISION_CONFIG[type].btnClass}`}
                >
                  {DECISION_CONFIG[type].icon}
                  {DECISION_CONFIG[type].label}
                </button>
              ))}
            </div>

            {/* Decision timeline */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">결정 이력</p>
              {decisionsLoading ? (
                <p className="text-xs text-slate-400">불러오는 중...</p>
              ) : decisions.length === 0 ? (
                <p className="text-xs text-slate-400 italic">아직 기록된 결정이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {decisions.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
                    >
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold shrink-0 ${DECISION_CONFIG[d.decision].badgeClass}`}>
                        {d.decision}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 dark:text-slate-300">{d.reason}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {d.decided_by} · {new Date(d.decided_at).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ─────────── Decision Modal ─────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !submitting && setModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-slate-950 shadow-xl border border-slate-200 dark:border-slate-800 p-6">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              disabled={submitting}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
              의사결정 기록
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              선택:{' '}
              <span className={`font-bold ${
                selectedDecision === 'SHIP' ? 'text-emerald-600' :
                selectedDecision === 'HOLD' ? 'text-amber-600' : 'text-rose-600'
              }`}>
                {selectedDecision}
              </span>
            </p>
            <Textarea
              placeholder="결정 이유를 입력하세요..."
              value={decisionReason}
              onChange={(e) => setDecisionReason(e.target.value)}
              rows={4}
              className="mb-3"
            />
            {submitError && (
              <p className="text-xs text-rose-600 mb-2">{submitError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
              >
                취소
              </Button>
              <Button
                onClick={submitDecision}
                disabled={submitting || !decisionReason.trim()}
                className={DECISION_CONFIG[selectedDecision].btnClass}
              >
                {submitting ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

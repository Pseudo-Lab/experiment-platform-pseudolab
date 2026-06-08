import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  AlertTriangle, CheckCircle, Clock, X,
  Ship, Pause, RotateCcw, TrendingUp, Shield,
  Activity, Layers, BarChart2, Lightbulb, ClipboardList,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import {
  experimentAnalyticsApi,
  decisionApi,
  type ExperimentAnalyticsResponse,
  type Decision,
  type Experiment,
  type DecisionType,
} from '../../../services/api';

// ── SDK Required Badge ──────────────────────────────────────────
const SdkRequiredBadge: React.FC = () => (
  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
    SDK 필요
  </span>
);

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
  const [segment, setSegment] = useState<'all' | 'new' | 'returning'>('all');
  const [analytics, setAnalytics] = useState<ExperimentAnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
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

  return (
    <div className="space-y-8">
      {/* ── Guardrail amber banner (SDK 필요 항목이 있어 amber) ── */}
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
          가드레일 지표에 SDK 연동이 필요한 항목이 있습니다. 연동 완료 전까지 배포 판단을 보류하세요.
        </p>
      </div>

      {/* ── Common controls ── */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">세그먼트</span>
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-sm">
          {(['all', 'new', 'returning'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSegment(s)}
              className={`px-3 py-1.5 font-medium transition-colors ${
                segment === s
                  ? 'bg-indigo-500 text-white'
                  : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {{ all: '전체', new: '신규', returning: '재방문' }[s]}
            </button>
          ))}
        </div>
        {segment !== 'all' && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
            <AlertTriangle className="h-3 w-3" />
            세그먼트 필터는 SDK 연동 후 지원됩니다
          </span>
        )}
      </div>

      {/* ─────────── P0: 실험 헬스 ─────────── */}
      <section>
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100 mb-3">
          <Activity className="h-4 w-4 text-indigo-500" />
          P0 — 실험 헬스
        </h3>

        {/* Summary metric cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">총 노출</p>
            <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
              {analyticsLoading ? '—' : (analytics?.impressions.total.toLocaleString() ?? '—')}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">총 전환</p>
            <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
              {analyticsLoading ? '—' : (analytics
                ? Object.values(analytics.conversions.by_variant).reduce((a, b) => a + b, 0).toLocaleString()
                : '—')}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Control 전환율</p>
            <p className="text-2xl font-extrabold text-slate-600 dark:text-slate-300">
              {analyticsLoading ? '—' : analytics
                ? `${((analytics.conversions.rate['control'] ?? 0) * 100).toFixed(2)}%`
                : '—'}
            </p>
          </div>
          <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50 dark:bg-indigo-950/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1">Treatment 전환율</p>
            <p className="text-2xl font-extrabold text-indigo-700 dark:text-indigo-300">
              {analyticsLoading ? '—' : (() => {
                if (!analytics) return '—';
                const treatments = Object.keys(analytics.conversions.rate).filter(v => v !== 'control');
                const key = treatments[0];
                return key ? `${((analytics.conversions.rate[key] ?? 0) * 100).toFixed(2)}%` : '—';
              })()}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Assignment / impression trend */}
          <Card className="lg:col-span-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-700 dark:text-slate-300">
                실시간 노출 추이 (Variant별)
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
                  <BarChart2 className="h-8 w-8 opacity-30" />
                  <p className="text-xs">SDK 이벤트 연동 후 표시됩니다</p>
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
          </div>
        </div>

        {/* URL breakdown table */}
        {!analyticsLoading && analytics && analytics.impressions.total > 0 && (() => {
          const urlRows = Object.entries(analytics.impressions.by_url)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10);
          if (urlRows.length === 0) return null;
          return (
            <Card className="mt-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  URL별 호출 분석
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">URL</TableHead>
                      <TableHead className="text-xs text-right">건수</TableHead>
                      <TableHead className="text-xs text-right">비율</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {urlRows.map(([url, count]) => (
                      <TableRow key={url}>
                        <TableCell className="text-xs font-mono truncate max-w-[260px]">{url}</TableCell>
                        <TableCell className="text-xs text-right">{count.toLocaleString()}</TableCell>
                        <TableCell className="text-xs text-right text-slate-400">
                          {((count / analytics.impressions.total) * 100).toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })()}
      </section>

      {/* ─────────── P1: Primary ─────────── */}
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
                완주율 (Variant별 전환율)
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
                  <BarChart2 className="h-8 w-8 opacity-30" />
                  <p className="text-xs">SDK 이벤트 연동 후 표시됩니다</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* P(T>C) + W11 SDK */}
          <div className="space-y-3">
            <SigCard pValue={analytics?.statistical_significance?.p_value ?? null} />
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">W11 출석 proxy</span>
                <SdkRequiredBadge />
              </div>
              <p className="text-xs text-slate-400">SDK 이벤트 연동 후 표시됩니다</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── P2: Guardrail ─────────── */}
      <section>
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100 mb-3">
          <Shield className="h-4 w-4 text-amber-500" />
          P2 — Guardrail
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">W11 리텐션</span>
              <SdkRequiredBadge />
            </div>
            <p className="text-xs text-slate-400">SDK 이벤트 연동 후 표시됩니다</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">중도 이탈률</span>
              <SdkRequiredBadge />
            </div>
            <p className="text-xs text-slate-400">SDK 이벤트 연동 후 표시됩니다</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">운영 부담</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-400 border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                정의 합의 중
              </span>
            </div>
            <p className="text-xs text-slate-400">지표 정의 확정 후 표시됩니다</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">추가 가드레일</span>
              <SdkRequiredBadge />
            </div>
            <p className="text-xs text-slate-400">SDK 연동 후 추가됩니다</p>
          </div>
        </div>
      </section>

      {/* ─────────── P3: Supporting ─────────── */}
      <section>
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100 mb-3">
          <Layers className="h-4 w-4 text-indigo-400" />
          P3 — Supporting 지표
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Funnel chart (SDK 필요) */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">퍼널 차트</span>
              <SdkRequiredBadge />
            </div>
            <div className="space-y-1.5 opacity-40">
              {[
                { label: '노출', width: '100%' },
                { label: '클릭', width: '65%' },
                { label: '완료', width: '35%' },
              ].map(({ label, width }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="h-5 rounded bg-indigo-200 dark:bg-indigo-800 transition-all" style={{ width }} />
                  <span className="text-xs text-slate-400 whitespace-nowrap">{label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-3">SDK 이벤트 연동 후 표시됩니다</p>
          </div>

          {/* Survival curve (SDK 필요) */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">생존 곡선</span>
              <SdkRequiredBadge />
            </div>
            <div className="h-20 flex items-end gap-1 opacity-40">
              {[100, 82, 68, 58, 51, 46, 42].map((h, i) => (
                <div key={i} className="flex-1 rounded-t bg-slate-300 dark:bg-slate-600" style={{ height: `${h}%` }} />
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-3">SDK 이벤트 연동 후 표시됩니다</p>
          </div>
        </div>
      </section>

      {/* ─────────── P4: Leading ─────────── */}
      <section>
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100 mb-3">
          <Lightbulb className="h-4 w-4 text-slate-400" />
          P4 — Leading 지표
          <span className="text-xs font-normal text-slate-400 ml-1">관측 전용 · 인과 해석 금지</span>
        </h3>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 opacity-70">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <SdkRequiredBadge />
            <span className="text-xs text-slate-400">관측 전용 · 인과 해석 금지</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {['즉시 반응률', '초기 참여율', '빠른 완료 여부'].map((label) => (
              <div key={label} className="rounded-lg bg-slate-100 dark:bg-slate-800 p-3">
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <p className="text-base font-bold text-slate-300 dark:text-slate-600 mt-1">데이터 미적재</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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

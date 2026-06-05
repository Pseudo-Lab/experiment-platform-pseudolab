import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import {
  experimentAnalyticsApi,
  type ExperimentAnalyticsResponse,
} from '../../../services/api';

interface ExperimentAnalyticsProps {
  experimentId: string;
  lang: 'en' | 'ko';
}

const t = {
  en: {
    loading: 'Loading analytics...',
    error: 'Failed to load analytics.',
    totalImpressions: 'Total Impressions',
    conversionRateControl: 'Control Conv. Rate',
    conversionRateTreatment: 'Treatment Conv. Rate',
    significance: 'Statistical Significance',
    significant: 'Statistically significant ✓',
    borderline: 'Borderline',
    insufficient: 'Insufficient data',
    winner: 'Winner',
    pValue: 'p-value',
    variantDistribution: 'Impression Distribution by Variant',
    impressionTrend: 'Impression Trend Over Time',
    urlBreakdown: 'URL Breakdown',
    urlCol: 'URL',
    countCol: 'Count',
    pctCol: '%',
    anomalyTitle: 'Anomaly Detection',
    noAnomalies: 'No anomalies detected.',
    noData: 'No impression data yet.',
    variant: 'Variant',
    impressions: 'Impressions',
    conversions: 'Conversions',
    rate: 'Conv. Rate',
  },
  ko: {
    loading: 'Analytics 불러오는 중...',
    error: 'Analytics를 불러오지 못했습니다.',
    totalImpressions: '총 노출',
    conversionRateControl: 'Control 전환율',
    conversionRateTreatment: 'Treatment 전환율',
    significance: '통계적 유의성',
    significant: '통계적으로 유의함 ✓',
    borderline: '경계 수준',
    insufficient: '아직 데이터 부족',
    winner: '우승 variant',
    pValue: 'p-value',
    variantDistribution: 'Variant별 노출 분포',
    impressionTrend: '시간대별 노출 추이',
    urlBreakdown: 'URL별 호출 분석',
    urlCol: 'URL',
    countCol: '건수',
    pctCol: '비율',
    anomalyTitle: '이상 감지',
    noAnomalies: '이상 징후가 없습니다.',
    noData: '아직 노출 데이터가 없습니다.',
    variant: 'Variant',
    impressions: '노출 수',
    conversions: '전환 수',
    rate: '전환율',
  },
};

const VARIANT_COLORS: Record<string, string> = {
  control: '#94a3b8',
  treatment: '#6366f1',
};

function variantColor(variant: string): string {
  return VARIANT_COLORS[variant] ?? '#f59e0b';
}

function significanceBadge(pValue: number | null, lang: 'en' | 'ko') {
  const labels = t[lang];
  if (pValue === null) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <Clock className="h-3.5 w-3.5" />
        {labels.insufficient}
      </span>
    );
  }
  if (pValue < 0.05) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
        <CheckCircle className="h-3.5 w-3.5" />
        {labels.significant} (p={pValue.toFixed(4)})
      </span>
    );
  }
  if (pValue < 0.1) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
        <AlertTriangle className="h-3.5 w-3.5" />
        {labels.borderline} (p={pValue.toFixed(4)})
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
      <Clock className="h-3.5 w-3.5" />
      {labels.insufficient} (p={pValue.toFixed(4)})
    </span>
  );
}

export const ExperimentAnalytics: React.FC<ExperimentAnalyticsProps> = ({ experimentId, lang }) => {
  const labels = t[lang];
  const [data, setData] = useState<ExperimentAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    experimentAnalyticsApi.get(experimentId)
      .then(setData)
      .catch(() => setError(labels.error))
      .finally(() => setLoading(false));
  }, [experimentId]);

  if (loading) return <p className="text-sm text-slate-400 p-4">{labels.loading}</p>;
  if (error) return <p className="text-sm text-rose-500 p-4">{error}</p>;
  if (!data) return null;

  const { impressions, conversions, statistical_significance: sig, anomalies } = data;

  const controlRate = conversions.rate['control'] ?? 0;
  const treatments = Object.keys(impressions.by_variant).filter((v) => v !== 'control');
  const primaryTreatment = treatments[0] ?? 'treatment';
  const treatmentRate = conversions.rate[primaryTreatment] ?? 0;

  const variantBarData = Object.entries(impressions.by_variant).map(([variant, count]) => ({
    variant,
    [labels.impressions]: count,
    [labels.conversions]: conversions.by_variant[variant] ?? 0,
  }));

  const urlRows = Object.entries(impressions.by_url)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Anomaly warnings */}
      {anomalies.length > 0 && (
        <div className="space-y-2">
          {anomalies.map((a, i) => (
            <div key={i} className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-amber-700 dark:text-amber-300 text-sm border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span><strong>{a.variant}</strong>: {a.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Top metric cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">{labels.totalImpressions}</p>
          <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{impressions.total.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">{labels.conversionRateControl}</p>
          <p className="text-2xl font-extrabold text-slate-600 dark:text-slate-300">{(controlRate * 100).toFixed(2)}%</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-indigo-50 dark:bg-indigo-950/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1">{labels.conversionRateTreatment}</p>
          <p className="text-2xl font-extrabold text-indigo-700 dark:text-indigo-300">{(treatmentRate * 100).toFixed(2)}%</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">{labels.significance}</p>
          <div className="mt-1">{significanceBadge(sig.p_value, lang)}</div>
          {sig.winner && (
            <p className="mt-1.5 text-xs text-slate-500">
              {labels.winner}: <span className="font-bold text-emerald-600 dark:text-emerald-400">{sig.winner}</span>
            </p>
          )}
        </div>
      </div>

      {impressions.total === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">{labels.noData}</p>
      ) : (
        <>
          {/* Variant distribution bar chart */}
          <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <TrendingUp className="h-4 w-4 text-indigo-500" />
                {labels.variantDistribution}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={variantBarData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="variant" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey={labels.impressions} fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={labels.conversions} fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Time series line chart */}
            <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">{labels.impressionTrend}</CardTitle>
              </CardHeader>
              <CardContent>
                {impressions.time_series.length > 1 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={impressions.time_series} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-6">{labels.insufficient}</p>
                )}
              </CardContent>
            </Card>

            {/* URL breakdown table */}
            <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">{labels.urlBreakdown}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">{labels.urlCol}</TableHead>
                      <TableHead className="text-xs text-right">{labels.countCol}</TableHead>
                      <TableHead className="text-xs text-right">{labels.pctCol}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {urlRows.map(([url, count]) => (
                      <TableRow key={url}>
                        <TableCell className="text-xs font-mono truncate max-w-[160px]">{url}</TableCell>
                        <TableCell className="text-xs text-right">{count.toLocaleString()}</TableCell>
                        <TableCell className="text-xs text-right text-slate-400">
                          {impressions.total > 0 ? ((count / impressions.total) * 100).toFixed(1) : '0'}%
                        </TableCell>
                      </TableRow>
                    ))}
                    {urlRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-xs text-slate-400 text-center">-</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

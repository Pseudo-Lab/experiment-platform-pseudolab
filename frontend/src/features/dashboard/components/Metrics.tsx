import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BarChart3, Plus, RefreshCcw } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { experimentApi, type Experiment } from '@/services/api';

interface MetricsProps {
  lang: 'en' | 'ko';
}

type StatusKey = 'active' | 'draft' | 'completed';

const translations = {
  en: {
    title: 'Metrics',
    description: 'Data-driven metrics and charts based on experiment records.',
    newMetric: 'Define Metric',
    chartCreation: 'Experiment Creation Trend (7d)',
    chartCreationDesc: 'How many experiments were created per day in the last 7 days.',
    chartStatus: 'Experiment Status Distribution',
    chartStatusDesc: 'Current status count across all tracked experiments.',
    definedMetrics: 'Derived Metrics',
    errorTitle: 'Failed to load metrics data',
    errorSub: 'Please check network/API status and retry.',
    retry: 'Retry',
    noData: 'No experiment data found',
    noDataSub: 'Create experiments first to visualize metrics.',
    statusActive: 'Active',
    statusDraft: 'Draft',
    statusCompleted: 'Completed',
    totalExperiments: 'Total Experiments',
    activeRate: 'Active Rate',
    completionRate: 'Completion Rate',
    latestCreatedAt: 'Latest Created Date',
    unitPercent: '%',
    unitCount: 'count',
    unitDate: 'date',
  },
  ko: {
    title: '지표 설정',
    description: '실험 데이터 기반 지표와 그래프를 확인하세요.',
    newMetric: '새 메트릭 정의',
    chartCreation: '실험 생성 추이 (7일)',
    chartCreationDesc: '최근 7일간 일자별 실험 생성 건수입니다.',
    chartStatus: '실험 상태 분포',
    chartStatusDesc: '전체 실험의 현재 상태별 건수입니다.',
    definedMetrics: '파생 지표',
    errorTitle: '지표 데이터를 불러오지 못했습니다',
    errorSub: '네트워크/API 상태를 확인한 후 다시 시도해주세요.',
    retry: '다시 시도',
    noData: '실험 데이터가 없습니다',
    noDataSub: '실험을 생성하면 지표 그래프를 확인할 수 있습니다.',
    statusActive: '활성',
    statusDraft: '초안',
    statusCompleted: '완료',
    totalExperiments: '총 실험 수',
    activeRate: '활성 비율',
    completionRate: '완료 비율',
    latestCreatedAt: '최근 생성일',
    unitPercent: '%',
    unitCount: '건',
    unitDate: '일자',
  },
} as const;

const formatDate = (value: string) => value.slice(0, 10);

export const Metrics: React.FC<MetricsProps> = ({ lang }) => {
  const t = translations[lang];
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetricsData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await experimentApi.list();
      setExperiments(data);
    } catch (err) {
      console.error(err);
      setError(t.errorTitle);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchMetricsData();
  }, []);

  const statusMap = useMemo(() => ({
    active: t.statusActive,
    draft: t.statusDraft,
    completed: t.statusCompleted,
  }), [t.statusActive, t.statusDraft, t.statusCompleted]);

  const creationTrendData = useMemo(() => {
    const today = new Date();
    const buckets = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - idx));
      return {
        key: d.toISOString().slice(0, 10),
        date: d.toISOString().slice(5, 10),
        count: 0,
      };
    });

    for (const experiment of experiments) {
      const createdDay = experiment.created_at?.slice(0, 10);
      const bucket = buckets.find((item) => item.key === createdDay);
      if (bucket) bucket.count += 1;
    }

    return buckets.map(({ date, count }) => ({ date, count }));
  }, [experiments]);

  const statusDistributionData = useMemo(() => {
    const baseCount: Record<StatusKey, number> = {
      active: 0,
      draft: 0,
      completed: 0,
    };

    for (const experiment of experiments) {
      if (experiment.status in baseCount) {
        baseCount[experiment.status as StatusKey] += 1;
      }
    }

    return (Object.keys(baseCount) as StatusKey[]).map((key) => ({
      status: statusMap[key],
      count: baseCount[key],
    }));
  }, [experiments, statusMap]);

  const derivedMetrics = useMemo(() => {
    const total = experiments.length;
    const activeCount = experiments.filter((item) => item.status === 'active').length;
    const completedCount = experiments.filter((item) => item.status === 'completed').length;

    const activeRate = total === 0 ? 0 : Math.round((activeCount / total) * 100);
    const completionRate = total === 0 ? 0 : Math.round((completedCount / total) * 100);

    const latestExperiment = [...experiments]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    return [
      {
        id: 'total',
        label: t.totalExperiments,
        value: String(total),
        unit: t.unitCount,
      },
      {
        id: 'active_rate',
        label: t.activeRate,
        value: String(activeRate),
        unit: t.unitPercent,
      },
      {
        id: 'completion_rate',
        label: t.completionRate,
        value: String(completionRate),
        unit: t.unitPercent,
      },
      {
        id: 'latest_created_at',
        label: t.latestCreatedAt,
        value: latestExperiment ? formatDate(latestExperiment.created_at) : '-',
        unit: t.unitDate,
      },
    ];
  }, [experiments, t.totalExperiments, t.activeRate, t.completionRate, t.latestCreatedAt, t.unitCount, t.unitPercent, t.unitDate]);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{t.title}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{t.description}</p>
        </div>
        <Button className="gap-2 rounded-xl shadow-lg" size="lg">
          <Plus size={18} />
          {t.newMetric}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4" aria-live="polite" aria-busy="true">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <div role="progressbar" className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600" />
            {t.definedMetrics}
          </div>
        </div>
      ) : error ? (
        <Card className="rounded-2xl border-rose-200 dark:border-rose-900/50">
          <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3" role="alert">
              <AlertCircle className="text-rose-500 mt-0.5" size={18} />
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{t.errorTitle}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t.errorSub}</p>
              </div>
            </div>
            <Button variant="outline" className="gap-2" onClick={() => void fetchMetricsData()}>
              <RefreshCcw size={16} />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : experiments.length === 0 ? (
        <div className="p-8 border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center text-center py-20">
          <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm flex items-center justify-center mb-4">
            <BarChart3 className="text-indigo-600 dark:text-indigo-400" size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t.noData}</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-xs mt-2">{t.noDataSub}</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 px-1">{t.definedMetrics}</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {derivedMetrics.map((metric) => (
                <Card key={metric.id} className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm text-slate-500 dark:text-slate-400">{metric.label}</p>
                        <div className="mt-2 flex items-baseline gap-2">
                          <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{metric.value}</p>
                          <Badge variant="outline" className="text-xs">{metric.unit}</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-200">{t.chartCreation}</CardTitle>
                <CardDescription className="text-slate-500">{t.chartCreationDesc}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={creationTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} stroke="currentColor" className="text-slate-400" />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} stroke="currentColor" className="text-slate-400" allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-200">{t.chartStatus}</CardTitle>
                <CardDescription className="text-slate-500">{t.chartStatusDesc}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
                      <XAxis dataKey="status" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} stroke="currentColor" className="text-slate-400" />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} stroke="currentColor" className="text-slate-400" allowDecimals={false} />
                      <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

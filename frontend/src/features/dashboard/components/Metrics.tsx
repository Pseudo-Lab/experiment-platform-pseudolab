import React from 'react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { Plus, TrendingUp, TrendingDown } from 'lucide-react';

interface MetricsProps {
  lang: 'en' | 'ko';
}

const conversionData = [
  { name: '1주차', value: 42 },
  { name: '2주차', value: 45 },
  { name: '3주차', value: 48 },
  { name: '4주차', value: 52 },
  { name: '5주차', value: 49 },
  { name: '6주차', value: 55 },
];

const retentionData = [
  { day: 'D1', rate: 78 },
  { day: 'D3', rate: 62 },
  { day: 'D7', rate: 45 },
  { day: 'D14', rate: 38 },
  { day: 'D30', rate: 28 },
];

interface Metric {
  id: string;
  name: string;
  description: string;
  type: 'conversion' | 'retention' | 'engagement' | 'revenue';
  value: number;
  unit: string;
  change: number;
  experiments: number;
}

const metricsList: Metric[] = [
  {
    id: "1",
    name: "가입 완료율",
    description: "Discord 서버 가입 후 인증 완료까지의 비율",
    type: "conversion",
    value: 68.5,
    unit: "%",
    change: 5.2,
    experiments: 3,
  },
  {
    id: "2",
    name: "일일 활성 사용자",
    description: "하루 동안 최소 1개 이상의 활동을 한 사용자 수",
    type: "engagement",
    value: 486,
    unit: "명",
    change: 12.1,
    experiments: 2,
  },
  {
    id: "3",
    name: "7일 리텐션",
    description: "첫 가입 후 7일 뒤 재방문한 사용자 비율",
    type: "retention",
    value: 45.3,
    unit: "%",
    change: -2.4,
    experiments: 1,
  },
  {
    id: "4",
    name: "채널 참여율",
    description: "특정 채널에서 메시지를 작성한 사용자 비율",
    type: "engagement",
    value: 32.8,
    unit: "%",
    change: 8.7,
    experiments: 2,
  },
];

export const Metrics: React.FC<MetricsProps> = ({ lang }) => {
  const translations = {
    en: {
      title: "Metrics",
      description: "Define and track key metrics for experiment valuation.",
      newMetric: "Define Metric",
      chartConversion: "Weekly Conversion Trend",
      chartConversionDesc: "Sign-up completion rate over time",
      chartRetention: "Retention Curve",
      chartRetentionDesc: "Daily return rate after sign-up",
      definedMetrics: "Defined Metrics",
      experimentsUsing: "experiments using this",
      noExperiments: "Not used in any experiments",
      typeConversion: "Conversion",
      typeRetention: "Retention",
      typeEngagement: "Engagement",
      typeRevenue: "Revenue"
    },
    ko: {
      title: "지표 설정",
      description: "실험 성과를 측정하기 위한 핵심 지표를 정의하고 추적하세요.",
      newMetric: "새 메트릭 정의",
      chartConversion: "주간 전환율 추이",
      chartConversionDesc: "가입 완료율 변화",
      chartRetention: "리텐션 곡선",
      chartRetentionDesc: "가입 후 일별 재방문율",
      definedMetrics: "정의된 메트릭",
      experimentsUsing: "개 실험에서 사용 중",
      noExperiments: "사용 중인 실험 없음",
      typeConversion: "전환",
      typeRetention: "리텐션",
      typeEngagement: "참여",
      typeRevenue: "수익"
    }
  };

  const t = translations[lang];

  const typeConfig = {
    conversion: { label: t.typeConversion, color: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" },
    retention: { label: t.typeRetention, color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
    engagement: { label: t.typeEngagement, color: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
    revenue: { label: t.typeRevenue, color: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  };

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-200">{t.chartConversion}</CardTitle>
            <CardDescription className="text-slate-500">{t.chartConversionDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conversionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} stroke="currentColor" className="text-slate-400" />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={(val) => `${val}%`} stroke="currentColor" className="text-slate-400" />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-200">{t.chartRetention}</CardTitle>
            <CardDescription className="text-slate-500">{t.chartRetentionDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={retentionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} stroke="currentColor" className="text-slate-400" />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={(val) => `${val}%`} stroke="currentColor" className="text-slate-400" />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={3} dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 px-1">{t.definedMetrics}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {metricsList.map((metric) => (
            <Card key={metric.id} className="rounded-2xl border-slate-200 dark:border-slate-800 hover:shadow-md transition-all group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{metric.name}</h4>
                      <Badge variant="secondary" className={`text-[10px] uppercase font-bold px-2 py-0.5 ${typeConfig[metric.type].color}`}>
                        {typeConfig[metric.type].label}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                      {metric.description}
                    </p>
                    <div className="mt-4 text-xs font-medium text-slate-400 dark:text-slate-500">
                      {metric.experiments > 0
                        ? `${metric.experiments}${t.experimentsUsing}`
                        : t.noExperiments}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="flex items-baseline justify-end gap-1">
                      <span className="text-3xl font-black text-slate-800 dark:text-slate-100">{metric.value}</span>
                      <span className="text-sm font-bold text-slate-400">{metric.unit}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-end gap-1">
                      {metric.change > 0 ? (
                        <div className="flex items-center text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg">
                          <TrendingUp className="h-3.5 w-3.5 mr-1" />
                          <span className="text-xs font-bold">+{metric.change}%</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded-lg">
                          <TrendingDown className="h-3.5 w-3.5 mr-1" />
                          <span className="text-xs font-bold">{metric.change}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

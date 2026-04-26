import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { analyticsApi, type TrendPoint, type FunnelStep, type RetentionCell } from '../../../services/api';

interface Props { lang: 'en' | 'ko'; }

const tr = {
  ko: {
    title: 'Analytics',
    tabTrends: '트렌드', tabFunnels: '퍼널', tabRetention: '리텐션',
    eventName: '이벤트 이름', granularity: '단위',
    day: '일', week: '주',
    from: '시작일', to: '종료일',
    load: '조회', loading: '조회 중...',
    noData: '데이터가 없습니다.',
    funnelSteps: '퍼널 단계 (줄마다 이벤트명)',
    funnelRun: '퍼널 실행',
    colStep: '단계', colUsers: '사용자', colRate: '전환율',
    colCohort: '코호트 주차', colWeek: 'N주차', colRetained: '잔존', colRate2: '잔존율',
    selectEvent: '이벤트 선택',
  },
  en: {
    title: 'Analytics',
    tabTrends: 'Trends', tabFunnels: 'Funnels', tabRetention: 'Retention',
    eventName: 'Event Name', granularity: 'Granularity',
    day: 'Day', week: 'Week',
    from: 'From', to: 'To',
    load: 'Load', loading: 'Loading...',
    noData: 'No data.',
    funnelSteps: 'Funnel steps (one event per line)',
    funnelRun: 'Run Funnel',
    colStep: 'Step', colUsers: 'Users', colRate: 'Conv. Rate',
    colCohort: 'Cohort Week', colWeek: 'Week #', colRetained: 'Retained', colRate2: 'Retention',
    selectEvent: 'Select event',
  },
};

type Tab = 'trends' | 'funnels' | 'retention';

const today = new Date().toISOString().slice(0, 10);
const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);

export const Analytics: React.FC<Props> = ({ lang }) => {
  const t = tr[lang];
  const [tab, setTab] = useState<Tab>('trends');
  const [eventNames, setEventNames] = useState<string[]>([]);

  // Trends state
  const [trendEvent, setTrendEvent] = useState('');
  const [trendFrom, setTrendFrom] = useState(weekAgo);
  const [trendTo, setTrendTo] = useState(today);
  const [trendGranularity, setTrendGranularity] = useState<'day' | 'week'>('day');
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  // Funnel state
  const [funnelStepsText, setFunnelStepsText] = useState('');
  const [funnelData, setFunnelData] = useState<FunnelStep[]>([]);
  const [funnelLoading, setFunnelLoading] = useState(false);

  // Retention state
  const [retentionEvent, setRetentionEvent] = useState('');
  const [retentionData, setRetentionData] = useState<RetentionCell[]>([]);
  const [retentionLoading, setRetentionLoading] = useState(false);

  useEffect(() => {
    analyticsApi.getEventNames().then(setEventNames).catch(() => {});
  }, []);

  const loadTrends = async () => {
    if (!trendEvent) return;
    setTrendLoading(true);
    try {
      const res = await analyticsApi.getTrends(trendEvent, `${trendFrom}T00:00:00`, `${trendTo}T23:59:59`, trendGranularity);
      setTrendData(res.data);
    } finally { setTrendLoading(false); }
  };

  const loadFunnels = async () => {
    const steps = funnelStepsText.split('\n').map(s => s.trim()).filter(Boolean);
    if (steps.length < 2) return;
    setFunnelLoading(true);
    try {
      const res = await analyticsApi.getFunnels(steps);
      setFunnelData(res.steps);
    } finally { setFunnelLoading(false); }
  };

  const loadRetention = async () => {
    if (!retentionEvent) return;
    setRetentionLoading(true);
    try {
      const res = await analyticsApi.getRetention(retentionEvent);
      setRetentionData(res.data);
    } finally { setRetentionLoading(false); }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'trends', label: t.tabTrends },
    { key: 'funnels', label: t.tabFunnels },
    { key: 'retention', label: t.tabRetention },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{t.title}</h1>

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === key ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Trends ── */}
      {tab === 'trends' && (
        <Card className="rounded-2xl border border-slate-200 dark:border-slate-800">
          <CardHeader><CardTitle className="text-base font-bold">{t.tabTrends}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs text-slate-500">{t.eventName}</label>
                <Select value={trendEvent} onValueChange={setTrendEvent}>
                  <SelectTrigger className="w-44 rounded-xl"><SelectValue placeholder={t.selectEvent} /></SelectTrigger>
                  <SelectContent>{eventNames.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">{t.from}</label>
                <input type="date" value={trendFrom} onChange={e => setTrendFrom(e.target.value)} className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-900" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">{t.to}</label>
                <input type="date" value={trendTo} onChange={e => setTrendTo(e.target.value)} className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-900" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">{t.granularity}</label>
                <Select value={trendGranularity} onValueChange={v => setTrendGranularity(v as 'day' | 'week')}>
                  <SelectTrigger className="w-24 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">{t.day}</SelectItem>
                    <SelectItem value="week">{t.week}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="rounded-xl" onClick={loadTrends} disabled={trendLoading || !trendEvent}>
                {trendLoading ? t.loading : t.load}
              </Button>
            </div>
            {trendData.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">{t.noData}</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Funnels ── */}
      {tab === 'funnels' && (
        <Card className="rounded-2xl border border-slate-200 dark:border-slate-800">
          <CardHeader><CardTitle className="text-base font-bold">{t.tabFunnels}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-slate-500">{t.funnelSteps}</label>
              <textarea value={funnelStepsText} onChange={e => setFunnelStepsText(e.target.value)}
                rows={4} placeholder={'weekly_session_attended\ndeliverable_submitted'}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 resize-none" />
              <Button className="rounded-xl" onClick={loadFunnels} disabled={funnelLoading}>
                {funnelLoading ? t.loading : t.funnelRun}
              </Button>
            </div>
            {funnelData.length > 0 && (
              <div className="space-y-2">
                {funnelData.map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-500 w-48 truncate">{step.step}</span>
                    <div className="flex-1 h-7 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-lg transition-all"
                        style={{ width: `${i === 0 ? 100 : ((step.conversion_rate ?? 0) * 100)}%` }} />
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 w-16 text-right">
                      {step.users.toLocaleString()}
                    </span>
                    {step.conversion_rate != null && (
                      <span className="text-xs text-slate-400 w-12 text-right">{(step.conversion_rate * 100).toFixed(1)}%</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {funnelData.length === 0 && <p className="text-sm text-slate-400">{t.noData}</p>}
          </CardContent>
        </Card>
      )}

      {/* ── Retention ── */}
      {tab === 'retention' && (
        <Card className="rounded-2xl border border-slate-200 dark:border-slate-800">
          <CardHeader><CardTitle className="text-base font-bold">{t.tabRetention}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs text-slate-500">{t.eventName}</label>
                <Select value={retentionEvent} onValueChange={setRetentionEvent}>
                  <SelectTrigger className="w-44 rounded-xl"><SelectValue placeholder={t.selectEvent} /></SelectTrigger>
                  <SelectContent>{eventNames.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button className="rounded-xl" onClick={loadRetention} disabled={retentionLoading || !retentionEvent}>
                {retentionLoading ? t.loading : t.load}
              </Button>
            </div>
            {retentionData.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">{t.noData}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800">
                      <th className="px-3 py-2 text-left font-bold text-slate-500">{t.colCohort}</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500">{t.colWeek}</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500">{t.colRetained}</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500">{t.colRate2}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retentionData.map((cell, i) => (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400">{cell.cohort_week}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">W{cell.week_num}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{cell.retained}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${cell.retention_rate * 100}%` }} />
                            </div>
                            <span className="font-bold text-slate-700 dark:text-slate-300">{(cell.retention_rate * 100).toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

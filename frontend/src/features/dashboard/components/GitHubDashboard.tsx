import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { dashboardApi } from '@/services/dashboardApi';
import type { GitHubOverviewResponse } from '@/features/dashboard/types/metrics';

interface GitHubDashboardProps {
  lang: 'en' | 'ko';
}

export const GitHubDashboard: React.FC<GitHubDashboardProps> = ({ lang }) => {
  const [windowSize, setWindowSize] = useState<'7d' | '30d'>('7d');
  const [data, setData] = useState<GitHubOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openHint, setOpenHint] = useState<string | null>(null);

  const t = {
    en: {
      title: 'GitHub Dashboard',
      loading: 'Loading GitHub metrics...',
      retry: 'Retry',
      empty: 'No GitHub activity data in this window.',
      error: 'Failed to load GitHub metrics.',
      totalCoreEvents: 'Total Core Events',
      pushEvents: 'Push Events',
      prOpenedMerged: 'PR Opened / Merged',
      mergeRate: 'Merge Rate',
      topRepositories: 'Top Repositories',
      repoShare: 'Activity share by repository',
      guide: 'GitHub dashboard shows engineering activity from push, PR, issue-comment, and review events. Merge rate uses merged/opened PR ratio in the selected window.',
      period7d: 'Period: last 7 days (Asia/Seoul)',
      period30d: 'Period: last 30 days (Asia/Seoul)',
      window7d: '7 days',
      window30d: '30 days',
      descTotalCoreEvents: 'Total count of push, PR, review, and issue-comment events in the selected window.',
      descPushEvents: 'Number of push events in the selected window.',
      descPrOpenedMerged: 'Count of opened and merged PRs in the selected window.',
      descMergeRate: 'Merged PR ratio against opened PRs in the selected window.',
    },
    ko: {
      title: 'GitHub 상세',
      loading: 'GitHub 지표를 불러오는 중...',
      retry: '다시 시도',
      empty: '조회 기간에 GitHub 활동 데이터가 없습니다.',
      error: 'GitHub 지표를 불러오지 못했습니다.',
      totalCoreEvents: '핵심 이벤트 수',
      pushEvents: '푸시 이벤트',
      prOpenedMerged: 'PR 오픈 / 머지',
      mergeRate: '머지율',
      topRepositories: '상위 저장소',
      repoShare: '저장소별 활동 비중',
      guide: 'GitHub 대시보드는 push/PR/이슈 코멘트/review 이벤트를 기준으로 개발 활동량을 보여줍니다. 머지율은 기간 내 PR opened 대비 merged 비율입니다.',
      period7d: '기간: 최근 7일 (Asia/Seoul)',
      period30d: '기간: 최근 30일 (Asia/Seoul)',
      window7d: '7일',
      window30d: '30일',
      descTotalCoreEvents: 'push, PR, review, issue-comment 핵심 이벤트 총합',
      descPushEvents: 'push 이벤트 수',
      descPrOpenedMerged: 'opened PR / merged PR 건수',
      descMergeRate: 'opened 대비 merged PR 비율',
    },
  }[lang];

  const load = async (windowArg: '7d' | '30d' = windowSize) => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await dashboardApi.githubOverview(windowArg));
    } catch {
      setError('github_fetch_failed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load(windowSize);
  }, [windowSize]);

  const isEmpty = useMemo(() => {
    if (!data) return false;
    return data.summary.total_core_events === 0 && data.top_repos.length === 0;
  }, [data]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-tooltip-root="github-kpi"]')) return;
      setOpenHint(null);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const infoLabel = (key: string, label: string, tooltip: string) => (
    <span data-tooltip-root="github-kpi" className="relative inline-flex items-center gap-1 group">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => setOpenHint(openHint === key ? null : key)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500 cursor-help"
        aria-label={`${label} description`}
        aria-expanded={openHint === key}
      >
        ?
      </button>

      <span className="pointer-events-none absolute left-0 top-6 z-20 hidden min-w-[180px] w-max max-w-[280px] break-keep whitespace-normal rounded-md border border-slate-200 bg-white p-2 text-[11px] leading-relaxed text-slate-700 shadow-lg sm:group-hover:block dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        {tooltip}
      </span>

      {openHint === key ? (
        <span className="absolute left-0 top-6 z-20 min-w-[180px] w-max max-w-[280px] break-keep whitespace-normal rounded-md border border-slate-200 bg-white p-2 text-[11px] leading-relaxed text-slate-700 shadow-lg sm:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {tooltip}
        </span>
      ) : null}
    </span>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <Card>
        <CardContent className="p-4 pt-4 text-sm text-slate-600 dark:text-slate-300 space-y-2">
          <div>{t.guide}</div>
          <div className="text-xs text-slate-400">{windowSize === '7d' ? t.period7d : t.period30d}</div>
          <div className="inline-flex w-fit items-center gap-1 rounded-xl border bg-slate-50 p-1 dark:bg-slate-900">
            <Button size="sm" variant={windowSize === '7d' ? 'default' : 'ghost'} onClick={() => setWindowSize('7d')}>{t.window7d}</Button>
            <Button size="sm" variant={windowSize === '30d' ? 'default' : 'ghost'} onClick={() => setWindowSize('30d')}>{t.window30d}</Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? <div role="progressbar" aria-busy="true" className="text-sm text-slate-500">{t.loading}</div> : null}

      {!isLoading && error ? (
        <Card className="rounded-2xl border-rose-200 dark:border-rose-900/50">
          <CardContent className="p-6 flex items-center justify-between">
            <div role="alert" className="flex items-center gap-2"><AlertCircle size={16} /> {t.error}</div>
            <Button variant="outline" onClick={() => void load()} className="gap-2"><RefreshCcw size={16} />{t.retry}</Button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !error && data && isEmpty ? (
        <Card><CardContent className="p-6 text-sm text-slate-500">{t.empty}</CardContent></Card>
      ) : null}

      {!isLoading && !error && data && !isEmpty ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card><CardHeader><CardDescription>{infoLabel('total-core-events', t.totalCoreEvents, t.descTotalCoreEvents)}</CardDescription><CardTitle>{data.summary.total_core_events}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardDescription>{infoLabel('push-events', t.pushEvents, t.descPushEvents)}</CardDescription><CardTitle>{data.summary.push_events}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardDescription>{infoLabel('pr-opened-merged', t.prOpenedMerged, t.descPrOpenedMerged)}</CardDescription><CardTitle>{data.summary.pr_opened} / {data.summary.pr_merged}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardDescription>{infoLabel('merge-rate', t.mergeRate, t.descMergeRate)}</CardDescription><CardTitle>{data.summary.merge_rate_28d === null ? '-' : `${(data.summary.merge_rate_28d * 100).toFixed(1)}%`}</CardTitle></CardHeader></Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t.topRepositories}</CardTitle>
              <CardDescription>{t.repoShare}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.top_repos.map((repo) => (
                  <div key={repo.repo_name} className="flex items-center justify-between text-sm">
                    <span>{repo.repo_name}</span>
                    <span className="text-slate-500">{repo.events} ({(repo.ratio * 100).toFixed(1)}%)</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
};

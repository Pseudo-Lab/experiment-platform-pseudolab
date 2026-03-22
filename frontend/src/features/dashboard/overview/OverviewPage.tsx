import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronRight, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { dashboardApi } from '@/services/dashboardApi';
import type { DashboardLang, DashboardOverviewResponse } from '@/features/dashboard/types/overview';
import { KpiStrip } from '@/features/dashboard/overview/KpiStrip';
import { TrendCompositeChart } from '@/features/dashboard/overview/TrendCompositeChart';
import { HealthCards } from '@/features/dashboard/overview/HealthCards';
import { TopRepoTable } from '@/features/dashboard/overview/TopRepoTable';
import { AlertList } from '@/features/dashboard/overview/AlertList';

export const OverviewPage = ({ lang }: { lang: DashboardLang }) => {
  const navigate = useNavigate();
  const [windowSize, setWindowSize] = useState<'7d' | '30d'>('7d');
  const [data, setData] = useState<DashboardOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const texts = {
    en: {
      title: 'Overview Dashboard',
      sub: 'A quick board showing what data exists and how active the lab has been recently.',
      retry: 'Retry',
      openGitHub: 'Open GitHub analytics',
      openDiscord: 'Open Discord analytics',
      period7d: 'Selected period: last 7 days (Asia/Seoul)',
      period30d: 'Selected period: last 30 days (Asia/Seoul)',
      window7d: '7 days',
      window30d: '30 days',
      windowLabel: 'Window',
      loading: 'Loading overview data...',
      error: 'Failed to load overview data.',
      summaryActiveProjects: 'Active Projects',
      summaryContributors: 'Active Contributors',
      summaryCollabEvents: 'Collaboration Events',
      summaryMergeRate: 'PR Merge Rate',
      summaryPipelineFreshness: 'Pipeline Freshness',
      trendTitle7d: 'Trend Panel (7d)',
      trendTitle30d: 'Trend Panel (30d)',
      trendDescription: 'Core activity / communication / merge rate',
      guide7d: 'This page summarizes the last 7 days: project activity, collaboration events, data freshness, and repository concentration. Use these cards as a quick reliability check before deep analysis.',
      guide30d: 'This page summarizes the last 30 days: project activity, collaboration events, data freshness, and repository concentration. Use these cards as a quick reliability check before deep analysis.',
      healthCoverage: 'Coverage',
      healthMissingDayRatio: 'Missing Day Ratio (30d)',
      healthSchemaViolations: 'Schema Violations',
      topRepoTitle: 'Top Repositories',
      topRepoConcentration: 'Top3 concentration',
      topRepoEmpty: 'No repository activity data.',
      alertTitle: 'Action Queue',
      alertEmpty: 'No active alerts.',
      empty: 'No overview data for this window.',
    },
    ko: {
      title: '전체 현황판',
      sub: '보유 데이터 규모와 최근 활동 흐름을 한 번에 확인하는 요약 화면입니다.',
      retry: '다시 시도',
      openGitHub: 'GitHub 활동 분석 열기',
      openDiscord: 'Discord 활동 분석 열기',
      period7d: '선택 기간: 최근 7일 (Asia/Seoul)',
      period30d: '선택 기간: 최근 30일 (Asia/Seoul)',
      window7d: '7일',
      window30d: '30일',
      loading: '현황 데이터를 불러오는 중...',
      error: '현황 데이터를 불러오지 못했습니다.',
      summaryActiveProjects: '활성 프로젝트',
      summaryContributors: '활성 기여자',
      summaryCollabEvents: '협업 이벤트',
      summaryMergeRate: 'PR 머지율',
      summaryPipelineFreshness: '파이프라인 최신성',
      trendTitle7d: '추세 패널 (7일)',
      trendTitle30d: '추세 패널 (30일)',
      trendDescription: '핵심 활동 / 커뮤니케이션 / 머지율',
      guide7d: '이 화면은 지난 7일 기준으로 프로젝트 활성도, 협업 이벤트, 데이터 최신성, 저장소 집중도를 보여줍니다. 각 카드는 “현재 상태를 얼마나 신뢰할 수 있는지” 판단하는 기준입니다.',
      guide30d: '이 화면은 지난 30일 기준으로 프로젝트 활성도, 협업 이벤트, 데이터 최신성, 저장소 집중도를 보여줍니다. 각 카드는 “현재 상태를 얼마나 신뢰할 수 있는지” 판단하는 기준입니다.',
      healthCoverage: '커버리지',
      healthMissingDayRatio: '결측 일 비율 (30일)',
      healthSchemaViolations: '스키마 위반',
      topRepoTitle: '상위 저장소',
      topRepoConcentration: '상위 3개 집중도',
      topRepoEmpty: '저장소 활동 데이터가 없습니다.',
      alertTitle: '액션 큐',
      alertEmpty: '활성 알림이 없습니다.',
      empty: '해당 기간에 현황 데이터가 없습니다.',
    },
  } as const;

  const t = texts[lang];
  const selectedPeriodLabel = windowSize === '7d' ? t.period7d : t.period30d;
  const trendTitle = windowSize === '7d' ? t.trendTitle7d : t.trendTitle30d;
  const guideText = windowSize === '7d' ? t.guide7d : t.guide30d;

  const fetchOverview = async (windowArg: '7d' | '30d' = windowSize) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await dashboardApi.overview(windowArg);
      setData(response);
    } catch (e) {
      console.error(e);
      setError('overview_fetch_failed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void fetchOverview(windowSize); }, [windowSize]);

  const summaryItems = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: t.summaryActiveProjects,
        value: String(data.summary.active_projects_count),
        tooltip: lang === 'ko'
          ? '프로젝트 status 값이 active 인 항목 수 (draft/completed 제외)'
          : 'Count of projects where status is active (excluding draft/completed).',
      },
      {
        label: t.summaryContributors,
        value: String(data.summary.weekly_active_contributors),
        tooltip: lang === 'ko'
          ? `선택 기간(${selectedPeriodLabel.replace('선택 기간: ', '')})의 GitHub 활성 기여자 수 + Discord 활성 작성자 수 합계`
          : `Sum of GitHub active contributors and Discord active authors during the ${windowSize === '7d' ? 'last 7 days' : 'last 30 days'}.`,
      },
      {
        label: t.summaryCollabEvents,
        value: String(data.summary.weekly_collab_events),
        tooltip: lang === 'ko'
          ? `선택 기간(${selectedPeriodLabel.replace('선택 기간: ', '')})의 GitHub 핵심 이벤트 + Discord 메시지 합계`
          : `Sum of core GitHub events and Discord messages during the ${windowSize === '7d' ? 'last 7 days' : 'last 30 days'}.`,
      },
      {
        label: t.summaryMergeRate,
        value: data.summary.pr_merge_rate_28d === null ? '-' : `${(data.summary.pr_merge_rate_28d * 100).toFixed(1)}%`,
        tooltip: lang === 'ko'
          ? 'opened 대비 merged PR 비율'
          : `Merged PR ratio against opened PRs for the selected ${windowSize}.`,
      },
      {
        label: t.summaryPipelineFreshness,
        value: `${data.summary.pipeline_freshness_hours.toFixed(1)}h`,
        tooltip: lang === 'ko'
          ? '마지막 유효 데이터 시점으로부터 경과 시간(시간)'
          : 'Hours elapsed since the latest valid data update.',
      },
    ];
  }, [data, lang, selectedPeriodLabel, windowSize, t.summaryActiveProjects, t.summaryContributors, t.summaryCollabEvents, t.summaryMergeRate, t.summaryPipelineFreshness]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{t.sub}</p>
          <p className="text-xs text-slate-400 mt-1">{selectedPeriodLabel}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex w-fit items-center gap-1 rounded-xl border bg-slate-50 p-1 dark:bg-slate-900">
            <Button size="sm" variant={windowSize === '7d' ? 'default' : 'ghost'} onClick={() => setWindowSize('7d')}>
              {t.window7d}
            </Button>
            <Button size="sm" variant={windowSize === '30d' ? 'default' : 'ghost'} onClick={() => setWindowSize('30d')}>
              {t.window30d}
            </Button>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-2">
            <Button variant="outline" className="gap-1 justify-between text-xs sm:text-sm" onClick={() => navigate('/metrics/github')}>
              {t.openGitHub}
              <ChevronRight size={14} />
            </Button>
            <Button variant="outline" className="gap-1 justify-between text-xs sm:text-sm" onClick={() => navigate('/metrics/discord')}>
              {t.openDiscord}
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 pt-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {guideText}
          </CardContent>
        </Card>
      </div>

      {isLoading ? <div role="progressbar" aria-busy="true" className="text-sm text-slate-500">{t.loading}</div> : null}

      {!isLoading && error ? (
        <Card className="rounded-2xl border-rose-200 dark:border-rose-900/50">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-2" role="alert"><AlertCircle size={16} /> {t.error}</div>
            <Button variant="outline" onClick={() => void fetchOverview()} className="gap-2"><RefreshCcw size={16} />{t.retry}</Button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !error && data ? (
        <>
          <KpiStrip items={summaryItems} />
          <TrendCompositeChart title={trendTitle} description={t.trendDescription} data={data.timeseries} />
          <HealthCards
            coverageLabel={t.healthCoverage}
            missingDayRatioLabel={t.healthMissingDayRatio}
            schemaViolationLabel={t.healthSchemaViolations}
            coverageScore={`${(data.health.coverage_score * 100).toFixed(1)}%`}
            missingDayRatio={`${(data.health.missing_day_ratio_30d * 100).toFixed(1)}%`}
            schemaViolationCount={String(data.health.schema_violation_count)}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TopRepoTable
              title={t.topRepoTitle}
              concentrationLabel={t.topRepoConcentration}
              emptyText={t.topRepoEmpty}
              concentration={`${(data.distribution.activity_concentration_top3 * 100).toFixed(1)}%`}
              rows={data.distribution.top_repos_by_activity}
            />
            <AlertList title={t.alertTitle} emptyText={t.alertEmpty} alerts={data.alerts} />
          </div>
        </>
      ) : null}

      {!isLoading && !error && data && data.timeseries.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-slate-500">{t.empty}</CardContent></Card>
      ) : null}
    </div>
  );
};

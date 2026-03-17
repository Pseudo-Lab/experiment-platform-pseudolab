import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { dashboardApi } from '@/services/dashboardApi';
import type { DiscordOverviewResponse } from '@/features/dashboard/types/metrics';

interface DiscordDashboardProps {
  lang: 'en' | 'ko';
}

export const DiscordDashboard: React.FC<DiscordDashboardProps> = ({ lang }) => {
  const [windowSize, setWindowSize] = useState<'7d' | '30d'>('7d');
  const [data, setData] = useState<DiscordOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openHint, setOpenHint] = useState<string | null>(null);

  const t = {
    en: {
      title: 'Discord Dashboard',
      loading: 'Loading Discord metrics...',
      retry: 'Retry',
      empty: 'No Discord activity data in this window.',
      error: 'Failed to load Discord metrics.',
      messages: 'Messages',
      activeAuthors: 'Active Authors',
      activeChannels: 'Active Channels',
      topChannels: 'Top Channels',
      volumeByChannel: 'Message volume by channel',
      topAuthors: 'Top Contributors',
      volumeByAuthor: 'Message volume by contributor',
      top3Concentration: 'Top3 concentration',
      guide: 'Discord dashboard summarizes message activity, contributor/channel breadth, and where conversation is concentrated in the selected window.',
      period7d: 'Period: last 7 days (Asia/Seoul)',
      period30d: 'Period: last 30 days (Asia/Seoul)',
      window7d: '7 days',
      window30d: '30 days',
      descMessages: 'Total number of Discord messages in the selected window.',
      descActiveAuthors: 'Distinct contributors who posted messages in the selected window.',
      descActiveChannels: 'Distinct channels with at least one message in the selected window.',
      descTop3Concentration: 'Share of total messages written by top 3 contributors.',
    },
    ko: {
      title: 'Discord 상세',
      loading: 'Discord 지표를 불러오는 중...',
      retry: '다시 시도',
      empty: '조회 기간에 Discord 활동 데이터가 없습니다.',
      error: 'Discord 지표를 불러오지 못했습니다.',
      messages: '메시지 수',
      activeAuthors: '활성 작성자',
      activeChannels: '활성 채널',
      topChannels: '상위 채널',
      volumeByChannel: '채널별 메시지 볼륨',
      topAuthors: '활동 기여자 TOP',
      volumeByAuthor: '작성자별 메시지 볼륨',
      top3Concentration: '상위 3명 집중도',
      guide: 'Discord 대시보드는 선택 기간 내 메시지 활동량, 참여 작성자/채널의 폭, 대화 집중 구간을 보여줍니다.',
      period7d: '기간: 최근 7일 (Asia/Seoul)',
      period30d: '기간: 최근 30일 (Asia/Seoul)',
      window7d: '7일',
      window30d: '30일',
      descMessages: 'Discord 메시지 총 건수',
      descActiveAuthors: '메시지를 작성한 고유 작성자 수',
      descActiveChannels: '메시지가 1건 이상 발생한 고유 채널 수',
      descTop3Concentration: '전체 메시지 중 상위 3명 작성자 비중'
    },
  }[lang];

  const load = async (windowArg: '7d' | '30d' = windowSize) => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await dashboardApi.discordOverview(windowArg));
    } catch {
      setError('discord_fetch_failed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load(windowSize);
  }, [windowSize]);

  const isEmpty = useMemo(() => {
    if (!data) return false;
    return data.summary.message_count === 0 && data.top_channels.length === 0;
  }, [data]);

  const top3Concentration = useMemo(() => {
    if (!data || data.summary.message_count === 0) return 0;
    const top3 = data.top_authors.slice(0, 3).reduce((acc, cur) => acc + cur.messages, 0);
    return (top3 / data.summary.message_count) * 100;
  }, [data]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-tooltip-root="discord-kpi"]')) return;
      setOpenHint(null);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const infoLabel = (key: string, label: string, tooltip: string) => (
    <span data-tooltip-root="discord-kpi" className="relative inline-flex items-center gap-1 group">
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
        <CardContent className="p-4 text-sm text-slate-600 dark:text-slate-300 space-y-2">
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
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <Card><CardHeader><CardDescription>{infoLabel('messages', t.messages, t.descMessages)}</CardDescription><CardTitle>{data.summary.message_count}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardDescription>{infoLabel('active-authors', t.activeAuthors, t.descActiveAuthors)}</CardDescription><CardTitle>{data.summary.active_authors}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardDescription>{infoLabel('active-channels', t.activeChannels, t.descActiveChannels)}</CardDescription><CardTitle>{data.summary.active_channels}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardDescription>{infoLabel('top3-concentration', t.top3Concentration, t.descTop3Concentration)}</CardDescription><CardTitle>{top3Concentration.toFixed(1)}%</CardTitle></CardHeader></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>{t.topChannels}</CardTitle>
                <CardDescription>{t.volumeByChannel}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.top_channels.map((channel) => (
                    <div key={channel.channel} className="flex items-center justify-between text-sm">
                      <span>{channel.channel}</span>
                      <span className="text-slate-500">{channel.messages}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t.topAuthors}</CardTitle>
                <CardDescription>{t.volumeByAuthor}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.top_authors.map((author) => (
                    <div key={author.author} className="flex items-center justify-between text-sm">
                      <span>{author.author}</span>
                      <span className="text-slate-500">{author.messages}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
};

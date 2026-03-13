import { render, screen, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from '@/features/dashboard/components/Dashboard';
import { GitHubDashboard } from '@/features/dashboard/components/GitHubDashboard';
import { DiscordDashboard } from '@/features/dashboard/components/DiscordDashboard';
import { dashboardApi } from '@/services/dashboardApi';

vi.mock('@/services/dashboardApi', () => ({
  dashboardApi: {
    overview: vi.fn(),
    githubOverview: vi.fn(),
    discordOverview: vi.fn(),
  },
}));

describe('Dashboard KO/EN text sync', () => {
  afterEach(cleanup);

  it('renders overview labels in Korean', async () => {
    (dashboardApi.overview as any).mockResolvedValueOnce({
      generated_at: '2026-03-10T00:00:00Z',
      window: { from: '2026-02-09', to: '2026-03-10', timezone: 'Asia/Seoul' as const },
      summary: {
        active_projects_count: 7,
        weekly_active_contributors: 12,
        weekly_collab_events: 88,
        pr_merge_rate_28d: 0.62,
        pipeline_freshness_hours: 3.2,
      },
      timeseries: [{ date: '03-10', core_activity: 10, communication: 13, merge_rate: 0.6 }],
      distribution: { top_repos_by_activity: [{ repo_name: 'repo-a', events: 30, ratio: 0.4 }], activity_concentration_top3: 0.7 },
      health: { coverage_score: 0.85, missing_day_ratio_30d: 0.03, schema_violation_count: 0 },
      alerts: [{ code: 'merge-drop', severity: 'medium' as const, message: 'Merge rate dropped' }],
    });

    await act(async () => {
      render(<MemoryRouter><Dashboard lang="ko" /></MemoryRouter>);
    });

    expect(screen.getByText('전체 현황판')).toBeInTheDocument();
    expect(screen.getByText('활성 프로젝트')).toBeInTheDocument();
    expect(screen.getByText('추세 패널 (7일)')).toBeInTheDocument();
    expect(screen.getByText('상위 저장소')).toBeInTheDocument();
    expect(screen.getByText('액션 큐')).toBeInTheDocument();
  });

  it('renders GitHub labels in Korean', async () => {
    (dashboardApi.githubOverview as any).mockResolvedValueOnce({
      generated_at: '2026-03-10T00:00:00Z',
      window: { from: '2026-02-09', to: '2026-03-10', timezone: 'Asia/Seoul' as const },
      summary: {
        push_events: 11,
        pr_opened: 5,
        pr_merged: 4,
        issue_comments: 0,
        pr_reviews: 0,
        merge_rate_28d: 0.8,
        total_core_events: 20,
        active_contributors: 3,
      },
      timeseries: [],
      top_repos: [{ repo_name: 'repo-a', events: 10, ratio: 0.5 }],
    });

    await act(async () => {
      render(<MemoryRouter><GitHubDashboard lang="ko" /></MemoryRouter>);
    });

    expect(screen.getByText('GitHub 상세')).toBeInTheDocument();
    expect(screen.getByText('핵심 이벤트 수')).toBeInTheDocument();
    expect(screen.getByText('상위 저장소')).toBeInTheDocument();
  });

  it('renders Discord labels in Korean', async () => {
    (dashboardApi.discordOverview as any).mockResolvedValueOnce({
      generated_at: '2026-03-10T00:00:00Z',
      window: { from: '2026-02-09', to: '2026-03-10', timezone: 'Asia/Seoul' as const },
      summary: { message_count: 90, active_authors: 10, active_channels: 4 },
      timeseries: [],
      top_channels: [{ channel: '#general', messages: 40 }],
      top_authors: [],
    });

    await act(async () => {
      render(<MemoryRouter><DiscordDashboard lang="ko" /></MemoryRouter>);
    });

    expect(screen.getByText('Discord 상세')).toBeInTheDocument();
    expect(screen.getByText('메시지 수')).toBeInTheDocument();
    expect(screen.getByText('상위 채널')).toBeInTheDocument();
  });
});

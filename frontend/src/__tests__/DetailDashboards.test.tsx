import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GitHubDashboard } from '@/features/dashboard/components/GitHubDashboard';
import { DiscordDashboard } from '@/features/dashboard/components/DiscordDashboard';
import { dashboardApi } from '@/services/dashboardApi';

vi.mock('@/services/dashboardApi', () => ({
  dashboardApi: {
    githubOverview: vi.fn(),
    discordOverview: vi.fn(),
  },
}));

const githubSuccess = {
  generated_at: '2026-03-10T00:00:00Z',
  window: { from: '2026-03-04', to: '2026-03-10', timezone: 'Asia/Seoul' as const },
  summary: {
    push_events: 11,
    pr_opened: 5,
    pr_merged: 4,
    issue_comments: 3,
    pr_reviews: 2,
    merge_rate_28d: 0.8,
    total_core_events: 21,
    active_contributors: 4,
  },
  timeseries: [],
  top_repos: [{ repo_name: 'repo-a', events: 10, ratio: 0.5 }],
};

const githubEmpty = {
  ...githubSuccess,
  summary: {
    ...githubSuccess.summary,
    push_events: 0,
    pr_opened: 0,
    pr_merged: 0,
    issue_comments: 0,
    pr_reviews: 0,
    merge_rate_28d: null,
    total_core_events: 0,
    active_contributors: 0,
  },
  top_repos: [],
};

const discordSuccess = {
  generated_at: '2026-03-10T00:00:00Z',
  window: { from: '2026-03-04', to: '2026-03-10', timezone: 'Asia/Seoul' as const },
  summary: { message_count: 90, active_authors: 10, active_channels: 4 },
  timeseries: [],
  top_channels: [{ channel: '#general', messages: 40 }],
  top_authors: [
    { author: 'alice', messages: 25 },
    { author: 'bob', messages: 20 },
    { author: 'carol', messages: 10 },
  ],
};

const discordEmpty = {
  ...discordSuccess,
  summary: { message_count: 0, active_authors: 0, active_channels: 0 },
  top_channels: [],
  top_authors: [],
};

describe('GitHub/Discord dashboard detail flows', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows GitHub loading state and recovers via retry after an error', async () => {
    (dashboardApi.githubOverview as any)
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockRejectedValueOnce(new Error('github boom'))
      .mockResolvedValueOnce(githubSuccess);

    await act(async () => {
      render(<MemoryRouter><GitHubDashboard lang="ko" /></MemoryRouter>);
    });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    cleanup();

    await act(async () => {
      render(<MemoryRouter><GitHubDashboard lang="ko" /></MemoryRouter>);
    });

    expect(screen.getByRole('alert')).toHaveTextContent('GitHub 지표를 불러오지 못했습니다.');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    });

    expect(dashboardApi.githubOverview).toHaveBeenNthCalledWith(1, '7d');
    expect(dashboardApi.githubOverview).toHaveBeenNthCalledWith(2, '7d');
    expect(screen.getByText('핵심 이벤트 수')).toBeInTheDocument();
    expect(screen.getByText('21')).toBeInTheDocument();
  });

  it('supports GitHub window switching and tooltip tap/outside-close behavior', async () => {
    (dashboardApi.githubOverview as any).mockResolvedValue(githubSuccess);

    await act(async () => {
      render(<MemoryRouter><GitHubDashboard lang="en" /></MemoryRouter>);
    });

    expect(dashboardApi.githubOverview).toHaveBeenNthCalledWith(1, '7d');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '30 days' }));
    });

    expect(dashboardApi.githubOverview).toHaveBeenNthCalledWith(2, '30d');
    expect(screen.getByText('Period: last 30 days (Asia/Seoul)')).toBeInTheDocument();

    const tooltipText = 'Merged PR ratio against opened PRs in the selected window.';
    const descriptionButton = screen.getByRole('button', { name: 'Merge Rate description' });

    expect(screen.getAllByText(tooltipText)).toHaveLength(1);

    await act(async () => {
      fireEvent.click(descriptionButton);
    });

    expect(descriptionButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText(tooltipText)).toHaveLength(2);

    await act(async () => {
      fireEvent.pointerDown(document.body);
    });

    expect(descriptionButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByText(tooltipText)).toHaveLength(1);
  });

  it('shows Discord empty state for an empty response', async () => {
    (dashboardApi.discordOverview as any).mockResolvedValueOnce(discordEmpty);

    await act(async () => {
      render(<MemoryRouter><DiscordDashboard lang="ko" /></MemoryRouter>);
    });

    expect(screen.getByText('조회 기간에 Discord 활동 데이터가 없습니다.')).toBeInTheDocument();
  });

  it('supports Discord window switching and tooltip tap/outside-close behavior', async () => {
    (dashboardApi.discordOverview as any).mockResolvedValue(discordSuccess);

    await act(async () => {
      render(<MemoryRouter><DiscordDashboard lang="en" /></MemoryRouter>);
    });

    expect(dashboardApi.discordOverview).toHaveBeenNthCalledWith(1, '7d');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '30 days' }));
    });

    expect(dashboardApi.discordOverview).toHaveBeenNthCalledWith(2, '30d');
    expect(screen.getByText('Period: last 30 days (Asia/Seoul)')).toBeInTheDocument();

    const tooltipText = 'Share of total messages written by top 3 contributors.';
    const descriptionButton = screen.getByRole('button', { name: 'Top3 concentration description' });

    expect(screen.getAllByText(tooltipText)).toHaveLength(1);

    await act(async () => {
      fireEvent.click(descriptionButton);
    });

    expect(descriptionButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText(tooltipText)).toHaveLength(2);

    await act(async () => {
      fireEvent.pointerDown(document.body);
    });

    expect(descriptionButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByText(tooltipText)).toHaveLength(1);
  });
});

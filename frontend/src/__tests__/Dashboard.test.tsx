import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from '@/features/dashboard/components/Dashboard';
import { dashboardApi } from '@/services/dashboardApi';

vi.mock('@/services/dashboardApi', () => ({
  dashboardApi: {
    overview: vi.fn(),
  },
}));

describe('Dashboard Overview Component', () => {
  const mockOverview = {
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
  };

  beforeEach(() => {
    (dashboardApi.overview as any).mockClear();
    (dashboardApi.overview as any).mockResolvedValue(mockOverview);
  });

  afterEach(cleanup);

  it('renders overview title and summary after data load', async () => {
    await act(async () => {
      render(<MemoryRouter><Dashboard lang="ko" /></MemoryRouter>);
    });

    expect(screen.getByText('전체 현황판')).toBeInTheDocument();
    expect(screen.getByText('활성 프로젝트')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('shows loading state', async () => {
    (dashboardApi.overview as any).mockImplementationOnce(() => new Promise(() => {}));
    await act(async () => {
      render(<MemoryRouter><Dashboard lang="ko" /></MemoryRouter>);
    });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows error state when api fails', async () => {
    (dashboardApi.overview as any).mockRejectedValueOnce(new Error('boom'));
    await act(async () => {
      render(<MemoryRouter><Dashboard lang="ko" /></MemoryRouter>);
    });
    expect(screen.getByText('현황 데이터를 불러오지 못했습니다.')).toBeInTheDocument();
  });

  it('updates selected-period copy and refetches when window changes to 30d', async () => {
    await act(async () => {
      render(<MemoryRouter><Dashboard lang="ko" /></MemoryRouter>);
    });

    expect(dashboardApi.overview).toHaveBeenNthCalledWith(1, '7d');
    expect(screen.getByText('선택 기간: 최근 7일 (Asia/Seoul)')).toBeInTheDocument();
    expect(screen.getByText('추세 패널 (7일)')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '30일' }));
    });

    expect(dashboardApi.overview).toHaveBeenNthCalledWith(2, '30d');
    expect(screen.getByText('선택 기간: 최근 30일 (Asia/Seoul)')).toBeInTheDocument();
    expect(screen.getByText('추세 패널 (30일)')).toBeInTheDocument();
    expect(screen.getByText('이 화면은 지난 30일 기준으로 프로젝트 활성도, 협업 이벤트, 데이터 최신성, 저장소 집중도를 보여줍니다. 각 카드는 “현재 상태를 얼마나 신뢰할 수 있는지” 판단하는 기준입니다.')).toBeInTheDocument();
  });
});

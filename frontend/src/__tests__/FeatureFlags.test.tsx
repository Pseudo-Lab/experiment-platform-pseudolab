import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { FeatureFlags } from '@/features/dashboard/components/FeatureFlags';
import { featureFlagApi } from '@/services/api';

vi.mock('@/services/api', () => ({
  featureFlagApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
    exposureSummary: vi.fn(),
  },
  projectApi: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

describe('FeatureFlags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (featureFlagApi.list as any).mockResolvedValue([
      {
        flag_key: 'new_home',
        description: 'New homepage',
        rollout_pct: 50,
        enabled: true,
        archived_at: null,
        created_at: '2026-05-09T00:00:00Z',
        updated_at: '2026-05-09T00:00:00Z',
      },
    ]);
    (featureFlagApi.exposureSummary as any).mockResolvedValue({
      flag_key: 'new_home',
      from: null,
      to: null,
      total_exposures: 12,
      unique_users: 8,
      first_exposure_users: 8,
      variant_counts: { treatment: 5, control: 3 },
    });
  });

  afterEach(cleanup);

  it('renders exposure summary in Korean', async () => {
    await act(async () => {
      render(<FeatureFlags lang="ko" />);
    });

    expect(await screen.findByText('new_home')).toBeInTheDocument();
    expect(screen.getByText('노출')).toBeInTheDocument();
    expect(screen.getByText('전체 호출 12 · 분석 대상 8')).toBeInTheDocument();
    expect(screen.getByText('treatment 5')).toBeInTheDocument();
    expect(screen.getByText('control 3')).toBeInTheDocument();
    expect(featureFlagApi.exposureSummary).toHaveBeenCalledWith('new_home');
  });

  it('can include archived flags', async () => {
    (featureFlagApi.list as any)
      .mockResolvedValueOnce([
        {
          flag_key: 'active_flag',
          description: 'Active flag',
          rollout_pct: 50,
          enabled: true,
          archived_at: null,
          created_at: '2026-05-09T00:00:00Z',
          updated_at: '2026-05-09T00:00:00Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          flag_key: 'archived_flag',
          description: 'Archived flag',
          rollout_pct: 50,
          enabled: false,
          archived_at: '2026-05-09T01:00:00Z',
          created_at: '2026-05-09T00:00:00Z',
          updated_at: '2026-05-09T01:00:00Z',
        },
      ]);

    await act(async () => {
      render(<FeatureFlags lang="ko" />);
    });

    await act(async () => {
      fireEvent.click(screen.getByLabelText('보관된 플래그 포함'));
    });

    expect(await screen.findByText('archived_flag')).toBeInTheDocument();
    expect(screen.getByText('보관됨')).toBeInTheDocument();
    expect(featureFlagApi.list).toHaveBeenLastCalledWith(true);
  });

  it('can restore archived flags', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    (featureFlagApi.list as any).mockResolvedValueOnce([
      {
        flag_key: 'archived_flag',
        description: 'Archived flag',
        rollout_pct: 50,
        enabled: false,
        archived_at: '2026-05-09T01:00:00Z',
        created_at: '2026-05-09T00:00:00Z',
        updated_at: '2026-05-09T01:00:00Z',
      },
    ]);
    (featureFlagApi.restore as any).mockResolvedValueOnce({
      flag_key: 'archived_flag',
      description: 'Archived flag',
      rollout_pct: 50,
      enabled: false,
      archived_at: null,
      created_at: '2026-05-09T00:00:00Z',
      updated_at: '2026-05-09T02:00:00Z',
    });

    await act(async () => {
      render(<FeatureFlags lang="ko" />);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /복구/ }));
    });

    expect(featureFlagApi.restore).toHaveBeenCalledWith('archived_flag');
    expect(screen.getByText('비활성')).toBeInTheDocument();
    expect(screen.queryByText('보관됨')).not.toBeInTheDocument();

    (window.confirm as any).mockRestore();
  });

  it('renders custom variant chips (e.g. list, sidebar) beyond treatment/control', async () => {
    (featureFlagApi.exposureSummary as any).mockResolvedValueOnce({
      flag_key: 'new_home',
      from: null,
      to: null,
      total_exposures: 200,
      unique_users: 200,
      first_exposure_users: 200,
      variant_counts: { control: 100, list: 95, sidebar: 5 },
    });

    await act(async () => {
      render(<FeatureFlags lang="ko" />);
    });

    expect(await screen.findByText('control 100')).toBeInTheDocument();
    expect(screen.getByText('list 95')).toBeInTheDocument();
    expect(screen.getByText('sidebar 5')).toBeInTheDocument();
  });

  it('omits zero-count variants from chips', async () => {
    (featureFlagApi.exposureSummary as any).mockResolvedValueOnce({
      flag_key: 'new_home',
      from: null,
      to: null,
      total_exposures: 15,
      unique_users: 15,
      first_exposure_users: 15,
      variant_counts: { control: 10, list: 0, sidebar: 5 },
    });

    await act(async () => {
      render(<FeatureFlags lang="ko" />);
    });

    expect(await screen.findByText('control 10')).toBeInTheDocument();
    expect(screen.getByText('sidebar 5')).toBeInTheDocument();
    expect(screen.queryByText(/^list /)).not.toBeInTheDocument();
  });

  it('renders empty exposure state in English', async () => {
    (featureFlagApi.exposureSummary as any).mockResolvedValueOnce({
      flag_key: 'new_home',
      from: null,
      to: null,
      total_exposures: 0,
      unique_users: 0,
      first_exposure_users: 0,
      variant_counts: {},
    });

    await act(async () => {
      render(<FeatureFlags lang="en" />);
    });

    expect(await screen.findByText('No exposure')).toBeInTheDocument();
  });
});

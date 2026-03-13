import { render, screen, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Metrics } from '@/features/dashboard/components/Metrics';
import { experimentApi } from '@/services/api';

vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>();
  return {
    ...actual,
    experimentApi: {
      list: vi.fn(),
    },
  };
});

describe('Metrics Component', () => {
  const mockExperiments = [
    { id: '1', name: 'Experiment A', status: 'active', created_at: '2026-03-09T10:00:00Z' },
    { id: '2', name: 'Experiment B', status: 'draft', created_at: '2026-03-08T10:00:00Z' },
    { id: '3', name: 'Experiment C', status: 'completed', created_at: '2026-03-07T10:00:00Z' },
  ] as const;

  beforeEach(() => {
    (experimentApi.list as any).mockClear();
    (experimentApi.list as any).mockResolvedValue(mockExperiments);
  });

  afterEach(cleanup);

  const renderMetrics = (lang: 'en' | 'ko' = 'ko') => {
    return render(
      <MemoryRouter>
        <Metrics lang={lang} />
      </MemoryRouter>
    );
  };

  it('renders loading state initially', async () => {
    (experimentApi.list as any).mockImplementationOnce(() => new Promise(() => {}));

    await act(async () => {
      renderMetrics();
    });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders derived metrics after data loads', async () => {
    await act(async () => {
      renderMetrics('ko');
    });

    expect(screen.getByText('파생 지표')).toBeInTheDocument();
    expect(screen.getByText('총 실험 수')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders empty state when there is no experiment', async () => {
    (experimentApi.list as any).mockResolvedValueOnce([]);

    await act(async () => {
      renderMetrics('ko');
    });

    expect(screen.getByText('실험 데이터가 없습니다')).toBeInTheDocument();
  });

  it('calls experimentApi.list once', async () => {
    await act(async () => {
      renderMetrics();
    });

    expect(experimentApi.list).toHaveBeenCalledTimes(1);
  });
});

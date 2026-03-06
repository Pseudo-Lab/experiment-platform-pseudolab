import { render, screen, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from '@/features/dashboard/components/Dashboard';
import { experimentApi } from '@/services/api'; // Import the actual API service

// Mock the entire api service module
vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>();
  return {
    ...actual,
    experimentApi: {
      list: vi.fn(), // Mock the list method
    },
  };
});

describe('Dashboard Component', () => {
  const mockExperiments = [
    { id: '1', name: 'Experiment A', status: 'active', created_at: '2026-03-01T10:00:00Z' },
    { id: '2', name: 'Experiment B', status: 'draft', created_at: '2026-03-02T10:00:00Z' },
  ];

  beforeEach(() => {
    (experimentApi.list as any).mockClear();
    // Default mock implementation for list API
    (experimentApi.list as any).mockResolvedValue(mockExperiments);
  });

  afterEach(cleanup);

  const renderDashboard = (lang: 'en' | 'ko' = 'ko') => {
    return render(
      <MemoryRouter>
        <Dashboard lang={lang} />
      </MemoryRouter>
    );
  };

  it('renders welcome message and subtitle', async () => {
    await act(async () => {
      renderDashboard('ko');
    });
    expect(screen.getByText('실험플랫폼에 오신 것을 환영합니다')).toBeInTheDocument();
    expect(screen.getByText('데이터 밸류에이션 실험의 최신 현황을 확인하세요.')).toBeInTheDocument();
  });

  it('displays loading state initially', async () => {
    (experimentApi.list as any).mockImplementationOnce(() => new Promise(() => { })); // Never resolve list API
    await act(async () => {
      renderDashboard();
    });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays experiment cards after data loads', async () => {
    await act(async () => {
      renderDashboard();
    });
    expect(screen.getByText('Experiment A')).toBeInTheDocument();
    expect(screen.getByText('Experiment B')).toBeInTheDocument();
    expect(screen.getByText('활성 실험')).toBeInTheDocument(); // Stat card
  });

  it('displays no data message when no experiments are found', async () => {
    (experimentApi.list as any).mockResolvedValueOnce([]); // Mock an empty array for no data
    await act(async () => {
      renderDashboard();
    });
    expect(screen.getByText('최근 실험 데이터가 없습니다')).toBeInTheDocument();
    expect(screen.getByText('실시간 데이터 가치 지표를 확인하려면 새로운 실험을 시작하세요.')).toBeInTheDocument();
  });

  it('calls experimentApi.list to get experiment data', async () => {
    await act(async () => {
      renderDashboard();
    });
    expect(experimentApi.list).toHaveBeenCalledTimes(1);
  });
});
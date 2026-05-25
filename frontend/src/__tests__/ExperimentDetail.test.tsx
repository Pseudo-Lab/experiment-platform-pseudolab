import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ExperimentDetail } from '@/features/dashboard/components/ExperimentDetail';
import {
  decisionApi,
  experimentApi,
  experimentPlacementApi,
  experimentResultApi,
} from '@/services/api';

vi.mock('@/services/api', () => ({
  experimentApi: {
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  experimentPlacementApi: {
    list: vi.fn(),
    update: vi.fn(),
  },
  experimentResultApi: {
    getResult: vi.fn(),
  },
  decisionApi: {
    list: vi.fn(),
    listNotes: vi.fn(),
    create: vi.fn(),
    createNote: vi.fn(),
  },
}));

const experiment = {
  id: 's12-mid-reflection',
  name: '12기 중간 회고',
  hypothesis: '회고 UI 노출은 제출을 늘린다.',
  expected_effect: '',
  primary_metric: 'project_reflection_ui_clicked',
  status: 'running',
  created_at: '2026-05-25T00:00:00Z',
  updated_at: '2026-05-25T00:00:00Z',
  variants: [],
};

const placement = {
  experiment_id: 's12-mid-reflection',
  placement_key: 'project-detail-home-reflection-cta',
  ui_id: 's12-mid-reflection-banner',
  ui_type: 'banner',
  title: '중간 회고 작성하기',
  description: '지금까지의 여정을 정리하고 남은 기간 방향을 잡아봐요',
  target_url: '/reflection/s12-mid-reflection',
  source: 'project_detail_home',
  target_cohort: '12',
  allowed_roles: ['builder', 'runner'],
  enabled: true,
  created_at: '2026-05-25T00:00:00Z',
  updated_at: '2026-05-25T00:00:00Z',
};

const renderDetail = async () => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={['/experiments/s12-mid-reflection']}>
        <Routes>
          <Route path="/experiments/:id" element={<ExperimentDetail lang="ko" />} />
        </Routes>
      </MemoryRouter>,
    );
  });
};

describe('ExperimentDetail placements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (experimentApi.get as any).mockResolvedValue(experiment);
    (experimentPlacementApi.list as any).mockResolvedValue([placement]);
    (decisionApi.list as any).mockResolvedValue([]);
    (decisionApi.listNotes as any).mockResolvedValue([]);
    (experimentResultApi.getResult as any).mockResolvedValue({});
  });

  afterEach(cleanup);

  it('renders placement config in Korean', async () => {
    await renderDetail();

    expect(await screen.findByText('LVUP 노출 슬롯')).toBeInTheDocument();
    expect(screen.getAllByText('project-detail-home-reflection-cta').length).toBeGreaterThan(0);
    expect(screen.getByText('중간 회고 작성하기')).toBeInTheDocument();
    expect(experimentPlacementApi.list).toHaveBeenCalledWith('s12-mid-reflection');
  });

  it('updates placement config from the detail page', async () => {
    (experimentPlacementApi.update as any).mockResolvedValue({
      ...placement,
      title: '회고 남기기',
      ui_type: 'card',
    });

    await renderDetail();

    const editButtons = await screen.findAllByRole('button', { name: /수정/ });
    fireEvent.click(editButtons[1]);

    fireEvent.change(screen.getByDisplayValue('중간 회고 작성하기'), {
      target: { value: '회고 남기기' },
    });

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /저장/ })[0]);
    });

    expect(experimentPlacementApi.update).toHaveBeenCalledWith(
      's12-mid-reflection',
      'project-detail-home-reflection-cta',
      expect.objectContaining({
        title: '회고 남기기',
        allowed_roles: ['builder', 'runner'],
        enabled: true,
      }),
    );
    expect(await screen.findByText('LVUP 노출 슬롯을 저장했습니다.')).toBeInTheDocument();
  });
});

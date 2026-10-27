import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ExperimentDetail } from '@/features/dashboard/components/ExperimentDetail';
import {
  decisionApi,
  experimentApi,
  experimentPlacementApi,
  experimentResultApi,
  projectApi,
  featureFlagApi,
} from '@/services/api';

vi.mock('@/services/api', () => ({
  featureFlagApi: {
    list: vi.fn(), exposureSummary: vi.fn(), listRules: vi.fn(), update: vi.fn(),
  },
  experimentApi: {
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  experimentPlacementApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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
  projectApi: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

const experiment = {
  id: 's12-mid-reflection',
  name: '12기 중간 회고',
  hypothesis: '회고 UI 노출은 제출을 늘린다.',
  expected_effect: '',
  primary_metric: 'project_reflection_ui_clicked',
  experiment_type: 'quasi_experiment',
  status: 'running',
  created_at: '2026-05-25T00:00:00Z',
  updated_at: '2026-05-25T00:00:00Z',
  variants: [],
};

const placement = {
  experiment_id: 's12-mid-reflection',
  placement_key: 'project-detail-home-reflection-cta',
  variant_key: null,
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

const renderDetail = async (lang: 'ko' | 'en' = 'ko') => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={['/experiments/s12-mid-reflection']}>
        <Routes>
          <Route path="/experiments/:id" element={<ExperimentDetail lang={lang} />} />
        </Routes>
      </MemoryRouter>,
    );
  });
};

describe('ExperimentDetail placements', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(projectApi.list).mockResolvedValue([]);
    vi.mocked(featureFlagApi.list).mockResolvedValue([]);
    vi.mocked(featureFlagApi.exposureSummary).mockResolvedValue({ total_exposures: 0 } as any);
    vi.mocked(featureFlagApi.listRules).mockResolvedValue([]);
    (experimentApi.get as any).mockResolvedValue(experiment);
    (experimentPlacementApi.list as any).mockResolvedValue([placement]);
    (decisionApi.list as any).mockResolvedValue([]);
    (decisionApi.listNotes as any).mockResolvedValue([]);
    (experimentResultApi.getResult as any).mockResolvedValue({});
  });

  afterEach(cleanup);

  it('renders placement config in Korean', async () => {
    await renderDetail();

    expect(await screen.findByText('노출 지점(Placement)')).toBeInTheDocument();
    expect(screen.getAllByText('project-detail-home-reflection-cta').length).toBeGreaterThan(0);
    expect(screen.getByText('중간 회고 작성하기')).toBeInTheDocument();
    expect(screen.getByText('응답 Payload')).toBeInTheDocument();
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
    expect(await screen.findByText('Placement를 저장했습니다.')).toBeInTheDocument();
  });

  it('creates a new placement', async () => {
    (experimentPlacementApi.create as any).mockResolvedValue({
      ...placement,
      placement_key: 'project-sidebar-reflection-cta',
      ui_id: 's12-sidebar-reflection',
      title: '사이드바 회고',
      enabled: false,
    });

    await renderDetail();

    fireEvent.click(await screen.findByRole('button', { name: /Placement 추가/ }));
    fireEvent.change(screen.getByLabelText('Placement 키'), {
      target: { value: 'project-sidebar-reflection-cta' },
    });
    fireEvent.change(screen.getByLabelText('UI ID'), {
      target: { value: 's12-sidebar-reflection' },
    });
    fireEvent.change(screen.getByLabelText('제목'), {
      target: { value: '사이드바 회고' },
    });
    fireEvent.change(screen.getByLabelText('이동 URL payload'), {
      target: { value: '/reflection/sidebar' },
    });
    fireEvent.change(screen.getByLabelText('설명'), {
      target: { value: '프로젝트 사이드바 회고 진입점' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Placement 생성/ }));
    });

    expect(experimentPlacementApi.create).toHaveBeenCalledWith(
      's12-mid-reflection',
      expect.objectContaining({
        placement_key: 'project-sidebar-reflection-cta',
        ui_id: 's12-sidebar-reflection',
        title: '사이드바 회고',
        target_url: '/reflection/sidebar',
        source: 'unknown',
        target_cohort: '*',
        allowed_roles: [],
      }),
    );
    expect(await screen.findByText('Placement를 생성했습니다.')).toBeInTheDocument();
  });

  it('includes project_id when saving experiment edits', async () => {
    (experimentApi.get as any).mockResolvedValue({ ...experiment, project_id: 'lvup' });
    (projectApi.list as any).mockResolvedValue([
      { id: 'lvup', name: 'LVUP', api_key: 'pk_live_lvup_x', created_at: '2026-05-25T00:00:00Z' },
    ]);
    (experimentApi.update as any).mockResolvedValue({ ...experiment, project_id: 'lvup' });

    await renderDetail();

    const editButtons = await screen.findAllByRole('button', { name: /수정/ });
    fireEvent.click(editButtons[0]);

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /저장/ })[0]);
    });

    expect(experimentApi.update).toHaveBeenCalledWith(
      's12-mid-reflection',
      expect.objectContaining({ project_id: 'lvup' }),
    );
  });

  it('deletes a placement after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    (experimentPlacementApi.delete as any).mockResolvedValue(undefined);

    await renderDetail();

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: /Placement 삭제/ }));
    });

    expect(experimentPlacementApi.delete).toHaveBeenCalledWith(
      's12-mid-reflection',
      'project-detail-home-reflection-cta',
    );
    expect(await screen.findByText('Placement를 삭제했습니다.')).toBeInTheDocument();

    (window.confirm as any).mockRestore();
  });

  it.each(['ko', 'en'] as const)('keeps edited input and reports save failures in %s', async (lang) => {
    vi.mocked(experimentApi.update).mockRejectedValueOnce(new Error('503'))
      .mockResolvedValueOnce({ ...experiment, name: 'Retry name' } as any);
    await renderDetail(lang);
    fireEvent.click(screen.getAllByRole('button', { name: lang === 'ko' ? '수정' : 'Edit' })[0]);
    const name = screen.getByLabelText(lang === 'ko' ? '실험 이름' : 'Name');
    fireEvent.change(name, { target: { value: 'Retry name' } });
    fireEvent.click(screen.getByRole('button', { name: lang === 'ko' ? '저장' : 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(lang === 'ko' ? '입력 내용은 유지됩니다' : 'Your input has been kept');
    expect(name).toHaveValue('Retry name');
    fireEvent.click(screen.getByRole('button', { name: lang === 'ko' ? '저장' : 'Save' }));
    expect(await screen.findByRole('heading', { name: 'Retry name' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('explains the missing primary metric before submitting a start request', async () => {
    vi.mocked(experimentApi.get).mockResolvedValue({ ...experiment, status: 'draft', primary_metric: null } as any);
    await renderDetail();
    fireEvent.click(screen.getByRole('button', { name: '시작' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('주요 지표를 먼저 설정');
    expect(experimentApi.update).not.toHaveBeenCalled();
  });

  it('allows resuming a paused experiment without repeating draft-only checks', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(experimentApi.get).mockResolvedValue({ ...experiment, status: 'paused', experiment_type: 'ab_test', flag_key: null, primary_metric: null } as any);
    vi.mocked(experimentApi.update).mockResolvedValue({ ...experiment, status: 'running' } as any);
    try {
      await renderDetail('en');
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Resume' })); });
      expect(experimentApi.update).toHaveBeenCalledWith(experiment.id, { status: 'running' });
    } finally { confirm.mockRestore(); }
  });

  it('preserves rollout input on failure and retries the same setting', async () => {
    const flag = { flag_key: 'test-flag', enabled: true, rollout_pct: 20 } as any;
    vi.mocked(experimentApi.get).mockResolvedValue({ ...experiment, flag_key: flag.flag_key } as any);
    vi.mocked(featureFlagApi.list).mockResolvedValue([flag]);
    vi.mocked(featureFlagApi.update).mockRejectedValueOnce(new Error('503'))
      .mockResolvedValueOnce({ ...flag, rollout_pct: 35 });
    await renderDetail('en');
    const slider = await screen.findByRole('slider', { name: 'Rollout %' });
    fireEvent.change(slider, { target: { value: '35' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to update flag');
    expect(slider).toHaveValue('35');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await act(async () => {});
    expect(featureFlagApi.update).toHaveBeenLastCalledWith('test-flag', { rollout_pct: 35 });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('reports failed flag toggles without changing the shown enabled state', async () => {
    const flag = { flag_key: 'test-flag', enabled: true, rollout_pct: 20 } as any;
    vi.mocked(experimentApi.get).mockResolvedValue({ ...experiment, flag_key: flag.flag_key } as any);
    vi.mocked(featureFlagApi.list).mockResolvedValue([flag]);
    vi.mocked(featureFlagApi.update).mockRejectedValueOnce(new Error('503'));
    await renderDetail('en');
    fireEvent.click(await screen.findByRole('button', { name: 'Disabled' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to update flag');
    expect(screen.getByRole('button', { name: 'Disabled' })).toHaveTextContent('Enabled');
  });

});

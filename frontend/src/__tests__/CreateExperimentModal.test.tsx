import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { CreateExperimentModal } from '@/features/dashboard/components/CreateExperimentModal';
import { useProject } from '@/contexts/ProjectContext';
import { experimentApi, experimentPlacementApi, featureFlagApi } from '@/services/api';

vi.mock('@/contexts/ProjectContext', () => ({ useProject: vi.fn() }));

vi.mock('@/services/api', () => ({
  experimentApi: {
    create: vi.fn(),
  },
  experimentPlacementApi: {
    create: vi.fn(),
  },
  featureFlagApi: {
    list: vi.fn().mockResolvedValue([]),
    listRules: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ flag_key: 'project-experiment' }),
  },
  projectApi: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

describe('CreateExperimentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useProject).mockReturnValue({ currentProject: null } as any);
    (experimentApi.create as any).mockResolvedValue({
      id: 's12-mid-reflection',
      name: '12기 중간 회고',
      status: 'draft',
      created_at: '2026-05-25T00:00:00Z',
      updated_at: '2026-05-25T00:00:00Z',
      variants: [],
    });
    (experimentPlacementApi.create as any).mockResolvedValue({
      experiment_id: 's12-mid-reflection',
      placement_key: 'project-detail-home-reflection-cta',
      ui_id: 's12-mid-reflection-banner',
      ui_type: 'banner',
      title: '중간 회고 작성하기',
      description: '지금까지의 여정을 정리하고 남은 기간 방향을 잡아봐요',
      target_url: '/reflection/s12-mid-reflection',
      source: 'unknown',
      target_cohort: '*',
      allowed_roles: [],
      enabled: true,
      created_at: '2026-05-25T00:00:00Z',
      updated_at: '2026-05-25T00:00:00Z',
    });
  });

  afterEach(cleanup);

  it.each(['quasi_experiment', 'ab_test'] as const)('preserves the legacy %s experiment with an initial placement', async (experimentType) => {
    vi.mocked(useProject).mockReturnValue({ currentProject: { id: 'selected', project_type: experimentType } } as any);
    const onCreated = vi.fn();

    render(<CreateExperimentModal lang="ko" onClose={vi.fn()} onCreated={onCreated} />);

    fireEvent.change(screen.getByPlaceholderText('예: 버튼 색상 테스트'), {
      target: { value: '12기 중간 회고' },
    });
    fireEvent.click(screen.getByText('수집·노출 세부 설정 (선택)'));
    fireEvent.change(screen.getByLabelText('실험 ID'), {
      target: { value: 's12-mid-reflection' },
    });
    fireEvent.change(screen.getByPlaceholderText('예: weekly_session_attended'), {
      target: { value: 'project_reflection_submitted' },
    });
    fireEvent.change(screen.getByLabelText('코호트 ID'), {
      target: { value: '12' },
    });
    fireEvent.change(screen.getByLabelText('노출 시작'), {
      target: { value: '2026-05-28T00:00' },
    });
    fireEvent.change(screen.getByLabelText('노출 종료'), {
      target: { value: '2026-06-10T00:00' },
    });
    // Placement 섹션을 켜야 완료 이벤트 입력이 노출됨
    fireEvent.click(screen.getByLabelText('실험 생성과 함께 Placement 생성'));
    if (experimentType === 'ab_test') {
      fireEvent.click(screen.getByRole('button', { name: '자동 생성' }));
      expect(screen.queryByText(/새 플래그 A\/B 실험은 SDK v1/)).not.toBeInTheDocument();
    }
    fireEvent.change(screen.getByLabelText('완료 이벤트'), {
      target: { value: 'project_reflection_submitted' },
    });
    fireEvent.click(screen.getByLabelText('Placement 즉시 활성화'));
    fireEvent.change(screen.getByLabelText('Placement 키'), {
      target: { value: 'project-detail-home-reflection-cta' },
    });
    fireEvent.change(screen.getByLabelText('UI ID'), {
      target: { value: 's12-mid-reflection-banner' },
    });
    fireEvent.change(screen.getByLabelText('제목'), {
      target: { value: '중간 회고 작성하기' },
    });
    fireEvent.change(screen.getByLabelText('이동 URL payload'), {
      target: { value: '/reflection/s12-mid-reflection' },
    });
    fireEvent.change(screen.getByLabelText('설명'), {
      target: { value: '지금까지의 여정을 정리하고 남은 기간 방향을 잡아봐요' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '생성' }));
    });

    expect(experimentApi.create).toHaveBeenCalledWith(expect.objectContaining({
      id: 's12-mid-reflection',
      name: '12기 중간 회고',
      primary_metric: 'project_reflection_submitted',
      completion_event: 'project_reflection_submitted',
      experiment_type: experimentType,
      cohort_id: '12',
      start_at: expect.any(String),
      end_at: expect.any(String),
    }));
    expect(experimentPlacementApi.create).toHaveBeenCalledWith(
      's12-mid-reflection',
      expect.objectContaining({
        placement_key: 'project-detail-home-reflection-cta',
        ui_id: 's12-mid-reflection-banner',
        ui_type: 'banner',
        title: '중간 회고 작성하기',
        target_url: '/reflection/s12-mid-reflection',
        source: 'unknown',
        target_cohort: '*',
        allowed_roles: [],
        enabled: true,
      }),
    );
    expect(vi.mocked(experimentApi.create).mock.calls[0][0]).not.toHaveProperty('event_model');
    expect(onCreated).toHaveBeenCalled();
  });
  it('creates a minimal draft without an initial placement and returns its identity', async () => {
    const onCreated = vi.fn();
    render(<CreateExperimentModal lang="en" onClose={vi.fn()} onCreated={onCreated} />);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('New Experiment');
    const advanced = screen.getByText('Measurement and delivery settings (optional)').closest('details');
    expect(advanced).not.toHaveAttribute('open');
    fireEvent.change(screen.getByPlaceholderText('e.g. Button Color Test'), { target: { value: 'Signup hypothesis' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create' })); });
    expect(experimentApi.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Signup hypothesis', primary_metric: undefined }));
    expect(experimentPlacementApi.create).not.toHaveBeenCalled();
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 's12-mid-reflection' }));
  });

  it('uses the selected project and its experiment type for the initial draft', async () => {
    vi.mocked(useProject).mockReturnValue({ currentProject: { id: 'selected', project_type: 'ab_test' } } as any);
    render(<CreateExperimentModal lang="en" onClose={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Button Color Test'), { target: { value: 'Project experiment' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create' })); });
    expect(experimentApi.create).toHaveBeenCalledWith(expect.objectContaining({ project_id: 'selected', experiment_type: 'ab_test', variants: [{ name: 'control', traffic_ratio: 0.5 }, { name: 'treatment', traffic_ratio: 0.5 }] }));
    expect(vi.mocked(experimentApi.create).mock.calls[0][0]).not.toHaveProperty('event_model');
  });

  it('creates the automatic flag in the same owned project as the experiment', async () => {
    vi.mocked(useProject).mockReturnValue({ currentProject: { id: 'selected', project_type: 'ab_test' } } as any);
    render(<CreateExperimentModal lang="en" isAdmin={false} onClose={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Button Color Test'), { target: { value: 'Project experiment' } });
    fireEvent.click(screen.getByText('Measurement and delivery settings (optional)'));
    fireEvent.click(screen.getByRole('button', { name: 'Auto-generate' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create' })); });
    expect(featureFlagApi.create).toHaveBeenCalledWith(expect.objectContaining({ flag_key: 'project', project_id: 'selected', enabled: false, rollout_pct: 0 }));
    expect(experimentApi.create).toHaveBeenCalledWith(expect.objectContaining({ flag_key: 'project-experiment', project_id: 'selected', event_model: 'sdk_v1' }));
  });

  it.each(['ko', 'en'] as const)('uses v1 for an existing A/B flag and explains explicit exposure in %s', async (lang) => {
    vi.mocked(useProject).mockReturnValue({ currentProject: { id: 'selected', project_type: 'ab_test' } } as any);
    vi.mocked(featureFlagApi.list).mockResolvedValueOnce([{ flag_key: 'existing-flag' }] as any);
    render(<CreateExperimentModal lang={lang} isAdmin={false} onClose={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(lang === 'ko' ? '예: 버튼 색상 테스트' : 'e.g. Button Color Test'), { target: { value: 'Existing flag experiment' } });
    fireEvent.click(screen.getByText(lang === 'ko' ? '수집·노출 세부 설정 (선택)' : 'Measurement and delivery settings (optional)'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: lang === 'ko' ? '기존 플래그 선택' : 'Select existing' })); });
    fireEvent.keyDown(screen.getByRole('combobox', { name: /feature flag/i }), { key: 'ArrowDown' });
    await act(async () => { fireEvent.click(screen.getByRole('option', { name: 'existing-flag' })); });
    expect(screen.getByText(/decide\(\).*expose\(\).*track\(\)/)).toHaveTextContent(lang === 'ko' ? '기존 실험은 유지됩니다.' : 'Existing experiments are unchanged.');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: lang === 'ko' ? '생성' : 'Create' })); });
    expect(experimentApi.create).toHaveBeenCalledWith(expect.objectContaining({ flag_key: 'existing-flag', event_model: 'sdk_v1' }));
    expect(featureFlagApi.create).not.toHaveBeenCalled();
  });

  it('keeps the legacy model for a rollout even when a flag is generated', async () => {
    vi.mocked(useProject).mockReturnValue({ currentProject: { id: 'selected', project_type: 'rollout' } } as any);
    render(<CreateExperimentModal lang="en" onClose={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Button Color Test'), { target: { value: 'Rollout experiment' } });
    fireEvent.click(screen.getByText('Measurement and delivery settings (optional)'));
    fireEvent.click(screen.getByRole('button', { name: 'Auto-generate' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create' })); });
    expect(experimentApi.create).toHaveBeenCalledWith(expect.objectContaining({ experiment_type: 'rollout', flag_key: 'project-experiment' }));
    expect(vi.mocked(experimentApi.create).mock.calls[0][0]).not.toHaveProperty('event_model');
  });

  it.each([
    ['ko', 409, '이미 사용 중인 Flag Key입니다. 다른 키를 입력하세요.'],
    ['en', 404, 'The selected project is unavailable. Select a project you own and try again.'],
  ] as const)('explains automatic flag failure in %s and stops experiment creation', async (lang, status, message) => {
    vi.mocked(useProject).mockReturnValue({ currentProject: { id: 'selected', project_type: 'ab_test' } } as any);
    vi.mocked(featureFlagApi.create).mockRejectedValueOnce(Object.assign(new Error('Failed to create flag'), { status }));
    render(<CreateExperimentModal lang={lang} isAdmin={false} onClose={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(lang === 'ko' ? '예: 버튼 색상 테스트' : 'e.g. Button Color Test'), { target: { value: 'Project experiment' } });
    fireEvent.click(screen.getByText(lang === 'ko' ? '수집·노출 세부 설정 (선택)' : 'Measurement and delivery settings (optional)'));
    fireEvent.click(screen.getByRole('button', { name: lang === 'ko' ? '자동 생성' : 'Auto-generate' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: lang === 'ko' ? '생성' : 'Create' })); });
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(experimentApi.create).not.toHaveBeenCalled();
  });

});

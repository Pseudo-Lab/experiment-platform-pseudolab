import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { CreateExperimentModal } from '@/features/dashboard/components/CreateExperimentModal';
import { experimentApi, experimentPlacementApi } from '@/services/api';

vi.mock('@/services/api', () => ({
  experimentApi: {
    create: vi.fn(),
  },
  experimentPlacementApi: {
    create: vi.fn(),
  },
}));

describe('CreateExperimentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('creates an experiment with an initial LVUP UI slot', async () => {
    const onCreated = vi.fn();

    render(<CreateExperimentModal lang="ko" onClose={vi.fn()} onCreated={onCreated} />);

    fireEvent.change(screen.getByPlaceholderText('예: 버튼 색상 테스트'), {
      target: { value: '12기 중간 회고' },
    });
    fireEvent.change(screen.getByPlaceholderText('예: weekly_session_attended'), {
      target: { value: 'project_reflection_ui_clicked' },
    });
    fireEvent.click(screen.getByLabelText('실험 생성과 함께 LVUP 노출 슬롯 생성'));
    fireEvent.click(screen.getByLabelText('슬롯 즉시 활성화'));
    fireEvent.change(screen.getByLabelText('슬롯 키'), {
      target: { value: 'project-detail-home-reflection-cta' },
    });
    fireEvent.change(screen.getByLabelText('UI ID'), {
      target: { value: 's12-mid-reflection-banner' },
    });
    fireEvent.change(screen.getByLabelText('슬롯 제목'), {
      target: { value: '중간 회고 작성하기' },
    });
    fireEvent.change(screen.getByLabelText('이동 URL'), {
      target: { value: '/reflection/s12-mid-reflection' },
    });
    fireEvent.change(screen.getByLabelText('슬롯 설명'), {
      target: { value: '지금까지의 여정을 정리하고 남은 기간 방향을 잡아봐요' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '생성' }));
    });

    expect(experimentApi.create).toHaveBeenCalledWith(expect.objectContaining({
      name: '12기 중간 회고',
      primary_metric: 'project_reflection_ui_clicked',
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
    expect(onCreated).toHaveBeenCalled();
  });
});

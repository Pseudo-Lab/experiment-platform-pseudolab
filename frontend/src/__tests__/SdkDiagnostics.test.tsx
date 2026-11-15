import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { SdkDiagnostics } from '@/features/dashboard/components/SdkDiagnostics';
import { projectApi, type Experiment, type ProjectSdkDiagnostics } from '@/services/api';

vi.mock('@/services/api', () => ({ projectApi: { sdkStatus: vi.fn() } }));
const experiments = ['one', 'two'].map(id => ({ id, name: `Experiment ${id}`, project_id: 'project' } as Experiment));
const diagnostic: ProjectSdkDiagnostics = {
  experiment_id: 'one', supported: true, source: 'raw', goal_event: 'purchase',
  exposures: 1, actions: 4, included_exposures: 1, included_actions: 1, goal_actions: 1,
  unmatched_actions: 1, outside_window_actions: 1, policy_excluded_events: 1,
};
const response = (data = diagnostic) => ({ project_id: 'project', status: 'connected' as const, diagnostics: data });
const page = (lang: 'ko' | 'en' = 'en') => <SdkDiagnostics projectId="project" experiments={experiments} lang={lang} />;
async function select(name = 'Experiment one') {
  fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
  const option = await screen.findByRole('option', { name });
  await act(async () => { fireEvent.click(option); });
}

beforeEach(() => {
  vi.resetAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  vi.mocked(projectApi.sdkStatus).mockResolvedValue(response());
});
afterEach(cleanup);

it.each(['ko', 'en'] as const)('requires an explicit experiment and explains input, attribution and exclusion in %s', async lang => {
  render(page(lang));
  expect(projectApi.sdkStatus).not.toHaveBeenCalled();
  await select();
  expect(await screen.findByText(lang === 'ko' ? '현재 보존된 원본 기준' : 'Currently retained raw input')).toBeInTheDocument();
  expect(projectApi.sdkStatus).toHaveBeenCalledWith('project', 'one');
  const table = screen.getByRole('table');
  expect(within(table).getByRole('row', { name: lang === 'ko' ? '행동 4 1' : 'Actions 4 1' })).toBeInTheDocument();
  expect(screen.getByText(lang === 'ko' ? '노출에 연결되지 않은 행동' : 'Actions without a matching exposure')).toBeInTheDocument();
  expect(screen.getByText(lang === 'ko' ? '전환 인정 기간 밖 행동' : 'Actions outside the conversion window')).toBeInTheDocument();
  expect(screen.getByText(/tracking_context/)).toBeInTheDocument();
  expect(screen.getByText(lang === 'ko' ? /실제 방문자 여부는 자동 판별하지/ : /real visitors are not identified automatically/)).toBeInTheDocument();
});

it.each(['ko', 'en'] as const)('shows storage errors as errors and can retry in %s', async lang => {
  vi.mocked(projectApi.sdkStatus).mockRejectedValueOnce(new Error('503')).mockResolvedValueOnce(response());
  render(page(lang));
  await select();
  expect(await screen.findByRole('alert')).toHaveTextContent(lang === 'ko' ? '불러오지 못했습니다' : 'Could not load');
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: lang === 'ko' ? '다시 시도' : 'Retry' }));
  expect(await screen.findByRole('table')).toBeInTheDocument();
});

it('ignores an old experiment response after selecting another experiment', async () => {
  let resolve!: (value: ReturnType<typeof response>) => void;
  vi.mocked(projectApi.sdkStatus).mockReturnValueOnce(new Promise(r => { resolve = r; }))
    .mockResolvedValueOnce(response({ ...diagnostic, experiment_id: 'two', goal_event: 'second-goal' }));
  render(page());
  await select();
  await select('Experiment two');
  expect(await screen.findByText('second-goal')).toBeInTheDocument();
  await act(async () => resolve(response()));
  expect(screen.queryByText('purchase')).not.toBeInTheDocument();
  expect(screen.getByText('second-goal')).toBeInTheDocument();
});

it.each(['missing', 'wrong-project', 'wrong-experiment'])('does not display mismatched or incomplete responses: %s', async mode => {
  vi.mocked(projectApi.sdkStatus).mockResolvedValue(mode === 'missing'
    ? { project_id: 'project', status: 'connected' }
    : mode === 'wrong-project' ? { ...response(), project_id: 'other' }
    : response({ ...diagnostic, experiment_id: 'other' }));
  render(page());
  await select();
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it('labels frozen inputs and does not claim they are all received records', async () => {
  vi.mocked(projectApi.sdkStatus).mockResolvedValue(response({ ...diagnostic, source: 'snapshot' }));
  render(page());
  await select();
  expect(await screen.findByText('Sealed input')).toBeInTheDocument();
  expect(screen.getByText(/Later arrivals and some records rejected before freezing are not part/)).toBeInTheDocument();
});

it('shows unsupported history without pretending zero is a successful diagnosis', async () => {
  vi.mocked(projectApi.sdkStatus).mockResolvedValue(response({ ...diagnostic, source: 'unsupported', supported: false }));
  render(page());
  await select();
  expect(await screen.findByText(/Detailed diagnostics are unavailable/)).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it('gives a concrete recovery action for empty input', async () => {
  vi.mocked(projectApi.sdkStatus).mockResolvedValue(response({ ...diagnostic,
    exposures: 0, actions: 0, included_exposures: 0, included_actions: 0, goal_actions: 0,
    unmatched_actions: 0, outside_window_actions: 0, policy_excluded_events: 0,
  }));
  render(page());
  await select();
  expect(await screen.findByText(/No SDK input records are available/)).toHaveTextContent('expose()');
});

it('clears selection when the project component is replaced', async () => {
  const view = render(<SdkDiagnostics key="project" projectId="project" experiments={experiments} lang="en" />);
  await select();
  await screen.findByRole('table');
  view.rerender(<SdkDiagnostics key="other" projectId="other" experiments={[]} lang="en" />);
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.getByRole('combobox')).toBeDisabled();
  expect(projectApi.sdkStatus).toHaveBeenCalledTimes(1);
});

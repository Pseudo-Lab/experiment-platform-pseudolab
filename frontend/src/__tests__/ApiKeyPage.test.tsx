import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ApiKeyPage } from '@/features/dashboard/components/ApiKeyPage';
import { useProject } from '@/contexts/ProjectContext';
import { experimentApi, projectApi } from '@/services/api';

vi.mock('@/contexts/ProjectContext', () => ({ useProject: vi.fn() }));
vi.mock('@/services/api', () => ({
  projectApi: { getApiKey: vi.fn(), sdkStatus: vi.fn() },
  experimentApi: { list: vi.fn() },
}));
const project = (id: string) => ({ id, name: id, project_type: 'ab_test' as const, created_at: '2026-10-26' });
const select = (id: string | null) => vi.mocked(useProject).mockReturnValue({
  currentProject: id ? project(id) : null, reloadProjects: vi.fn(),
} as any);
function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}
const page = (lang: 'ko' | 'en' = 'en') => (
  <MemoryRouter initialEntries={['/api-key']}>
    <Routes>
      <Route path="/api-key" element={<ApiKeyPage lang={lang} />} />
      <Route path="/experiments/:id" element={<div>Experiment detail</div>} />
      <Route path="/projects" element={<div>Project list</div>} />
    </Routes>
    <LocationProbe />
  </MemoryRouter>
);

beforeEach(() => {
  vi.resetAllMocks();
  select('first');
  vi.mocked(projectApi.sdkStatus).mockResolvedValue({ project_id: 'first', status: 'not_connected' });
  vi.mocked(experimentApi.list).mockResolvedValue([]);
});
afterEach(cleanup);

it.each(['ko', 'en'] as const)('does not request a key without a selected project and points to the sidebar project list in %s', (lang) => {
  select(null);
  render(page(lang));
  expect(screen.getByRole('heading', { name: lang === 'ko' ? '프로젝트를 선택하세요' : 'Select a Project' })).toBeInTheDocument();
  expect(screen.getByText(lang === 'ko' ? /사이드바의 프로젝트 목록/ : /project list in the sidebar/)).toBeInTheDocument();
  expect(screen.queryByText(lang === 'ko' ? /드롭다운/ : /dropdown/i)).not.toBeInTheDocument();
  expect(projectApi.getApiKey).not.toHaveBeenCalled();
});

it.each(['ko', 'en'] as const)('shows loading, failure, retry and masked key in %s without duplicate base_url or delete controls', async (lang) => {
  let reject!: (reason: Error) => void;
  vi.mocked(projectApi.getApiKey).mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }))
    .mockResolvedValueOnce({ api_key: 'test-key-first' });
  vi.mocked(projectApi.sdkStatus).mockResolvedValue({ project_id: 'first', status: 'connected' });
  vi.mocked(experimentApi.list).mockResolvedValue([
    { id: 'exp-1', name: 'Hero Copy Test', experiment_type: 'ab_test', project_id: 'first', status: 'running' } as any,
    { id: 'exp-other', name: 'Other Project Test', experiment_type: 'ab_test', project_id: 'second', status: 'running' } as any,
  ]);
  render(page(lang));
  expect(screen.getByRole('status')).toHaveTextContent(lang === 'ko' ? '키를 불러오는 중' : 'Loading key');
  await act(async () => reject(new Error('unavailable')));
  expect(screen.getByRole('alert')).toHaveTextContent(lang === 'ko' ? '키를 불러오지 못했습니다' : 'Failed to load key');
  fireEvent.click(screen.getByRole('button', { name: lang === 'ko' ? '다시 시도' : 'Retry' }));
  const reveal = await screen.findByRole('button', { name: lang === 'ko' ? '보기' : 'Reveal' });
  expect(screen.queryByText('test-key-first')).not.toBeInTheDocument();
  fireEvent.click(reveal);
  expect(screen.getByText('test-key-first')).toBeInTheDocument();
  expect(projectApi.getApiKey).toHaveBeenCalledWith('first');

  // Preserves SDK status & scoped A/B experiments while removing base_url/delete controls
  expect(screen.getByText(lang === 'ko' ? '연결됨' : 'Connected')).toBeInTheDocument();
  expect(screen.getByText('Hero Copy Test')).toBeInTheDocument();
  expect(screen.queryByText('Other Project Test')).not.toBeInTheDocument();
  expect(screen.queryByText('Danger Zone')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: lang === 'ko' ? '프로젝트 삭제' : 'Delete Project' })).not.toBeInTheDocument();
  expect(screen.queryByText(lang === 'ko' ? '앱 도메인' : 'App Domain')).not.toBeInTheDocument();

  fireEvent.click(screen.getByText('Hero Copy Test'));
  expect(screen.getByTestId('location')).toHaveTextContent('/experiments/exp-1');
});

it('clears the previous key and ignores stale key/status/experiment responses after project switch', async () => {
  let resolveFirstKey!: (value: { api_key: string }) => void;
  let resolveFirstStatus!: (value: { project_id: string; status: 'connected' | 'not_connected' }) => void;
  let resolveFirstExps!: (value: any[]) => void;

  vi.mocked(projectApi.getApiKey)
    .mockReturnValueOnce(new Promise(resolve => { resolveFirstKey = resolve; }))
    .mockResolvedValueOnce({ api_key: 'test-key-second' });
  vi.mocked(projectApi.sdkStatus)
    .mockReturnValueOnce(new Promise(resolve => { resolveFirstStatus = resolve; }))
    .mockResolvedValueOnce({ project_id: 'second', status: 'not_connected' });
  vi.mocked(experimentApi.list)
    .mockReturnValueOnce(new Promise(resolve => { resolveFirstExps = resolve; }))
    .mockResolvedValueOnce([]);

  const view = render(page());
  select('second');
  view.rerender(page());
  fireEvent.click(await screen.findByRole('button', { name: 'Reveal' }));
  expect(screen.getByText('test-key-second')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText('Awaiting connection')).toBeInTheDocument());

  await act(async () => {
    resolveFirstKey({ api_key: 'test-key-first' });
    resolveFirstStatus({ project_id: 'first', status: 'connected' });
    resolveFirstExps([{ id: 'exp-stale', name: 'Stale Exp', experiment_type: 'ab_test', project_id: 'second', status: 'running' }]);
  });

  expect(screen.queryByText('test-key-first')).not.toBeInTheDocument();
  expect(screen.getByText('test-key-second')).toBeInTheDocument();
  expect(screen.getByText('Awaiting connection')).toBeInTheDocument();
  expect(screen.queryByText('Stale Exp')).not.toBeInTheDocument();

  select(null);
  view.rerender(page());
  await waitFor(() => expect(screen.queryByText('test-key-second')).not.toBeInTheDocument());
});

it.each(['ko', 'en'] as const)('does not fetch SDK keys, status, or experiments for a viewer in %s', lang => {
  vi.mocked(useProject).mockReturnValue({ currentProject: { ...project('shared'), access_role: 'viewer' }, reloadProjects: vi.fn() } as any);
  render(page(lang));
  expect(screen.getByText(lang === 'ko' ? '조회자는 SDK 키를 볼 수 없습니다. 소유자에게 편집 권한을 요청하세요.' : 'Viewers cannot access SDK keys. Ask the owner for editor access.')).toBeInTheDocument();
  expect(projectApi.getApiKey).not.toHaveBeenCalled();
  expect(projectApi.sdkStatus).not.toHaveBeenCalled();
  expect(experimentApi.list).not.toHaveBeenCalled();
});

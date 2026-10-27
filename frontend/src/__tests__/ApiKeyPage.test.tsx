import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
const page = (lang: 'ko' | 'en' = 'en') => <MemoryRouter><ApiKeyPage lang={lang} /></MemoryRouter>;

beforeEach(() => {
  vi.resetAllMocks();
  select('first');
  vi.mocked(projectApi.sdkStatus).mockResolvedValue({ project_id: 'first', status: 'not_connected' });
  vi.mocked(experimentApi.list).mockResolvedValue([]);
});
afterEach(cleanup);

it('does not request a key without a selected project', () => {
  select(null);
  render(page());
  expect(screen.getByRole('heading', { name: 'Select a Project' })).toBeInTheDocument();
  expect(projectApi.getApiKey).not.toHaveBeenCalled();
});

it.each(['ko', 'en'] as const)('shows loading, failure, retry and masked key in %s', async (lang) => {
  let reject!: (reason: Error) => void;
  vi.mocked(projectApi.getApiKey).mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }))
    .mockResolvedValueOnce({ api_key: 'test-key-first' });
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
});

it('clears the previous key immediately and ignores a late response after project switch', async () => {
  let resolveFirst!: (value: { api_key: string }) => void;
  vi.mocked(projectApi.getApiKey).mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve; }))
    .mockResolvedValueOnce({ api_key: 'test-key-second' });
  const view = render(page());
  select('second');
  view.rerender(page());
  fireEvent.click(await screen.findByRole('button', { name: 'Reveal' }));
  expect(screen.getByText('test-key-second')).toBeInTheDocument();
  await act(async () => resolveFirst({ api_key: 'test-key-first' }));
  expect(screen.queryByText('test-key-first')).not.toBeInTheDocument();
  expect(screen.getByText('test-key-second')).toBeInTheDocument();
  select(null);
  view.rerender(page());
  await waitFor(() => expect(screen.queryByText('test-key-second')).not.toBeInTheDocument());
});

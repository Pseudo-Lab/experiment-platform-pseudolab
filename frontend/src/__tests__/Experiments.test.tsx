import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Experiments } from '@/features/dashboard/components/Experiments';
import { experimentApi } from '@/services/api';

vi.mock('@/services/api', () => ({
  experimentApi: { list: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/contexts/ProjectContext', () => ({
  useProject: () => ({
    currentProjectId: 'mine',
    currentProject: { name: 'My project' },
  }),
}));
const examples = [
  {
    id: 'draft',
    name: 'Draft experiment',
    status: 'draft',
    project_id: 'mine',
  },
  {
    id: 'running',
    name: 'Running experiment',
    status: 'running',
    project_id: 'mine',
  },
  {
    id: 'other',
    name: 'Other experiment',
    status: 'running',
    project_id: 'other',
  },
].map((exp) => ({ ...exp, created_at: '2026-10-21T00:00:00Z', variants: [] }));
const setup = () =>
  render(
    <MemoryRouter>
      <Experiments lang="en" />
    </MemoryRouter>,
  );
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(experimentApi.list).mockResolvedValue(examples as any);
});
afterEach(cleanup);

it('scopes status counts to the selected project and filters without changing the total', async () => {
  setup();
  await screen.findAllByText('Draft experiment');
  const counts = screen.getByRole('group', { name: 'All Status' });
  expect(
    within(counts).getByRole('button', { name: 'All experiments 2' }),
  ).toBeInTheDocument();
  fireEvent.click(within(counts).getByRole('button', { name: 'Running 1' }));
  expect(screen.queryByText('Draft experiment')).not.toBeInTheDocument();
  expect(screen.queryByText('Other experiment')).not.toBeInTheDocument();
  expect(
    screen.getAllByRole('link', { name: 'Check collection' })[0],
  ).toHaveAttribute('href', '/experiments/running?view=health');
  expect(experimentApi.list).toHaveBeenCalledTimes(1);
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Search experiments...' }),
    { target: { value: 'missing' } },
  );
  expect(
    screen.getByText('No experiments match these filters.'),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getAllByText('Draft experiment').length).toBeGreaterThan(0);
});

it('shows retry instead of zero totals or an empty list on failure', async () => {
  vi.mocked(experimentApi.list).mockRejectedValueOnce(new Error('503'));
  setup();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Failed to load experiments',
  );
  expect(screen.queryByText('No experiments found.')).not.toBeInTheDocument();
  const counts = screen.getByRole('group', { name: 'All Status' });
  expect(
    within(counts).getByRole('button', { name: 'All experiments —' }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(
    (await screen.findAllByText('Draft experiment')).length,
  ).toBeGreaterThan(0);
});

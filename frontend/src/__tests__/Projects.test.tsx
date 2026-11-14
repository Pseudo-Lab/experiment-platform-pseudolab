import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Projects } from '@/features/dashboard/components/Projects';
import { useProject } from '@/contexts/ProjectContext';
import { projectApi, type Project } from '@/services/api';

vi.mock('@/services/api', () => ({
  projectApi: { create: vi.fn(), sdkStatus: vi.fn() },
  projectSharingApi: { preview: vi.fn(), accept: vi.fn() },
}));
vi.mock('@/contexts/ProjectContext', () => ({ useProject: vi.fn() }));

function RouteLocation() {
  const loc = useLocation();
  return <output data-testid="location">{loc.pathname + loc.search}</output>;
}

const makeProject = (id: string, name: string, access_role?: Project['access_role']): Project => ({
  id,
  name,
  project_type: 'ab_test',
  created_at: '2026-11-15',
  access_role,
});

const reloadMock = vi.fn();
const selectMock = vi.fn();

function setProjectsContext(projects: Project[] = []) {
  vi.mocked(useProject).mockReturnValue({
    projects,
    loading: false,
    error: false,
    reloadProjects: reloadMock,
    setCurrentProjectId: selectMock,
  } as any);
}

function show(path: string, lang: 'ko' | 'en' = 'ko') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/projects" element={<Projects lang={lang} />} />
        <Route path="/experiments" element={<div>Experiments page</div>} />
      </Routes>
      <RouteLocation />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  reloadMock.mockResolvedValue(undefined);
  vi.mocked(projectApi.sdkStatus).mockResolvedValue({ project_id: 'p1', status: 'not_connected' });
  setProjectsContext([]);
});
afterEach(cleanup);

it('opens the existing create form directly and removes only its query on cancel', () => {
  show('/projects?create=1&keep=yes');
  expect(screen.getByLabelText('프로젝트 이름')).toBeInTheDocument();
  expect(screen.getByLabelText('프로젝트 이름')).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: '취소' }));
  expect(screen.queryByLabelText('프로젝트 이름')).not.toBeInTheDocument();
  expect(screen.getByTestId('location')).toHaveTextContent('/projects?keep=yes');
});

it('opens directory without the form and allows adding a project in English', () => {
  show('/projects', 'en');
  expect(screen.getByRole('heading', { name: 'Project list' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Project Name')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add Project' }));
  expect(screen.getByLabelText('Project Name')).toBeInTheDocument();
  expect(screen.getByLabelText('Project Name')).toHaveFocus();
});

it('keeps the form on failure, closes it after a successful retry, and explicitly selects the created project', async () => {
  vi.mocked(projectApi.create).mockRejectedValueOnce(new Error('Create failed')).mockResolvedValueOnce({ id: 'new-app' } as any);
  show('/projects?create=1');
  fireEvent.change(screen.getByLabelText('프로젝트 이름'), { target: { value: 'New App' } });
  fireEvent.click(screen.getByRole('button', { name: '생성' }));
  expect(await screen.findByText('Create failed')).toBeInTheDocument();
  expect(projectApi.create).toHaveBeenCalledWith({ name: 'New App' });
  expect(screen.queryByLabelText('프로젝트 ID')).not.toBeInTheDocument();
  expect(screen.getByLabelText('프로젝트 이름')).toHaveValue('New App');
  fireEvent.click(screen.getByRole('button', { name: '생성' }));
  await waitFor(() => expect(selectMock).toHaveBeenCalledWith('new-app'));
  expect(screen.getByTestId('location')).toHaveTextContent('/experiments');
});

it.each(['ko', 'en'] as const)('filters projects by name and ID, clears search, and omits inline sharing or delete admin actions in %s', async (lang) => {
  setProjectsContext([
    makeProject('alpha-id', 'Alpha Store', 'owner'),
    makeProject('beta-id', 'Beta Checkout', 'editor'),
    makeProject('gamma-id', 'Gamma Docs', 'viewer'),
  ]);

  show('/projects', lang);

  // Admin actions must not appear in directory
  expect(screen.queryByRole('button', { name: lang === 'ko' ? '공유·멤버 관리' : 'Sharing and members' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: lang === 'ko' ? '삭제' : 'Delete' })).not.toBeInTheDocument();

  const searchInput = screen.getByRole('searchbox', { name: lang === 'ko' ? '프로젝트 검색' : 'Search projects' });

  // Match by project name
  fireEvent.change(searchInput, { target: { value: 'checkout' } });
  expect(screen.getByText('Beta Checkout')).toBeInTheDocument();
  expect(screen.queryByText('Alpha Store')).not.toBeInTheDocument();
  expect(screen.queryByText('Gamma Docs')).not.toBeInTheDocument();

  // Match by project ID
  fireEvent.change(searchInput, { target: { value: 'gamma-id' } });
  expect(screen.getByText('Gamma Docs')).toBeInTheDocument();
  expect(screen.queryByText('Beta Checkout')).not.toBeInTheDocument();

  // Empty search result + clear button
  fireEvent.change(searchInput, { target: { value: 'missing-project' } });
  expect(screen.getByText(lang === 'ko' ? '검색 조건에 맞는 프로젝트가 없습니다.' : 'No projects match your search.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: lang === 'ko' ? '검색 초기화' : 'Clear search' }));
  expect(screen.getByText('Alpha Store')).toBeInTheDocument();
  expect(screen.getByText('Beta Checkout')).toBeInTheDocument();
  expect(screen.getByText('Gamma Docs')).toBeInTheDocument();

  // Selecting a project updates selection and navigates to experiments
  fireEvent.click(screen.getByRole('button', { name: 'Alpha Store' }));
  expect(selectMock).toHaveBeenCalledWith('alpha-id');
  expect(screen.getByTestId('location')).toHaveTextContent('/experiments');
});

it('guards stale create completion after unmount without mutating selection or navigation', async () => {
  let resolveCreate!: (value: Project) => void;
  vi.mocked(projectApi.create).mockReturnValueOnce(new Promise((res) => { resolveCreate = res; }));
  const ui = show('/projects?create=1', 'en');
  fireEvent.change(screen.getByLabelText('Project Name'), { target: { value: 'Stale App' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  ui.unmount();

  await act(async () => {
    resolveCreate(makeProject('stale-app', 'Stale App'));
  });

  expect(reloadMock).not.toHaveBeenCalled();
  expect(selectMock).not.toHaveBeenCalled();
});

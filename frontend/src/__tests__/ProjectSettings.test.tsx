import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ProjectSettings } from '@/features/dashboard/components/ProjectSettings';
import { useProject } from '@/contexts/ProjectContext';
import { projectApi, projectSharingApi, type Project } from '@/services/api';

vi.mock('@/contexts/ProjectContext', () => ({ useProject: vi.fn() }));
vi.mock('@/services/api', () => ({
  projectApi: { patch: vi.fn(), delete: vi.fn() },
  projectSharingApi: {
    members: vi.fn(),
    invitations: vi.fn(),
    invite: vi.fn(),
    revoke: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'alpha',
  name: 'Alpha App',
  base_url: 'https://alpha.example.invalid',
  project_type: 'ab_test',
  created_at: '2026-11-15',
  access_role: 'owner',
  ...overrides,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderSettings(lang: 'ko' | 'en' = 'en') {
  return render(
    <MemoryRouter initialEntries={['/project-settings']}>
      <Routes>
        <Route path="/project-settings" element={<ProjectSettings lang={lang} />} />
        <Route path="/projects" element={<div>Projects destination</div>} />
        <Route path="/experiments" element={<div>Experiments destination</div>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

const reloadMock = vi.fn();
const selectMock = vi.fn();

function mockContext(project: Project | null) {
  vi.mocked(useProject).mockReturnValue({
    projects: project ? [project] : [],
    loading: false,
    error: false,
    currentProjectId: project?.id ?? null,
    currentProject: project,
    reloadProjects: reloadMock,
    setCurrentProjectId: selectMock,
  } as any);
}

beforeEach(() => {
  vi.resetAllMocks();
  reloadMock.mockResolvedValue(undefined);
  vi.mocked(projectSharingApi.members).mockResolvedValue([{ account_id: 'owner-1', role: 'owner', display_name: 'Owner' }]);
  vi.mocked(projectSharingApi.invitations).mockResolvedValue([]);
  mockContext(makeProject());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it.each(['ko', 'en'] as const)('renders project prompt without requesting member or profile data when currentProject is null in %s', (lang) => {
  mockContext(null);
  renderSettings(lang);
  expect(screen.getByRole('heading', { name: lang === 'ko' ? '프로젝트를 선택하세요' : 'Select a Project' })).toBeInTheDocument();
  expect(projectSharingApi.members).not.toHaveBeenCalled();
  expect(projectSharingApi.invitations).not.toHaveBeenCalled();
  expect(projectApi.patch).not.toHaveBeenCalled();
  expect(projectApi.delete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: lang === 'ko' ? '프로젝트 목록으로' : 'Go to project list' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/projects');
});

it.each([
  ['viewer', 'ko'],
  ['viewer', 'en'],
  ['editor', 'ko'],
  ['editor', 'en'],
] as const)('blocks %s access without calling member/invitation or mutation APIs in %s', (role, lang) => {
  mockContext(makeProject({ id: 'shared', name: 'Shared', access_role: role }));
  renderSettings(lang);
  expect(screen.getByRole('alert')).toHaveTextContent(lang === 'ko' ? '소유자만 접근할 수 있습니다' : 'Owner access required');
  expect(screen.queryByLabelText(lang === 'ko' ? '고객 앱 URL' : 'Customer app URL')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: lang === 'ko' ? '프로젝트 삭제' : 'Delete Project' })).not.toBeInTheDocument();
  expect(projectSharingApi.members).not.toHaveBeenCalled();
  expect(projectSharingApi.invitations).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: lang === 'ko' ? '실험 관리로' : 'Back to experiments' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/experiments');
});

it.each([
  ['owner', 'ko'],
  ['owner', 'en'],
  [undefined, 'ko'],
  [undefined, 'en'],
] as const)('renders unified settings and embedded ProjectSharing without Close button for %s role in %s', async (role, lang) => {
  mockContext(makeProject({ access_role: role }));
  renderSettings(lang);
  expect(screen.getByRole('heading', { name: lang === 'ko' ? '프로젝트 설정' : 'Project settings' })).toBeInTheDocument();
  expect(screen.getByLabelText(lang === 'ko' ? '고객 앱 URL' : 'Customer app URL')).toHaveValue('https://alpha.example.invalid');
  expect(await screen.findByRole('button', { name: lang === 'ko' ? '이메일로 초대' : 'Invite by email' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: lang === 'ko' ? '닫기' : 'Close' })).not.toBeInTheDocument();
  expect(projectSharingApi.members).toHaveBeenCalledWith('alpha');
  expect(projectSharingApi.invitations).toHaveBeenCalledWith('alpha');
  expect(screen.getByRole('button', { name: lang === 'ko' ? '프로젝트 삭제' : 'Delete Project' })).toBeEnabled();
});

it.each(['ko', 'en'] as const)('validates, saves, clears, and reports errors for customer app base_url in %s', async (lang) => {
  vi.mocked(projectApi.patch)
    .mockRejectedValueOnce(new Error('Failed to update project'))
    .mockResolvedValueOnce(makeProject({ base_url: 'https://updated.example.invalid' }))
    .mockResolvedValueOnce(makeProject({ base_url: null }));

  renderSettings(lang);
  const input = screen.getByLabelText(lang === 'ko' ? '고객 앱 URL' : 'Customer app URL');
  const saveBtn = screen.getByRole('button', { name: lang === 'ko' ? '저장' : 'Save' });

  // Invalid scheme rejected client-side
  fireEvent.change(input, { target: { value: 'javascript:alert(1)' } });
  fireEvent.click(saveBtn);
  expect(screen.getByRole('alert')).toHaveTextContent(lang === 'ko' ? 'http:// 또는 https://' : 'http:// or https://');
  expect(projectApi.patch).not.toHaveBeenCalled();

  // Valid URL save failure keeps input and shows error
  fireEvent.change(input, { target: { value: 'https://updated.example.invalid' } });
  fireEvent.click(saveBtn);
  expect(await screen.findByRole('alert')).toHaveTextContent(lang === 'ko' ? '앱 도메인을 저장하지 못했습니다.' : 'Failed to save app domain.');
  expect(input).toHaveValue('https://updated.example.invalid');

  // Retry succeeds and triggers reloadProjects
  fireEvent.click(saveBtn);
  await waitFor(() => expect(projectApi.patch).toHaveBeenLastCalledWith('alpha', { base_url: 'https://updated.example.invalid' }));
  expect(await screen.findByRole('status')).toHaveTextContent(lang === 'ko' ? '앱 도메인을 저장했습니다.' : 'App domain saved.');
  expect(reloadMock).toHaveBeenCalledTimes(1);

  // Clearing input sends base_url: null
  fireEvent.change(input, { target: { value: '   ' } });
  fireEvent.click(saveBtn);
  await waitFor(() => expect(projectApi.patch).toHaveBeenLastCalledWith('alpha', { base_url: null }));
  expect(input).toHaveValue('');
});

it('keeps UI coherent when reloadProjects refreshes currentProject base_url without clobbering dirty edits', async () => {
  const ui = render(
    <MemoryRouter initialEntries={['/project-settings']}>
      <ProjectSettings lang="en" />
    </MemoryRouter>,
  );
  await screen.findByRole('button', { name: 'Invite by email' });
  const input = screen.getByLabelText('Customer app URL');
  expect(input).toHaveValue('https://alpha.example.invalid');

  // Context refresh updates clean input
  mockContext(makeProject({ base_url: 'https://refreshed.example.invalid' }));
  ui.rerender(
    <MemoryRouter initialEntries={['/project-settings']}>
      <ProjectSettings lang="en" />
    </MemoryRouter>,
  );
  expect(input).toHaveValue('https://refreshed.example.invalid');

  // Dirty user edits are preserved across context refresh
  fireEvent.change(input, { target: { value: 'https://draft.example.invalid' } });
  mockContext(makeProject({ base_url: 'https://server-later.example.invalid' }));
  ui.rerender(
    <MemoryRouter initialEntries={['/project-settings']}>
      <ProjectSettings lang="en" />
    </MemoryRouter>,
  );
  expect(input).toHaveValue('https://draft.example.invalid');
});

it.each(['ko', 'en'] as const)('handles delete confirmation, linked-resource refusal, and successful deletion in %s', async (lang) => {
  const confirmSpy = vi.spyOn(window, 'confirm');
  confirmSpy.mockReturnValueOnce(false).mockReturnValueOnce(true).mockReturnValueOnce(true);
  vi.mocked(projectApi.delete)
    .mockRejectedValueOnce(new Error("Cannot delete project 'alpha': referenced by one or more experiments"))
    .mockResolvedValueOnce(undefined);

  renderSettings(lang);
  const deleteBtn = screen.getByRole('button', { name: lang === 'ko' ? '프로젝트 삭제' : 'Delete Project' });

  // Cancel confirmation
  fireEvent.click(deleteBtn);
  expect(projectApi.delete).not.toHaveBeenCalled();

  // Linked resource refusal displays error and keeps selection/route
  fireEvent.click(deleteBtn);
  expect(await screen.findByRole('alert')).toHaveTextContent('referenced by one or more experiments');
  expect(reloadMock).not.toHaveBeenCalled();
  expect(selectMock).not.toHaveBeenCalled();
  expect(screen.getByTestId('location')).toHaveTextContent('/project-settings');

  // Confirmed deletion refreshes context, clears selection, and navigates to /projects
  fireEvent.click(deleteBtn);
  await waitFor(() => expect(projectApi.delete).toHaveBeenCalledWith('alpha'));
  await waitFor(() => expect(reloadMock).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(selectMock).toHaveBeenCalledWith(null));
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/projects'));
});

it('guards stale base_url patch completion across project switch without clobbering the new project', async () => {
  const req = deferred<Project>();
  vi.mocked(projectApi.patch).mockReturnValueOnce(req.promise);

  const ui = render(
    <MemoryRouter initialEntries={['/project-settings']}>
      <ProjectSettings lang="en" />
    </MemoryRouter>,
  );

  const input = screen.getByLabelText('Customer app URL');
  fireEvent.change(input, { target: { value: 'https://alpha-late.example.invalid' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));

  mockContext(makeProject({ id: 'beta', name: 'Beta App', base_url: 'https://beta.example.invalid' }));
  ui.rerender(
    <MemoryRouter initialEntries={['/project-settings']}>
      <ProjectSettings lang="en" />
    </MemoryRouter>,
  );

  expect(screen.getByLabelText('Customer app URL')).toHaveValue('https://beta.example.invalid');

  await act(async () => {
    req.resolve(makeProject({ id: 'alpha', base_url: 'https://alpha-late.example.invalid' }));
  });

  expect(screen.getByLabelText('Customer app URL')).toHaveValue('https://beta.example.invalid');
  expect(screen.queryByText('App domain saved.')).not.toBeInTheDocument();
  expect(reloadMock).not.toHaveBeenCalled();
});

it('guards stale delete completion across project switch and unmount without altering another project selection or route', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const delReq = deferred<void>();
  vi.mocked(projectApi.delete).mockReturnValueOnce(delReq.promise);

  const ui = render(
    <MemoryRouter initialEntries={['/project-settings']}>
      <Routes>
        <Route path="/project-settings" element={<ProjectSettings lang="en" />} />
        <Route path="/projects" element={<div>Projects destination</div>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Delete Project' }));

  // Switch to beta before alpha delete finishes
  mockContext(makeProject({ id: 'beta', name: 'Beta App', base_url: 'https://beta.example.invalid' }));
  ui.rerender(
    <MemoryRouter initialEntries={['/project-settings']}>
      <Routes>
        <Route path="/project-settings" element={<ProjectSettings lang="en" />} />
        <Route path="/projects" element={<div>Projects destination</div>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );

  await act(async () => {
    delReq.resolve(undefined);
  });

  expect(reloadMock).not.toHaveBeenCalled();
  expect(selectMock).not.toHaveBeenCalled();
  expect(screen.getByTestId('location')).toHaveTextContent('/project-settings');

  // Clear selection and leave settings before reload can unmount the page.
  const delReq2 = deferred<void>();
  const reloadReq2 = deferred<void>();
  vi.mocked(projectApi.delete).mockReturnValueOnce(delReq2.promise);
  reloadMock.mockReturnValueOnce(reloadReq2.promise);

  fireEvent.click(screen.getByRole('button', { name: 'Delete Project' }));
  await act(async () => {
    delReq2.resolve(undefined);
  });
  expect(selectMock).toHaveBeenCalledTimes(1);
  expect(selectMock).toHaveBeenCalledWith(null);
  expect(screen.getByTestId('location')).toHaveTextContent('/projects');
  ui.unmount();
  await act(async () => {
    reloadReq2.resolve(undefined);
  });

  expect(selectMock).toHaveBeenCalledTimes(1);
});

it('ignores a delete response after the settings page unmounts', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const request = deferred<void>();
  vi.mocked(projectApi.delete).mockReturnValueOnce(request.promise);
  const ui = renderSettings();

  fireEvent.click(screen.getByRole('button', { name: 'Delete Project' }));
  ui.unmount();
  await act(async () => { request.resolve(undefined); });

  expect(reloadMock).not.toHaveBeenCalled();
  expect(selectMock).not.toHaveBeenCalled();
});

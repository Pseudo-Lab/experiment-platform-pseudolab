import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ProjectProvider, useProject } from '@/contexts/ProjectContext';
import { MainLayout } from '@/layouts/MainLayout';
import { ProjectSettings } from '@/features/dashboard/components/ProjectSettings';
import { projectApi, type Project } from '@/services/api';

vi.mock('@/services/api', () => ({
  projectApi: {
    list: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('@/features/dashboard/components/ProjectSharing', () => ({
  ProjectSharing: () => <div data-testid="project-sharing-stub" />,
}));

vi.mock('@/features/dashboard/components/ProjectInvitationInbox', () => ({
  ProjectInvitationInbox: () => <div data-testid="invitation-inbox-stub" />,
}));

const STORAGE_KEY = 'currentProjectId';

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'alpha',
  name: 'Alpha App',
  base_url: 'https://alpha.example.invalid',
  project_type: 'ab_test',
  created_at: '2026-11-15T00:00:00Z',
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

type ProjectSnapshot = ReturnType<typeof useProject>;

function renderIntegration(lang: 'ko' | 'en' = 'en', initialPath = '/project-settings') {
  let latestCtx!: ProjectSnapshot;

  function StateProbe() {
    const location = useLocation();
    const ctx = useProject();
    latestCtx = ctx;
    return <output data-testid="location">{location.pathname}</output>;
  }

  const view = render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ProjectProvider>
        <StateProbe />
        <MainLayout
          lang={lang}
          setLang={vi.fn()}
          backendStatus="Online"
          accountId="account-1"
          userLabel="Owner"
          isAdmin={false}
        >
          <Routes>
            <Route path="/project-settings" element={<ProjectSettings lang={lang} />} />
            <Route path="/projects" element={<div data-testid="projects-destination">Projects</div>} />
            <Route path="/experiments" element={<div data-testid="experiments-destination">Experiments</div>} />
          </Routes>
        </MainLayout>
      </ProjectProvider>
    </MemoryRouter>,
  );

  return {
    ...view,
    getCtx: () => latestCtx,
  };
}

describe('ProjectSettings + ProjectProvider + MainLayout integration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1280 });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it.each(['ko', 'en'] as const)('keeps save confirmation during and after the settings refresh in %s', async lang => {
    const alpha = makeProject();
    const beta = makeProject({ id: 'beta', name: 'Beta App' });
    const updated = { ...alpha, base_url: 'https://saved.example.invalid' };
    const refresh = deferred<Project[]>();
    localStorage.setItem(STORAGE_KEY, 'alpha');
    vi.mocked(projectApi.list).mockResolvedValueOnce([alpha, beta]).mockReturnValueOnce(refresh.promise);
    vi.mocked(projectApi.patch).mockResolvedValueOnce(updated);
    const { getCtx } = renderIntegration(lang);

    const input = await screen.findByLabelText(lang === 'ko' ? '고객 앱 URL' : 'Customer app URL');
    fireEvent.change(input, { target: { value: updated.base_url } });
    fireEvent.click(screen.getByRole('button', { name: lang === 'ko' ? '저장' : 'Save' }));
    await waitFor(() => expect(getCtx().loading).toBe(true));
    const confirmation = lang === 'ko' ? '앱 도메인을 저장했습니다.' : 'App domain saved.';
    expect(screen.getByText(confirmation, { exact: true })).toBeVisible();
    expect(input).toBeInTheDocument();

    await act(async () => { refresh.resolve([updated, beta]); });
    expect(getCtx().loading).toBe(false);
    expect(screen.getByText(confirmation, { exact: true })).toBeVisible();
    expect(input).toHaveValue(updated.base_url);
    fireEvent.click(screen.getByRole('button', { name: 'Beta App' }));
    expect(screen.queryByText(confirmation, { exact: true })).not.toBeInTheDocument();
  });

  it('still blocks settings if a refresh fails after a successful save', async () => {
    const alpha = makeProject();
    const refresh = deferred<Project[]>();
    localStorage.setItem(STORAGE_KEY, 'alpha');
    vi.mocked(projectApi.list).mockResolvedValueOnce([alpha]).mockReturnValueOnce(refresh.promise);
    vi.mocked(projectApi.patch).mockResolvedValueOnce(alpha);
    renderIntegration();
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(projectApi.list).toHaveBeenCalledTimes(2));
    await act(async () => { refresh.reject(new Error('List unavailable')); });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load projects.');
    expect(screen.queryByLabelText('Customer app URL')).not.toBeInTheDocument();
  });

  it.each(['ko', 'en'] as const)(
    'clears selection and navigates to /projects when projectApi.list rejects after DELETE succeeds, and retry recovers without resurrecting selection in %s',
    async (lang) => {
      const alpha = makeProject({ id: 'alpha', name: 'Alpha App' });
      const beta = makeProject({ id: 'beta', name: 'Beta App' });
      localStorage.setItem(STORAGE_KEY, 'alpha');

      const refreshReq = deferred<Project[]>();
      const retryReq = deferred<Project[]>();
      vi.mocked(projectApi.list)
        .mockResolvedValueOnce([alpha, beta])
        .mockReturnValueOnce(refreshReq.promise)
        .mockReturnValueOnce(retryReq.promise);
      vi.mocked(projectApi.delete).mockResolvedValueOnce(undefined);
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      const { getCtx } = renderIntegration(lang);

      const deleteBtn = await screen.findByRole('button', {
        name: lang === 'ko' ? '프로젝트 삭제' : 'Delete Project',
      });
      fireEvent.click(deleteBtn);

      await waitFor(() => expect(projectApi.delete).toHaveBeenCalledWith('alpha'));
      await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/projects'));

      expect(screen.getByTestId('projects-destination')).toBeVisible();
      expect(
        screen.queryByText(lang === 'ko' ? '프로젝트를 불러오는 중...' : 'Loading projects...'),
      ).not.toBeInTheDocument();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(getCtx().currentProjectId).toBeNull();

      await act(async () => {
        refreshReq.reject(new Error('Refresh failed'));
      });

      await waitFor(() => expect(getCtx().error).toBe(true));
      expect(screen.getByTestId('location')).toHaveTextContent('/projects');
      expect(screen.getByTestId('projects-destination')).toBeVisible();
      expect(
        screen.queryByText(lang === 'ko' ? '프로젝트를 불러오지 못했습니다.' : 'Could not load projects.'),
      ).not.toBeInTheDocument();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(getCtx().currentProjectId).toBeNull();
      expect(getCtx().currentProject).toBeNull();

      const retryBtn = screen.getByRole('button', {
        name: lang === 'ko' ? '프로젝트 다시 불러오기' : 'Retry loading projects',
      });
      fireEvent.click(retryBtn);

      await act(async () => {
        retryReq.resolve([beta]);
      });

      await waitFor(() => expect(getCtx().error).toBe(false));
      expect(getCtx().loading).toBe(false);
      expect(getCtx().projects).toEqual([beta]);
      expect(getCtx().currentProjectId).toBeNull();
      expect(getCtx().currentProject).toBeNull();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(screen.getByTestId('location')).toHaveTextContent('/projects');

      const betaBtn = screen.getByRole('button', { name: 'Beta App' });
      expect(betaBtn).toHaveAttribute('aria-pressed', 'false');
      expect(screen.queryByRole('button', { name: 'Alpha App' })).not.toBeInTheDocument();
    },
  );

  it('retains selection, storage, and route when DELETE rejects', async () => {
    const alpha = makeProject({ id: 'alpha', name: 'Alpha App' });
    const beta = makeProject({ id: 'beta', name: 'Beta App' });
    localStorage.setItem(STORAGE_KEY, 'alpha');

    vi.mocked(projectApi.list).mockResolvedValueOnce([alpha, beta]);
    vi.mocked(projectApi.delete).mockRejectedValueOnce(new Error('Delete refused'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { getCtx } = renderIntegration('en');

    const deleteBtn = await screen.findByRole('button', { name: 'Delete Project' });
    fireEvent.click(deleteBtn);

    expect(await screen.findByRole('alert')).toHaveTextContent('Delete refused');
    expect(projectApi.list).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location')).toHaveTextContent('/project-settings');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('alpha');
    expect(getCtx().currentProjectId).toBe('alpha');
    expect(getCtx().currentProject?.id).toBe('alpha');
  });

  it('does not clear a newly selected project or leave workspace when a pending DELETE settles afterward', async () => {
    const alpha = makeProject({ id: 'alpha', name: 'Alpha App' });
    const beta = makeProject({ id: 'beta', name: 'Beta App', base_url: 'https://beta.example.invalid' });
    localStorage.setItem(STORAGE_KEY, 'alpha');

    const pendingDelete = deferred<void>();
    vi.mocked(projectApi.list).mockResolvedValueOnce([alpha, beta]);
    vi.mocked(projectApi.delete).mockReturnValueOnce(pendingDelete.promise);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { getCtx } = renderIntegration('en');

    const deleteBtn = await screen.findByRole('button', { name: 'Delete Project' });
    fireEvent.click(deleteBtn);

    await waitFor(() => expect(projectApi.delete).toHaveBeenCalledWith('alpha'));

    fireEvent.click(screen.getByRole('button', { name: 'Beta App' }));

    expect(getCtx().currentProjectId).toBe('beta');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('beta');
    expect(screen.getByTestId('location')).toHaveTextContent('/project-settings');
    expect(screen.getByLabelText('Customer app URL')).toHaveValue('https://beta.example.invalid');

    await act(async () => {
      pendingDelete.resolve(undefined);
    });

    expect(getCtx().currentProjectId).toBe('beta');
    expect(getCtx().currentProject?.id).toBe('beta');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('beta');
    expect(screen.getByTestId('location')).toHaveTextContent('/project-settings');
    expect(screen.getByLabelText('Customer app URL')).toHaveValue('https://beta.example.invalid');
    expect(projectApi.list).toHaveBeenCalledTimes(1);
  });
});

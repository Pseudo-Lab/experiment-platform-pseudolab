import { render, screen, fireEvent, act, cleanup, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { useProject } from '@/contexts/ProjectContext';

vi.mock('@/features/dashboard/components/ProjectInvitationInbox', () => ({ ProjectInvitationInbox: () => <div data-testid="invitation-inbox" /> }));

vi.mock('@/contexts/ProjectContext', () => ({
  useProject: vi.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    clear: () => { store = {}; }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock matchMedia for theme preference
const mockMatchMedia = (matches: boolean) => {
  return vi.fn().mockImplementation(query => ({
    matches: matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};
Object.defineProperty(window, 'matchMedia', { writable: true, value: mockMatchMedia(true) }); // Default mock

// Mock fetch for backend status (MainLayout fetches backend status for the badge)
global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ status: 'connected', version: '0.1.0' }),
  })
) as any;

// Mock useNavigate
const mockedUseNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual: any = await importOriginal(); // Use actual for non-mocked exports
  return {
    ...actual,
    useNavigate: () => mockedUseNavigate,
  };
});


describe('MainLayout Component', () => {
  const mockProps = {
    lang: 'ko' as 'en' | 'ko',
    setLang: vi.fn(),
    theme: 'light' as 'light' | 'dark',
    setTheme: vi.fn(),
    backendStatus: 'Online',
  };

  const defaultProjectContext = {
    projects: [],
    loading: false, error: false,
    currentProjectId: null,
    currentProject: null,
    setCurrentProjectId: vi.fn(),
    reloadProjects: vi.fn(),
  };

  beforeEach(() => {
    localStorage.clear();
    mockProps.setLang.mockClear();
    mockProps.setTheme.mockClear();
    (global.fetch as any).mockClear();
    (window.matchMedia as any).mockClear();
    mockedUseNavigate.mockClear();
    (useProject as ReturnType<typeof vi.fn>).mockReturnValue(defaultProjectContext);
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 });
  });

  afterEach(cleanup); // Clean up DOM after each test

  // Helper to render MainLayout with necessary router context
  const renderMainLayout = (initialEntries = ['/dashboard']) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <MainLayout {...mockProps}>
          <div>Test Children</div>
        </MainLayout>
      </MemoryRouter>
    );
  };

  it('renders correctly with children and sidebar open by default on desktop', async () => {
    await act(async () => {
      renderMainLayout();
    });
    expect(screen.getByText('Test Children')).toBeInTheDocument();
    expect(screen.queryByText('Online')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iterglow 홈' })).toHaveAttribute('href', '/projects');
    const asideElement = screen.getByRole('complementary');
    expect(asideElement).toHaveClass('w-64'); // Sidebar should be open on desktop by default
  });

  it('toggles sidebar on desktop via floating button', async () => {
    window.innerWidth = 1024; // Ensure desktop view
    await act(async () => {
      renderMainLayout();
    });

    const toggleButton = screen.getByRole('button', { name: 'Toggle sidebar' });
    const asideElement = screen.getByRole('complementary');

    expect(asideElement).toHaveClass('w-64'); // Initially open
    await act(async () => {
      fireEvent.click(toggleButton);
    });
    expect(asideElement).toHaveClass('lg:w-20'); // After click, should be closed
    await act(async () => {
      fireEvent.click(toggleButton);
    });
    expect(asideElement).toHaveClass('w-64'); // Click again, should be open
  });

  it('toggles sidebar on mobile via header menu button and close button', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 768 }); // Mobile view
    await act(async () => {
      renderMainLayout();
    });

    const openMenuButton = screen.getByRole('button', { name: 'Open sidebar menu' });
    const asideElement = screen.getByRole('complementary');

    expect(asideElement).toHaveClass('-translate-x-full'); // Initially closed on mobile
    await act(async () => {
      fireEvent.click(openMenuButton);
    });
    expect(asideElement).toHaveClass('translate-x-0'); // After click, should be open

    const closeButton = screen.getByRole('button', { name: 'Close sidebar menu' });
    await act(async () => {
      fireEvent.click(closeButton);
    });
    expect(asideElement).toHaveClass('-translate-x-full'); // After click, should be closed
  });

  it('navigates correctly when sidebar item is clicked', async () => {
    const abTestProject = {
      id: 'test-project',
      name: 'Test Project',
      api_key: 'pk_live_test',
      project_type: 'ab_test' as const,
      created_at: '2024-01-01',
    };
    (useProject as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultProjectContext,
      projects: [abTestProject],
      currentProjectId: 'test-project',
      currentProject: abTestProject,
    });

    await act(async () => {
      renderMainLayout(['/dashboard']);
    });

    expect(screen.queryByRole('button', { name: '커뮤니티 현황' })).not.toBeInTheDocument();

    const experimentsLink = screen.getByRole('button', { name: '실험 관리' });
    await act(async () => {
      fireEvent.click(experimentsLink);
    });
    expect(mockedUseNavigate).toHaveBeenCalledWith('/experiments');
  });
  it('keeps unresolved detail routes available without exposing project tools', async () => {
    await act(async () => { renderMainLayout(['/experiments/test']); });
    expect(screen.queryByRole('button', { name: '실험 관리' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '실험 관리' })).toBeInTheDocument();
    expect(screen.getByText('Test Children')).toBeInTheDocument();
  });

  it('keeps project list and creation visible without mutating selection', () => {
    const setCurrentProjectId = vi.fn();
    vi.mocked(useProject).mockReturnValue({ ...defaultProjectContext, setCurrentProjectId });
    renderMainLayout(['/projects']);
    fireEvent.click(screen.getByRole('button', { name: '새 프로젝트' }));
    expect(mockedUseNavigate).toHaveBeenLastCalledWith('/projects?create=1');
    fireEvent.click(screen.getByRole('button', { name: '프로젝트 목록' }));
    expect(mockedUseNavigate).toHaveBeenLastCalledWith('/projects');
    expect(setCurrentProjectId).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '실험 관리' })).not.toBeInTheDocument();
  });

  it('switches directly through visible project links while retaining the current tool', () => {
    const setCurrentProjectId = vi.fn();
    const projects = [{ id: 'alpha', name: 'Alpha', project_type: 'ab_test' as const, created_at: '' }, { id: 'beta', name: 'Beta', project_type: 'ab_test' as const, created_at: '' }];
    vi.mocked(useProject).mockReturnValue({ ...defaultProjectContext, projects, currentProjectId: 'alpha', currentProject: projects[0], setCurrentProjectId });
    renderMainLayout(['/feature-flags']);
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Beta' })).toBeVisible();
    expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Beta' }));
    expect(setCurrentProjectId).toHaveBeenCalledWith('beta');
    expect(mockedUseNavigate).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button', { name: '실험 관리' })).toHaveLength(1);
  });

  it('opens the project list directly from the collapsed rail', () => {
    renderMainLayout();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' }));
    fireEvent.click(screen.getByRole('button', { name: '프로젝트 목록' }));
    expect(mockedUseNavigate).toHaveBeenLastCalledWith('/projects');
    expect(screen.getByRole('button', { name: '새 프로젝트' })).toBeInTheDocument();
  });

  it('closes the mobile sidebar when opening the project list', () => {
    window.innerWidth = 375;
    renderMainLayout();
    fireEvent.click(screen.getByRole('button', { name: 'Open sidebar menu' }));
    fireEvent.click(screen.getByRole('button', { name: '프로젝트 목록' }));
    expect(mockedUseNavigate).toHaveBeenLastCalledWith('/projects');
    expect(screen.getByRole('complementary')).toHaveClass('-translate-x-full');
  });

});


it.each([375, 1024])('keeps logo navigation inside projects and closes the mobile sidebar at width %s', (width) => {
  window.innerWidth = width;
  vi.mocked(useProject).mockReturnValue({ projects: [], loading: false, error: false, currentProjectId: null, currentProject: null, setCurrentProjectId: vi.fn(), reloadProjects: vi.fn() });
  render(<MemoryRouter initialEntries={['/experiments/detail']}><MainLayout lang="en" setLang={() => {}} backendStatus="Online">Workspace</MainLayout></MemoryRouter>);
  if (width < 1024) fireEvent.click(screen.getByRole('button', { name: 'Open sidebar menu' }));
  else fireEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' }));
  const logo = screen.getByRole('link', { name: 'Iterglow home' });
  expect(logo).toHaveAttribute('href', '/projects');
  fireEvent.click(logo);
  if (width < 1024) expect(screen.getByRole('complementary')).toHaveClass('-translate-x-full');
  expect(screen.queryByText('Online')).not.toBeInTheDocument();
  cleanup();
});

it.each([375, 1024])('leaves the previous experiment detail when switching project at width %s', (width) => {
  window.innerWidth = width;
  mockedUseNavigate.mockClear();
  const setCurrentProjectId = vi.fn();
  const projects = [{ id: 'alpha', name: 'Alpha', project_type: 'ab_test' as const, created_at: '' }, { id: 'beta', name: 'Beta', project_type: 'ab_test' as const, created_at: '' }];
  vi.mocked(useProject).mockReturnValue({ projects, loading: false, error: false, currentProjectId: 'alpha', currentProject: projects[0], setCurrentProjectId, reloadProjects: vi.fn() });
  render(<MemoryRouter initialEntries={['/experiments/alpha-experiment']}><MainLayout lang="en" setLang={() => {}} backendStatus="Online">Workspace</MainLayout></MemoryRouter>);
  if (width < 1024) fireEvent.click(screen.getByRole('button', { name: 'Open sidebar menu' }));
  fireEvent.click(screen.getByRole('button', { name: 'Beta' }));
  expect(setCurrentProjectId).toHaveBeenLastCalledWith('beta');
  expect(mockedUseNavigate).toHaveBeenLastCalledWith('/experiments');
  if (width < 1024) expect(screen.getByRole('complementary')).toHaveClass('-translate-x-full');
  cleanup();
});

it.each([
  ['ko', 390], ['ko', 1280], ['en', 390], ['en', 1280],
] as const)('opens account details without signing out in %s at %spx', async (lang, width) => {
  window.innerWidth = width;
  vi.mocked(useProject).mockReturnValue({ projects: [], loading: false, error: false, currentProjectId: null, currentProject: null, setCurrentProjectId: vi.fn(), reloadProjects: vi.fn() });
  const logout = vi.fn();
  const accountId = '11111111-2222-4333-a444-555555555555';
  render(<MemoryRouter><MainLayout lang={lang} setLang={() => {}} backendStatus="Online" userLabel="user-11111111" accountId={accountId} onLogout={logout}>Workspace</MainLayout></MemoryRouter>);
  const trigger = screen.getByRole('button', { name: lang === 'ko' ? '계정 메뉴' : 'Account menu' });
  fireEvent.keyDown(trigger, { key: 'Enter' });
  expect(await screen.findByText(`${lang === 'ko' ? '계정 ID' : 'Account ID'}: ${accountId}`)).toBeVisible();
  expect(logout).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('menuitem', { name: lang === 'ko' ? '로그아웃' : 'Logout' }));
  await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  cleanup();
});

it('keeps an unsuccessful logout recoverable from the account menu', async () => {
  vi.mocked(useProject).mockReturnValue({ projects: [], loading: false, error: false, currentProjectId: null, currentProject: null, setCurrentProjectId: vi.fn(), reloadProjects: vi.fn() });
  const logout = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue(undefined);
  render(<MemoryRouter><MainLayout lang="en" setLang={() => {}} backendStatus="Online" userLabel="user-a" onLogout={logout}>Workspace</MainLayout></MemoryRouter>);
  fireEvent.keyDown(screen.getByRole('button', { name: 'Account menu' }), { key: 'Enter' });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Logout' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Sign out failed. Please try again.');
  fireEvent.click(screen.getByRole('menuitem', { name: 'Logout' }));
  await waitFor(() => expect(logout).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  cleanup();
});

it('disables sign out while revocation is pending', async () => {
  vi.mocked(useProject).mockReturnValue({ projects: [], loading: false, error: false, currentProjectId: null, currentProject: null, setCurrentProjectId: vi.fn(), reloadProjects: vi.fn() });
  let resolveLogout!: () => void;
  const logout = vi.fn(() => new Promise<void>(resolve => { resolveLogout = resolve; }));
  render(<MemoryRouter><MainLayout lang="en" setLang={() => {}} backendStatus="Online" onLogout={logout}>Workspace</MainLayout></MemoryRouter>);
  fireEvent.keyDown(screen.getByRole('button', { name: 'Account menu' }), { key: 'Enter' });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Logout' }));
  const pending = await screen.findByRole('menuitem', { name: 'Signing out...' });
  expect(pending).toHaveAttribute('aria-disabled', 'true');
  fireEvent.click(pending);
  expect(logout).toHaveBeenCalledTimes(1);
  await act(async () => resolveLogout());
  expect(await screen.findByRole('menuitem', { name: 'Logout' })).not.toHaveAttribute('aria-disabled', 'true');
  cleanup();
});

it.each(['ko', 'en'] as const)('shows the Google profile name and email without replacing internal identity in %s', async lang => {
  vi.mocked(useProject).mockReturnValue({ projects: [], loading: false, error: false, currentProjectId: null, currentProject: null, setCurrentProjectId: vi.fn(), reloadProjects: vi.fn() });
  render(<MemoryRouter><MainLayout lang={lang} setLang={() => {}} backendStatus="Online" userLabel="긴 한글 이름을 가진 테스트 사용자" userEmail="member@gmail.com" accountId="internal-account-id">Workspace</MainLayout></MemoryRouter>);
  fireEvent.keyDown(screen.getByRole('button', { name: lang === 'ko' ? '계정 메뉴' : 'Account menu' }), { key: 'Enter' });
  const menu = await screen.findByRole('menu');
  expect(within(menu).getByText('긴 한글 이름을 가진 테스트 사용자')).toBeVisible();
  expect(within(menu).getByText('member@gmail.com')).toBeVisible();
  expect(within(menu).queryByText('internal-account-id')).not.toBeInTheDocument();
  cleanup();
});


it.each(['ko', 'en'] as const)('keeps project management global and removes the project picker in %s', lang => {
  vi.mocked(useProject).mockReturnValue({ projects: [], loading: false, error: false, currentProjectId: null, currentProject: null, setCurrentProjectId: vi.fn(), reloadProjects: vi.fn() });
  render(<MemoryRouter initialEntries={['/projects']}><MainLayout lang={lang} setLang={() => {}} backendStatus="Online">Directory content</MainLayout></MemoryRouter>);
  expect(screen.getByText('Directory content')).toBeVisible();
  expect(screen.queryByRole('button', { name: lang === 'ko' ? '프로젝트를 선택하세요' : 'Select a project' })).not.toBeInTheDocument();
  cleanup();
});

it('blocks workspace content during loading and failure, keeping retries available', () => {
  const retry = vi.fn();
  const context = { projects: [], loading: true, error: false, currentProjectId: 'remembered', currentProject: null, setCurrentProjectId: vi.fn(), reloadProjects: retry };
  vi.mocked(useProject).mockReturnValue(context);
  const view = () => <MemoryRouter initialEntries={['/experiments']}><MainLayout lang="en" setLang={() => {}} backendStatus="Online">Scoped content</MainLayout></MemoryRouter>;
  const { rerender } = render(view());
  expect(screen.getByText('Loading projects...', { exact: true })).toBeVisible();
  expect(screen.queryByText('Scoped content')).not.toBeInTheDocument();
  vi.mocked(useProject).mockReturnValue({ ...context, loading: false, error: true });
  rerender(view());
  expect(screen.getByRole('alert')).toHaveTextContent('Could not load projects');
  expect(screen.queryByText('Scoped content')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(retry).toHaveBeenCalledTimes(1);
  cleanup();
});

it.each(['/experiments', '/experiments/', '/api-key/', '/feature-flags/', '/placements/', '/project-settings/'])('sends a missing selection on %s to management without mounting a workspace', async path => {
  vi.mocked(useProject).mockReturnValue({ projects: [], loading: false, error: false, currentProjectId: null, currentProject: null, setCurrentProjectId: vi.fn(), reloadProjects: vi.fn() });
  render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/projects" element={<p>Choose workspace</p>} /><Route path="*" element={<MainLayout lang="en" setLang={() => {}} backendStatus="Online">Must not mount</MainLayout>} /></Routes></MemoryRouter>);
  expect(await screen.findByText('Choose workspace')).toBeVisible();
  expect(screen.queryByText('Must not mount')).not.toBeInTheDocument();
  cleanup();
});


it.each(['viewer', 'editor', 'owner'] as const)('shows only project tools available to %s', role => {
  const project = { id: 'alpha', name: 'Alpha', project_type: 'ab_test' as const, created_at: '', access_role: role };
  vi.mocked(useProject).mockReturnValue({ projects: [project], loading: false, error: false, currentProjectId: 'alpha', currentProject: project, setCurrentProjectId: vi.fn(), reloadProjects: vi.fn() });
  render(<MemoryRouter initialEntries={['/experiments']}><MainLayout lang="en" setLang={() => {}} backendStatus="Online">Workspace</MainLayout></MemoryRouter>);
  expect(screen.getByRole('button', { name: 'Experiments' })).toBeInTheDocument();
  expect(!!screen.queryByRole('button', { name: 'SDK Integration' })).toBe(role !== 'viewer');
  expect(!!screen.queryByRole('button', { name: 'Settings & members' })).toBe(role === 'owner');
  cleanup();
});

it('keeps shortcuts bounded and includes the active project beyond the first five', () => {
  const projects = Array.from({ length: 20 }, (_, i) => ({ id: 'p'+i, name: 'Project '+i, project_type: 'ab_test' as const, created_at: '' }));
  vi.mocked(useProject).mockReturnValue({ projects, loading: false, error: false, currentProjectId: 'p19', currentProject: projects[19], setCurrentProjectId: vi.fn(), reloadProjects: vi.fn() });
  render(<MemoryRouter initialEntries={['/experiments']}><MainLayout lang="en" setLang={() => {}} backendStatus="Online">Workspace</MainLayout></MemoryRouter>);
  const list = screen.getByRole('region', { name: 'Project list' });
  expect(within(list).getAllByRole('button', { name: /^Project [0-9]+$/ })).toHaveLength(5);
  expect(within(list).getByRole('button', { name: 'Project 19' })).toHaveAttribute('aria-pressed', 'true');
  expect(within(list).getByRole('button', { name: 'View all 20' })).toBeInTheDocument();
  cleanup();
});

it('leaves owner settings when selecting a viewer project', () => {
  const projects = [{ id: 'alpha', name: 'Alpha', project_type: 'ab_test' as const, created_at: '', access_role: 'owner' as const }, { id: 'beta', name: 'Beta', project_type: 'ab_test' as const, created_at: '', access_role: 'viewer' as const }];
  const select = vi.fn();
  vi.mocked(useProject).mockReturnValue({ projects, loading: false, error: false, currentProjectId: 'alpha', currentProject: projects[0], setCurrentProjectId: select, reloadProjects: vi.fn() });
  render(<MemoryRouter initialEntries={['/project-settings']}><MainLayout lang="en" setLang={() => {}} backendStatus="Online">Workspace</MainLayout></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Beta' }));
  expect(select).toHaveBeenCalledWith('beta');
  expect(mockedUseNavigate).toHaveBeenLastCalledWith('/experiments');
  cleanup();
});


it.each(['ko', 'en'] as const)('announces new-tab guide and introduction links in %s', lang => {
  vi.mocked(useProject).mockReturnValue({ projects: [], loading: false, error: false, currentProjectId: null, currentProject: null, setCurrentProjectId: vi.fn(), reloadProjects: vi.fn() });
  render(<MemoryRouter initialEntries={['/projects']}><MainLayout lang={lang} setLang={() => {}} backendStatus="Online">Directory</MainLayout></MemoryRouter>);
  for (const label of lang === 'ko' ? ['SDK 가이드', '서비스 소개'] : ['SDK guide', 'About Iterglow']) {
    const link = screen.getByRole('link', { name: label });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAccessibleDescription(lang === 'ko' ? '새 탭에서 열립니다.' : 'Opens in a new tab.');
  }
  cleanup();
});

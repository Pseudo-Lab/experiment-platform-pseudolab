import { render, screen, fireEvent, act, cleanup, within, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { useProject } from '@/contexts/ProjectContext';

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
    loading: false,
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
  it('keeps experiments accessible without a selected project and labels detail routes', async () => {
    await act(async () => { renderMainLayout(['/experiments/test']); });
    fireEvent.click(screen.getByRole('button', { name: '실험 관리' }));
    expect(mockedUseNavigate).toHaveBeenCalledWith('/experiments');
    expect(screen.getByRole('heading', { name: '실험 관리' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '설정' })).not.toBeInTheDocument();
  });

  it('keeps management and creation inside the picker without changing project scope', () => {
    const setCurrentProjectId = vi.fn();
    vi.mocked(useProject).mockReturnValue({ ...defaultProjectContext, setCurrentProjectId });
    renderMainLayout(['/experiments']);
    expect(screen.queryByRole('button', { name: '새 프로젝트' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('navigation')).queryByText(/프로젝트/)).not.toBeInTheDocument();
    const picker = screen.getByRole('button', { name: '프로젝트를 선택하세요' });
    fireEvent.keyDown(picker, { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: '새 프로젝트' }));
    expect(mockedUseNavigate).toHaveBeenLastCalledWith('/projects?create=1');
    fireEvent.keyDown(picker, { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: '프로젝트 관리' }));
    expect(mockedUseNavigate).toHaveBeenLastCalledWith('/projects');
    expect(setCurrentProjectId).not.toHaveBeenCalled();
  });

  it('switches scope through the picker while staying on the current screen', () => {
    const setCurrentProjectId = vi.fn();
    vi.mocked(useProject).mockReturnValue({ ...defaultProjectContext, setCurrentProjectId,
      currentProjectId: 'alpha',
      projects: [
        { id: 'alpha', name: 'Alpha', project_type: 'ab_test', created_at: '2026-10-31' },
        { id: 'beta', name: 'Beta', project_type: 'ab_test', created_at: '2026-10-31' },
      ],
    });
    renderMainLayout(['/feature-flags']);
    const picker = screen.getByRole('button', { name: '프로젝트를 선택하세요' });
    expect(picker).toHaveTextContent('Alpha');
    expect(picker).toHaveTextContent('프로젝트 전환');
    fireEvent.keyDown(picker, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitemradio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Beta' }));
    expect(setCurrentProjectId).toHaveBeenLastCalledWith('beta');
    fireEvent.keyDown(picker, { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitemradio', { name: '전체 프로젝트' }));
    expect(setCurrentProjectId).toHaveBeenLastCalledWith(null);
    expect(mockedUseNavigate).not.toHaveBeenCalled();
  });

  it('can reopen project controls from the collapsed sidebar', () => {
    renderMainLayout();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' }));
    fireEvent.click(screen.getByRole('button', { name: '프로젝트를 선택하세요' }));
    fireEvent.keyDown(screen.getByRole('button', { name: '프로젝트를 선택하세요' }), { key: 'Enter' });
    expect(screen.getByRole('menuitem', { name: '새 프로젝트' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '프로젝트 관리' })).toBeInTheDocument();
  });

  it('closes the mobile sidebar when navigating to project management', () => {
    window.innerWidth = 375;
    renderMainLayout();
    fireEvent.click(screen.getByRole('button', { name: 'Open sidebar menu' }));
    fireEvent.keyDown(screen.getByRole('button', { name: '프로젝트를 선택하세요' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: '프로젝트 관리' }));
    expect(mockedUseNavigate).toHaveBeenLastCalledWith('/projects');
    expect(screen.getByRole('complementary')).toHaveClass('-translate-x-full');
  });

});


it.each([375, 1024])('keeps logo navigation inside projects and closes the mobile sidebar at width %s', (width) => {
  window.innerWidth = width;
  vi.mocked(useProject).mockReturnValue({ projects: [], loading: false, currentProjectId: null, currentProject: null, setCurrentProjectId: vi.fn(), reloadProjects: vi.fn() });
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
  vi.mocked(useProject).mockReturnValue({ projects, loading: false, currentProjectId: 'alpha', currentProject: projects[0], setCurrentProjectId, reloadProjects: vi.fn() });
  render(<MemoryRouter initialEntries={['/experiments/alpha-experiment']}><MainLayout lang="en" setLang={() => {}} backendStatus="Online">Workspace</MainLayout></MemoryRouter>);
  if (width < 1024) fireEvent.click(screen.getByRole('button', { name: 'Open sidebar menu' }));
  fireEvent.keyDown(screen.getByRole('button', { name: 'Select a project' }), { key: 'Enter' });
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'Beta' }));
  expect(setCurrentProjectId).toHaveBeenLastCalledWith('beta');
  expect(mockedUseNavigate).toHaveBeenLastCalledWith('/experiments');
  if (width < 1024) expect(screen.getByRole('complementary')).toHaveClass('-translate-x-full');
  cleanup();
});

it.each([
  ['ko', 390], ['ko', 1280], ['en', 390], ['en', 1280],
] as const)('opens account details without signing out in %s at %spx', async (lang, width) => {
  window.innerWidth = width;
  vi.mocked(useProject).mockReturnValue({ projects: [], loading: false, currentProjectId: null, currentProject: null, setCurrentProjectId: vi.fn(), reloadProjects: vi.fn() });
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
  vi.mocked(useProject).mockReturnValue({ projects: [], loading: false, currentProjectId: null, currentProject: null, setCurrentProjectId: vi.fn(), reloadProjects: vi.fn() });
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
  vi.mocked(useProject).mockReturnValue({ projects: [], loading: false, currentProjectId: null, currentProject: null, setCurrentProjectId: vi.fn(), reloadProjects: vi.fn() });
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
  vi.mocked(useProject).mockReturnValue({ projects: [], loading: false, currentProjectId: null, currentProject: null, setCurrentProjectId: vi.fn(), reloadProjects: vi.fn() });
  render(<MemoryRouter><MainLayout lang={lang} setLang={() => {}} backendStatus="Online" userLabel="긴 한글 이름을 가진 테스트 사용자" userEmail="member@gmail.com" accountId="internal-account-id">Workspace</MainLayout></MemoryRouter>);
  fireEvent.keyDown(screen.getByRole('button', { name: lang === 'ko' ? '계정 메뉴' : 'Account menu' }), { key: 'Enter' });
  const menu = await screen.findByRole('menu');
  expect(within(menu).getByText('긴 한글 이름을 가진 테스트 사용자')).toBeVisible();
  expect(within(menu).getByText('member@gmail.com')).toBeVisible();
  expect(within(menu).queryByText('internal-account-id')).not.toBeInTheDocument();
  cleanup();
});

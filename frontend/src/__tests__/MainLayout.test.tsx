import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react';
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
    expect(screen.getByText('ExperiBase')).toBeInTheDocument(); // Check if sidebar title is present
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

  it('groups project actions above navigation without changing the selected scope', async () => {
    const setCurrentProjectId = vi.fn();
    vi.mocked(useProject).mockReturnValue({ ...defaultProjectContext, setCurrentProjectId });
    renderMainLayout(['/experiments']);
    const projectArea = within(screen.getByRole('region', { name: '프로젝트 관리' }));
    expect(projectArea.getByRole('combobox')).toBeInTheDocument();
    fireEvent.click(projectArea.getByRole('button', { name: '새 프로젝트' }));
    expect(mockedUseNavigate).toHaveBeenLastCalledWith('/projects?create=1');
    fireEvent.click(projectArea.getByRole('button', { name: '프로젝트 관리' }));
    expect(mockedUseNavigate).toHaveBeenLastCalledWith('/projects');
    expect(setCurrentProjectId).not.toHaveBeenCalled();
    expect(within(screen.getByRole('navigation')).queryByText(/프로젝트/)).not.toBeInTheDocument();
  });

  it('can reopen project controls from the collapsed sidebar', () => {
    renderMainLayout();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' }));
    fireEvent.click(screen.getByRole('button', { name: '프로젝트를 선택하세요' }));
    expect(screen.getByRole('button', { name: '새 프로젝트' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '프로젝트 관리' })).toBeInTheDocument();
  });

});
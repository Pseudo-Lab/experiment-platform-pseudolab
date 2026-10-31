import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom'; // Use MemoryRouter for isolated testing
import App from '@/App';
import { authApi } from '@/services/authApi';
import { projectApi } from '@/services/api';

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
  return vi.fn().mockImplementation((query: string) => ({
    matches: matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

let authResponse: { authenticated: boolean; user: { username: string } | null } = {
  authenticated: true,
  user: { username: 'admin' },
};

const okJson = (data: unknown) => Promise.resolve({
  ok: true,
  status: 200,
  json: () => Promise.resolve(data),
} as Response);

// Mock fetch for auth status and backend status
global.fetch = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes('/auth/me')) return okJson(authResponse);
  if (url.includes('/status/')) return okJson({ status: 'connected', version: '0.1.0' });
  return okJson({});
}) as any;

// Mock api service modules
vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>();
  return {
    ...actual,
    experimentApi: {
      list: vi.fn(() => Promise.resolve([])),
    },
    projectApi: {
      list: vi.fn(() => Promise.resolve([])),
    },
  };
});

vi.mock('@/services/dashboardApi', () => ({
  dashboardApi: {
    overview: vi.fn(() => Promise.resolve({
      generated_at: '2026-03-10T00:00:00Z',
      window: { from: '2026-02-09', to: '2026-03-10', timezone: 'Asia/Seoul' },
      summary: {
        active_projects_count: 1,
        weekly_active_contributors: 1,
        weekly_collab_events: 1,
        pr_merge_rate_28d: 0.5,
        pipeline_freshness_hours: 1,
      },
      timeseries: [{ date: '03-10', core_activity: 1, communication: 1, merge_rate: 0.5 }],
      distribution: { top_repos_by_activity: [], activity_concentration_top3: 0 },
      health: { coverage_score: 1, missing_day_ratio_30d: 0, schema_violation_count: 0 },
      alerts: [],
    })),
  },
}));

describe('App Component', () => {
  beforeEach(() => {
    localStorage.clear(); // Clear localStorage before each test
    authResponse = { authenticated: true, user: { username: 'admin' } };
    (global.fetch as any).mockClear();
    vi.mocked(projectApi.list).mockClear();
  });

  afterEach(() => { cleanup(); vi.restoreAllMocks(); }); // Clean up DOM after each test

  // Helper to render App with necessary router context
  const renderApp = (initialEntries = ['/dashboard']) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <App />
      </MemoryRouter>
    );
  };

  it('renders without crashing and navigates to experiments by default', async () => {
    await act(async () => {
      renderApp(['/']); // Start from root
    });
    expect(screen.getByText('ExperiBase')).toBeInTheDocument(); // Checks if App/MainLayout renders
    expect(screen.getByText('가설을 세우고, 수집된 데이터를 확인하고, 다음 결정을 기록하세요.')).toBeInTheDocument(); // Checks if Overview content renders
    // expect(window.location.pathname).toBe('/dashboard'); // Removed due to MemoryRouter behavior
  });

  it('redirects anonymous users to the login page', async () => {
    authResponse = { authenticated: false, user: null };

    await act(async () => {
      renderApp(['/dashboard']);
    });

    expect(screen.getByRole('heading', { name: '관리자 로그인' })).toBeInTheDocument();
    expect(screen.getByText('실험과 Feature Flag를 관리하려면 로그인하세요.')).toBeInTheDocument();
  });

  it('redirects to login when a management request expires the session', async () => {
    await act(async () => { renderApp(['/experiments']); });
    await act(async () => { window.dispatchEvent(new Event('auth:unauthorized')); });
    expect(screen.getByRole('heading', { name: '관리자 로그인' })).toBeInTheDocument();
  });

  it('persists language setting to localStorage', async () => {
    await act(async () => {
      renderApp();
    });

    const langToggleButton = screen.getByRole('button', { name: 'Toggle language' }); // Query by aria-label
    expect(langToggleButton).toHaveTextContent('KO');
    expect(localStorage.getItem('lang')).toBe('ko'); // Default should be saved from initial render

    await act(async () => {
      fireEvent.click(langToggleButton);
    });
    expect(localStorage.getItem('lang')).toBe('en'); // Check localStorage directly
    expect(langToggleButton).toHaveTextContent('EN'); // Check if button text changed

    cleanup(); // Clear previous render
    await act(async () => {
      renderApp(); // App will now load 'en' from localStorage
    });
    expect(screen.getByRole('button', { name: 'Toggle language' })).toHaveTextContent('EN');
  });

  it('persists theme setting to localStorage and respects system preference', async () => {
    // Mock system preference to dark initially
    Object.defineProperty(window, 'matchMedia', { value: mockMatchMedia(true) });

    await act(async () => {
      renderApp();
    });
    // Check initial state from system preference (dark)
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');

    // Simulate theme change to light via button click
    const themeToggleButton = screen.getByRole('button', { name: 'Toggle theme' }); // Query by aria-label
    await act(async () => {
      fireEvent.click(themeToggleButton);
    });
    expect(document.documentElement.classList.contains('dark')).toBe(false); // Should be light
    expect(localStorage.getItem('theme')).toBe('light');

    // Clear localStorage and mock system preference to light for re-initialization
    localStorage.clear();
    Object.defineProperty(window, 'matchMedia', { value: mockMatchMedia(false) }); // System preference is light

    cleanup(); // Clear previous render
    await act(async () => {
      renderApp();
    });

    // Should load 'light' from system preference
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('theme')).toBe('light');

    // Click to change theme to 'dark'
    const lightThemeToggleButton = screen.getByRole('button', { name: 'Toggle theme' }); // Button still has the same aria-label
    await act(async () => {
      fireEvent.click(lightThemeToggleButton);
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');
  });
  it('shows the public introduction while session restoration is pending without loading projects', async () => {
    vi.spyOn(authApi, 'me').mockReturnValue(new Promise(() => {}));
    await act(async () => { renderApp(['/about']); });
    expect(screen.getByRole('heading', { level: 1, name: /더 나은 제품을 만드는/  })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '관리자 로그인' })[0]).toHaveAttribute('href', '/login');
    expect(projectApi.list).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps the introduction readable when session restoration fails', async () => {
    vi.spyOn(authApi, 'me').mockRejectedValue(new Error('offline'));
    await act(async () => { renderApp(['/about/']); });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('더 나은 제품');
    expect(projectApi.list).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Better products');
    expect(screen.getAllByRole('link', { name: 'Admin sign in' })[0]).toBeInTheDocument();
  });

  it('offers a workspace link to signed-in visitors and keeps the about route public on expiry', async () => {
    await act(async () => { renderApp(['/about']); });
    expect(screen.getAllByRole('link', { name: '관리 화면 열기' })[0]).toHaveAttribute('href', '/experiments');
    expect(projectApi.list).not.toHaveBeenCalled();
    await act(async () => { window.dispatchEvent(new Event('auth:unauthorized')); });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('더 나은 제품');
    expect(screen.getAllByRole('link', { name: '관리자 로그인' })[0]).toBeInTheDocument();
  });

  it('connects the anonymous login screen to the introduction and back', async () => {
    authResponse = { authenticated: false, user: null };
    await act(async () => { renderApp(['/projects']); });
    fireEvent.click(screen.getByRole('link', { name: '서비스 살펴보기' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('더 나은 제품');
    fireEvent.click(screen.getAllByRole('link', { name: '관리자 로그인' })[0]);
    expect(screen.getByRole('heading', { name: '관리자 로그인' })).toBeInTheDocument();
    expect(projectApi.list).not.toHaveBeenCalled();
  });

  it('lets signed-in users visit the introduction from the sidebar and return', async () => {
    await act(async () => { renderApp(['/experiments']); });
    fireEvent.click(screen.getByRole('link', { name: '서비스 소개' }));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getAllByRole('link', { name: '관리 화면 열기' })[0]); });
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });

  it('changes language and theme at login while preserving credentials and the return route through about', async () => {
    authResponse = { authenticated: false, user: null };
    const login = vi.spyOn(authApi, 'login').mockResolvedValue({ authenticated: true, user: { username: 'admin' } });
    await act(async () => { renderApp(['/experiments']); });
    fireEvent.change(screen.getByLabelText('아이디'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }));
    expect(screen.getByLabelText('Username')).toHaveValue('admin');
    expect(screen.getByLabelText('Password')).toHaveValue('secret');
    const previousTheme = localStorage.getItem('theme');
    fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
    expect(localStorage.getItem('theme')).not.toBe(previousTheme);
    fireEvent.click(screen.getByRole('link', { name: 'Explore ExperiBase' }));
    expect(screen.getByRole('region', { name: 'From an experiment to your next decision' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('link', { name: 'Admin sign in' })[0]);
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sign in' })); });
    expect(login).toHaveBeenCalledWith('admin', 'secret');
    expect(screen.getByRole('heading', { name: 'Experiments', level: 1 })).toBeInTheDocument();
  });

  it('explores illustrative product states without requesting management data', async () => {
    authResponse = { authenticated: false, user: null };
    await act(async () => { renderApp(['/about']); });
    expect(screen.getAllByText('설명용 예시')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: '기능 공개' }));
    expect(screen.getByRole('button', { name: '기능 공개' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText('비활성').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '결과·결정' }));
    expect(screen.getByText('아직 수집된 데이터가 없습니다')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }));
    expect(screen.getByText('No data collected yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Experiment design' }));
    expect(screen.getAllByText('Compare signup messages').length).toBeGreaterThan(0);
    expect(projectApi.list).not.toHaveBeenCalled();
  });

});

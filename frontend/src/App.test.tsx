import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom'; // Use MemoryRouter for isolated testing
import App from '@/App';

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

// Mock fetch for backend status
global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ status: 'connected', version: '0.1.0' }),
  })
) as any;

// Mock api service modules
vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>();
  return {
    ...actual,
    experimentApi: {
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
    (global.fetch as any).mockClear();
  });

  afterEach(cleanup); // Clean up DOM after each test

  // Helper to render App with necessary router context
  const renderApp = (initialEntries = ['/dashboard']) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <App />
      </MemoryRouter>
    );
  };

  it('renders without crashing and navigates to dashboard by default', async () => {
    await act(async () => {
      renderApp(['/']); // Start from root
    });
    expect(screen.getByText('ExperiBase')).toBeInTheDocument(); // Checks if App/MainLayout renders
    expect(screen.getByText('보유 데이터 규모와 최근 활동 흐름을 한 번에 확인하는 요약 화면입니다.')).toBeInTheDocument(); // Checks if Overview content renders
    // expect(window.location.pathname).toBe('/dashboard'); // Removed due to MemoryRouter behavior
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
});
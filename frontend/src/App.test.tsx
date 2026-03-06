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

// Mock the entire api service module for experimentApi.list
vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>();
  return {
    ...actual,
    experimentApi: {
      list: vi.fn(() => Promise.resolve([])), // Mock the list method to return an empty array
    },
  };
});

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
    expect(screen.getByText('데이터 밸류에이션 실험의 최신 현황을 확인하세요.')).toBeInTheDocument(); // Checks if Dashboard content renders
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
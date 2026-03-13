import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
// import { Button } from '@/components/ui/button'; // Not directly needed for MainLayout tests

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

  beforeEach(() => {
    localStorage.clear();
    mockProps.setLang.mockClear();
    mockProps.setTheme.mockClear();
    (global.fetch as any).mockClear();
    (window.matchMedia as any).mockClear();
    mockedUseNavigate.mockClear(); // Clear mock calls for useNavigate
    // Reset window.innerWidth for each test
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
    await act(async () => {
      renderMainLayout(['/dashboard']);
    });

    const dashboardLink = screen.getByRole('button', { name: '개요' }); // Find Overview button
    expect(dashboardLink).toBeInTheDocument(); // Ensure Dashboard link is found

    const experimentsLink = screen.getByRole('button', { name: '실험 관리' });
    await act(async () => {
      fireEvent.click(experimentsLink);
    });
    expect(mockedUseNavigate).toHaveBeenCalledWith('/experiments'); // Assert useNavigate was called
  });
});
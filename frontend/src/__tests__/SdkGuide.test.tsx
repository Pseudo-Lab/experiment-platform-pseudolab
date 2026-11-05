import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '@/App';
import { authApi } from '@/services/authApi';
import { MainLayout } from '@/layouts/MainLayout';
import { ProjectProvider } from '@/contexts/ProjectContext';

// Keep the destination screen's data loading outside these navigation regressions.
vi.mock('@/features/dashboard/components/ExperimentDetail', () => ({
  ExperimentDetail: () => <div>Experiment destination</div>,
}));

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => [] } as unknown as Response);
  vi.spyOn(authApi, 'me').mockResolvedValue({ authenticated: false, user: null });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const open = (path: string) => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);

it.each(['/docs/sdk', '/docs/sdk/'])('renders %s while authentication never resolves without loading project/key/status data', (path) => {
  vi.mocked(authApi.me).mockReturnValue(new Promise(() => {}));
  open(path);
  expect(screen.getByRole('heading', { level: 1, name: '개발자 SDK 가이드' })).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

it.each(['anonymous', 'failed', 'authenticated'])('keeps the guide public with %s authentication', async (state) => {
  if (state === 'failed') vi.mocked(authApi.me).mockRejectedValue(new Error('offline'));
  if (state === 'authenticated') vi.mocked(authApi.me).mockResolvedValue({ authenticated: true, user: { username: 'admin' } });
  open('/docs/sdk');
  await act(async () => {});
  expect(screen.getByRole('heading', { level: 1, name: '개발자 SDK 가이드' })).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

it('switches KO/EN, retains the exact install version and provides focusable code and valid section links', () => {
  vi.mocked(authApi.me).mockReturnValue(new Promise(() => {}));
  open('/docs/sdk');
  expect(screen.getByText('npm install --save-exact @pseudo-lab/iterglow-sdk@0.2.1')).toBeInTheDocument();
  expect(screen.getByText(/이 제한은 아직 해결되지 않았습니다/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }));
  expect(screen.getByRole('heading', { level: 1, name: 'Developer SDK guide' })).toBeInTheDocument();
  expect(screen.getByText(/these limitations remain unresolved/)).toBeInTheDocument();
  expect(screen.getAllByLabelText('Code example')).toHaveLength(4);
  for (const pre of screen.getAllByLabelText('Code example')) expect(pre).toHaveAttribute('tabindex', '0');
  for (const link of screen.getAllByRole('link').filter(link => link.getAttribute('href')?.startsWith('#'))) {
    expect(document.getElementById(link.getAttribute('href')!.slice(1))).toBeInTheDocument();
  }
  expect(screen.queryByRole('button', { name: 'Toggle theme' })).not.toBeInTheDocument();
  expect(document.documentElement).not.toHaveClass('dark');
});

it.each(['/experiments', '/projects', '/api-key', '/docs/sdk/missing'])('preserves anonymous protection/fallback for %s', async (path) => {
  open(path);
  expect(await screen.findByRole('heading', { level: 1, name: '로그인' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '개발자 SDK 가이드' })).not.toBeInTheDocument();
});

it.each(['/', '/login'])('offers a public guide link from %s', async (path) => {
  open(path);
  const links = await screen.findAllByRole('link', { name: 'SDK 가이드' });
  expect(links[0]).toHaveAttribute('href', '/docs/sdk');
  fireEvent.click(links[0]);
  expect(screen.getByRole('heading', { name: '개발자 SDK 가이드' })).toBeInTheDocument();
});

it.each(['ko', 'en'] as const)('offers a guide link in the management navigation in %s', async (lang) => {
  render(<MemoryRouter><ProjectProvider><MainLayout lang={lang} setLang={() => {}} theme="light" setTheme={() => {}} backendStatus="Online">Workspace</MainLayout></ProjectProvider></MemoryRouter>);
  await waitFor(() => expect(screen.getByRole('link', { name: lang === 'ko' ? 'SDK 가이드' : 'SDK guide' })).toHaveAttribute('href', '/docs/sdk'));
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{JSON.stringify({ pathname: location.pathname, search: location.search, hash: location.hash, state: location.state })}</output>;
}

it.each([
  ['ko', 'login'], ['en', 'login'],
  ['ko', 'introduction'], ['en', 'introduction'],
  ['ko', 'brand'], ['en', 'brand'],
  ['ko', 'introduction-guide'], ['en', 'introduction-guide'],
] as const)('returns to the original protected route after the %s guide via %s', async (lang, via) => {
  localStorage.setItem('lang', lang);
  render(<MemoryRouter initialEntries={[{ pathname: '/experiments/review-original', search: '?tab=summary', hash: '#details', state: { review: 'keep' } }]}><App /><LocationProbe /></MemoryRouter>);
  const loginTitle = lang === 'ko' ? '로그인' : 'Sign in';
  const guideLabel = lang === 'ko' ? 'SDK 가이드' : 'SDK guide';
  const readLocation = () => JSON.parse(screen.getByTestId('location').textContent!);
  await screen.findByRole('heading', { level: 1, name: loginTitle });
  const returnState = readLocation().state;
  expect(returnState.from.pathname).toBe('/experiments/review-original');
  fireEvent.click(screen.getByRole('link', { name: guideLabel }));
  expect(readLocation().state).toEqual(returnState);
  if (via !== 'login') {
    fireEvent.click(screen.getByRole('link', { name: via === 'brand' ? (lang === 'ko' ? '이터글로 홈' : 'Iterglow home') : lang === 'ko' ? '서비스 소개' : 'Introduction' }));
    expect(readLocation().pathname).toBe('/');
    expect(readLocation().state).toEqual(returnState);
    if (via === 'introduction-guide') {
      for (const index of [0, 1]) {
        fireEvent.click(screen.getAllByRole('link', { name: guideLabel })[index]);
        expect(readLocation().state).toEqual(returnState);
        fireEvent.click(screen.getByRole('link', { name: lang === 'ko' ? '서비스 소개' : 'Introduction' }));
        expect(readLocation().state).toEqual(returnState);
      }
    }
  }
  fireEvent.click(screen.getAllByRole('link', { name: loginTitle })[0]);
  await screen.findByRole('heading', { level: 1, name: loginTitle });
  expect(readLocation().state).toEqual(returnState);
  expect(screen.getByRole('button', { name: lang === 'ko' ? 'Google로 계속하기' : 'Continue with Google' })).toBeInTheDocument();
  sessionStorage.setItem('oauthReturnPath', readLocation().state.from.pathname + readLocation().state.from.search + readLocation().state.from.hash);
  cleanup();
  vi.mocked(authApi.me).mockResolvedValue({ authenticated: true, user: { username: 'google-member', is_admin: false } });
  render(<MemoryRouter initialEntries={['/login?oauth=success']}><App /><LocationProbe /></MemoryRouter>);
  await waitFor(() => expect(readLocation().pathname).toBe('/experiments/review-original'));
  expect(readLocation().search).toBe('?tab=summary');
  expect(readLocation().hash).toBe('#details');
});

it.each(['ko', 'en'] as const)('uses the existing default destination after direct guide access in %s', async (lang) => {
  localStorage.setItem('lang', lang);
  render(<MemoryRouter initialEntries={['/docs/sdk']}><App /><LocationProbe /></MemoryRouter>);
  await act(async () => {});
  fireEvent.click(screen.getByRole('link', { name: lang === 'ko' ? '로그인' : 'Sign in' }));
  expect(JSON.parse(screen.getByTestId('location').textContent!).state).toBeNull();
  cleanup();
  sessionStorage.clear();
  vi.mocked(authApi.me).mockResolvedValue({ authenticated: true, user: { username: 'google-admin', is_admin: true } });
  render(<MemoryRouter initialEntries={['/login?oauth=success']}><App /><LocationProbe /></MemoryRouter>);
  await waitFor(() => expect(JSON.parse(screen.getByTestId('location').textContent!).pathname).toBe('/experiments'));
});


it('returns an authenticated guide reader to the exact workspace screen', async () => {
  vi.mocked(authApi.me).mockResolvedValue({ authenticated: true, user: { username: 'member', is_admin: false } });
  render(<MemoryRouter initialEntries={['/api-key?view=keys#details']}><App /><LocationProbe /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('link', { name: 'SDK 가이드' }));
  await screen.findByRole('heading', { name: '개발자 SDK 가이드' });
  const links = await screen.findAllByRole('link', { name: '작업공간으로 돌아가기' });
  expect(links[0]).toHaveAttribute('href', '/api-key?view=keys#details');
  expect(screen.queryByRole('link', { name: '로그인' })).not.toBeInTheDocument();
  fireEvent.click(links[0]);
  await waitFor(() => expect(JSON.parse(screen.getByTestId('location').textContent!)).toMatchObject({ pathname: '/api-key', search: '?view=keys', hash: '#details' }));
});

it('sends an authenticated unknown route to project management instead of a blank screen', async () => {
  vi.mocked(authApi.me).mockResolvedValue({ authenticated: true, user: { username: 'member', is_admin: false } });
  render(<MemoryRouter initialEntries={['/docs/sdk/missing']}><App /><LocationProbe /></MemoryRouter>);
  await waitFor(() => expect(JSON.parse(screen.getByTestId('location').textContent!).pathname).toBe('/projects'));
  expect(screen.getByRole('heading', { level: 1, name: '프로젝트 관리' })).toBeInTheDocument();
});

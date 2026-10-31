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
  expect(screen.getByText('npm install --save-exact @pseudo-lab/experibase-sdk@0.1.5')).toBeInTheDocument();
  expect(screen.getByText(/아직 출시되지 않았습니다/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }));
  expect(screen.getByRole('heading', { level: 1, name: 'Developer SDK guide' })).toBeInTheDocument();
  expect(screen.getByText(/not released yet/)).toBeInTheDocument();
  expect(screen.getAllByLabelText('Code example')).toHaveLength(4);
  for (const pre of screen.getAllByLabelText('Code example')) expect(pre).toHaveAttribute('tabindex', '0');
  for (const link of screen.getAllByRole('link').filter(link => link.getAttribute('href')?.startsWith('#'))) {
    expect(document.getElementById(link.getAttribute('href')!.slice(1))).toBeInTheDocument();
  }
  fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
  expect(document.documentElement).toHaveClass('dark');
});

it.each(['/experiments', '/projects', '/api-key', '/docs/sdk/missing'])('preserves anonymous protection/fallback for %s', async (path) => {
  open(path);
  expect(await screen.findByRole('heading', { level: 1, name: '관리자 로그인' })).toBeInTheDocument();
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
  const login = vi.spyOn(authApi, 'login').mockResolvedValue({ authenticated: true, user: { username: 'admin' } });
  render(<MemoryRouter initialEntries={[{ pathname: '/experiments/review-original', search: '?tab=summary', hash: '#details', state: { review: 'keep' } }]}><App /><LocationProbe /></MemoryRouter>);
  const loginTitle = lang === 'ko' ? '관리자 로그인' : 'Admin sign in';
  const guideLabel = lang === 'ko' ? 'SDK 가이드' : 'SDK guide';
  const readLocation = () => JSON.parse(screen.getByTestId('location').textContent!);
  await screen.findByRole('heading', { level: 1, name: loginTitle });
  const returnState = readLocation().state;
  expect(returnState.from.pathname).toBe('/experiments/review-original');
  fireEvent.click(screen.getByRole('link', { name: guideLabel }));
  expect(readLocation().state).toEqual(returnState);
  if (via !== 'login') {
    fireEvent.click(screen.getByRole('link', { name: via === 'brand' ? 'ExperiBase' : lang === 'ko' ? '서비스 소개' : 'Introduction' }));
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
  fireEvent.change(screen.getByLabelText(lang === 'ko' ? '아이디' : 'Username'), { target: { value: 'admin' } });
  fireEvent.change(screen.getByLabelText(lang === 'ko' ? '비밀번호' : 'Password'), { target: { value: 'test-password' } });
  fireEvent.click(screen.getByRole('button', { name: lang === 'ko' ? '로그인' : 'Sign in' }));
  await waitFor(() => expect(readLocation().pathname).toBe('/experiments/review-original'));
  expect(login).toHaveBeenCalledWith('admin', 'test-password');
  expect(readLocation().search).toBe('');
  expect(readLocation().hash).toBe('');
});

it.each(['ko', 'en'] as const)('uses the existing default destination after direct guide access in %s', async (lang) => {
  localStorage.setItem('lang', lang);
  vi.spyOn(authApi, 'login').mockResolvedValue({ authenticated: true, user: { username: 'admin' } });
  render(<MemoryRouter initialEntries={['/docs/sdk']}><App /><LocationProbe /></MemoryRouter>);
  await act(async () => {});
  fireEvent.click(screen.getByRole('link', { name: lang === 'ko' ? '관리자 로그인' : 'Admin sign in' }));
  expect(JSON.parse(screen.getByTestId('location').textContent!).state).toBeNull();
  fireEvent.change(screen.getByLabelText(lang === 'ko' ? '아이디' : 'Username'), { target: { value: 'admin' } });
  fireEvent.change(screen.getByLabelText(lang === 'ko' ? '비밀번호' : 'Password'), { target: { value: 'test-password' } });
  fireEvent.click(screen.getByRole('button', { name: lang === 'ko' ? '로그인' : 'Sign in' }));
  await waitFor(() => expect(JSON.parse(screen.getByTestId('location').textContent!).pathname).toBe('/experiments'));
});

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { LoginPage } from '@/features/auth/LoginPage';
import { authApi } from '@/services/authApi';
import { apiFetch } from '@/services/http';

const authenticated = { authenticated: true, user: { username: 'admin' } };
const anonymous = { authenticated: false, user: null };

function SessionProbe() {
  const { state, user, logout } = useAuth();
  return <><span>{state}:{user?.username}</span><button onClick={() => void logout().catch(() => {})}>Sign out</button></>;
}

function renderLogin(lang: 'ko' | 'en') {
  return render(<MemoryRouter initialEntries={[{ pathname: '/login', state: { from: { pathname: '/experiments' } } }]}>
    <AuthProvider><Routes>
      <Route path="/login" element={<LoginPage lang={lang} setLang={() => {}} theme="light" setTheme={() => {}} />} />
      <Route path="/experiments" element={<SessionProbe />} />
    </Routes></AuthProvider>
  </MemoryRouter>);
}

beforeEach(() => {
  vi.spyOn(authApi, 'me').mockResolvedValue(anonymous);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('restores a session and returns to the original protected route', async () => {
  vi.mocked(authApi.me).mockResolvedValue(authenticated);
  renderLogin('en');
  expect(await screen.findByText('authenticated:admin')).toBeInTheDocument();
});

it.each(['ko', 'en'] as const)('shows login errors and supports retry in %s', async (lang) => {
  const login = vi.spyOn(authApi, 'login').mockRejectedValueOnce(new Error('invalid_credentials')).mockRejectedValueOnce(new Error('login_failed')).mockResolvedValue(authenticated);
  renderLogin(lang);
  fireEvent.change(screen.getByLabelText(lang === 'ko' ? '아이디' : 'Username'), { target: { value: 'admin' } });
  fireEvent.change(screen.getByLabelText(lang === 'ko' ? '비밀번호' : 'Password'), { target: { value: 'secret' } });
  const submit = screen.getByRole('button', { name: lang === 'ko' ? '로그인' : 'Sign in' });
  fireEvent.click(submit);
  expect(await screen.findByRole('alert')).toHaveTextContent(lang === 'ko' ? '아이디와 비밀번호를 확인해 주세요.' : 'Check your username and password.');
  fireEvent.click(submit);
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(lang === 'ko' ? '현재 로그인할 수 없습니다.' : 'Sign in is unavailable.'));
  fireEvent.click(submit);
  expect(await screen.findByText('authenticated:admin')).toBeInTheDocument();
  expect(login).toHaveBeenLastCalledWith('admin', 'secret');
});

it('keeps the session on failed logout and clears it after successful logout', async () => {
  vi.mocked(authApi.me).mockResolvedValue(authenticated);
  const logout = vi.spyOn(authApi, 'logout').mockRejectedValueOnce(new Error('network')).mockResolvedValue(undefined);
  render(<AuthProvider><SessionProbe /></AuthProvider>);
  expect(await screen.findByText('authenticated:admin')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  expect(screen.getByText('authenticated:admin')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button'));
  expect(await screen.findByText('anonymous:')).toBeInTheDocument();
});

it('includes cookies and expires the UI session on management 401', async () => {
  vi.mocked(authApi.me).mockResolvedValue(authenticated);
  const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 401 } as Response);
  render(<AuthProvider><SessionProbe /></AuthProvider>);
  await screen.findByText('authenticated:admin');
  await act(async () => { await apiFetch('/api/v1/experiments/'); });
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/experiments/', { credentials: 'include' });
  expect(screen.getByText('anonymous:')).toBeInTheDocument();
});

it('does not expire an admin session for access denial or failed login', async () => {
  vi.mocked(authApi.me).mockResolvedValue(authenticated);
  const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false, status: 403 } as Response).mockResolvedValueOnce({ ok: false, status: 401 } as Response);
  render(<AuthProvider><SessionProbe /></AuthProvider>);
  await screen.findByText('authenticated:admin');
  await act(async () => { await apiFetch('/api/v1/experiments/'); await apiFetch('/api/v1/auth/login'); });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(screen.getByText('authenticated:admin')).toBeInTheDocument();
});

it('reports an HTTP logout failure to the caller', async () => {
  vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 503 } as Response);
  await expect(authApi.logout()).rejects.toThrow('logout_failed');
});

it('stays in loading state while session restoration is pending', () => {
  vi.mocked(authApi.me).mockReturnValue(new Promise(() => {}));
  render(<AuthProvider><SessionProbe /></AuthProvider>);
  expect(screen.getByText('loading:')).toBeInTheDocument();
});

it('expires sessions for management paths and queries containing auth', async () => {
  vi.mocked(authApi.me).mockResolvedValue(authenticated);
  vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 401 } as Response);
  const listener = vi.fn();
  window.addEventListener('auth:unauthorized', listener);
  try {
    await apiFetch('/api/v1/projects/auth/api-key');
    await apiFetch('/api/v1/projects/?search=/auth/');
    expect(listener).toHaveBeenCalledTimes(2);
  } finally {
    window.removeEventListener('auth:unauthorized', listener);
  }
});

it('ignores an old management 401 after a successful new login', async () => {
  vi.mocked(authApi.me).mockResolvedValue(authenticated);
  vi.spyOn(authApi, 'login').mockResolvedValue(authenticated);
  let resolveOld!: (response: Response) => void;
  vi.spyOn(global, 'fetch').mockReturnValue(new Promise(resolve => { resolveOld = resolve; }));
  function LoginProbe() {
    const { state, login } = useAuth();
    return <button onClick={() => void login('admin', 'secret')}>{state}</button>;
  }
  render(<AuthProvider><LoginProbe /></AuthProvider>);
  await screen.findByRole('button', { name: 'authenticated' });
  const oldRequest = apiFetch('/api/v1/projects/');
  await act(async () => window.dispatchEvent(new Event('auth:unauthorized')));
  await act(async () => fireEvent.click(screen.getByRole('button')));
  expect(screen.getByRole('button')).toHaveTextContent('authenticated');
  await act(async () => {
    resolveOld({ ok: false, status: 401 } as Response);
    await oldRequest;
  });
  expect(screen.getByRole('button')).toHaveTextContent('authenticated');
  await act(async () => { await apiFetch('/api/v1/projects/'); });
  expect(screen.getByRole('button')).toHaveTextContent('anonymous');
});

it('does not restore an outdated session after an unauthorized event', async () => {
  let restore!: (value: typeof authenticated) => void;
  vi.mocked(authApi.me).mockReturnValue(new Promise(resolve => { restore = resolve; }));
  render(<AuthProvider><SessionProbe /></AuthProvider>);
  await act(async () => window.dispatchEvent(new Event('auth:unauthorized')));
  await act(async () => restore(authenticated));
  expect(screen.getByText('anonymous:')).toBeInTheDocument();
});

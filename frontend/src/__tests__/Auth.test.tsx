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
  sessionStorage.clear();
  vi.spyOn(authApi, 'me').mockResolvedValue(anonymous);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('restores a session and returns to the original protected route', async () => {
  vi.mocked(authApi.me).mockResolvedValue(authenticated);
  renderLogin('en');
  expect(await screen.findByText('authenticated:admin')).toBeInTheDocument();
});

it.each(['ko', 'en'] as const)('offers Google as the only login entry in %s', async (lang) => {
  const login = vi.spyOn(authApi, 'login');
  vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ google: true }) } as Response);
  renderLogin(lang);
  await waitFor(() => expect(screen.getByRole('button', { name: lang === 'ko' ? 'Google로 계속하기' : 'Continue with Google' })).toBeEnabled());
  expect(screen.queryByLabelText(/Username|Password|아이디|비밀번호/)).not.toBeInTheDocument();
  expect(document.querySelector('input[type="password"]')).toBeNull();
  expect(login).not.toHaveBeenCalled();
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


it.each(['ko', 'en'] as const)('shows disabled Google login when unconfigured in %s', async (lang) => {
  vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ google: false }) } as Response);
  renderLogin(lang);
  expect(await screen.findByText(lang === 'ko' ? '이 설치에는 Google 로그인이 설정되지 않았습니다.' : 'Google sign in is not configured for this installation.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: lang === 'ko' ? 'Google로 계속하기' : 'Continue with Google' })).toBeDisabled();
});

it('enables Google login only when provider configuration is available', async () => {
  vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ google: true }) } as Response);
  renderLogin('en');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled());
});


it.each(['/api-key', '/bug-report', '//evil.invalid', '/\\evil.invalid', 'https://evil.invalid', '/%2fexample', '/%252fexample', '/%5cfoo', '/%0dfoo', '/\u007ffoo'])(
  'restores only a safe local OAuth return path: %s', async (path) => {
    sessionStorage.setItem('oauthReturnPath', path);
    vi.mocked(authApi.me).mockResolvedValue({ authenticated: true, user: { username: 'member', is_admin: false } });
    render(<MemoryRouter initialEntries={['/login?oauth=success']}><AuthProvider><Routes>
      <Route path="/login" element={<LoginPage lang="en" setLang={() => {}} theme="light" setTheme={() => {}} />} />
      <Route path="/api-key" element={<span>Original destination</span>} />
      <Route path="/bug-report" element={<span>Original destination</span>} />
      <Route path="/projects" element={<span>Safe default destination</span>} />
    </Routes></AuthProvider></MemoryRouter>);
    expect(await screen.findByText(['/api-key', '/bug-report'].includes(path) ? 'Original destination' : 'Safe default destination')).toBeInTheDocument();
    expect(sessionStorage.getItem('oauthReturnPath')).toBeNull();
  },
);


it.each([true, false])('uses the same OAuth callback UI with is_admin=%s', async (isAdmin) => {
  vi.mocked(authApi.me).mockResolvedValue({ authenticated: true, user: { username: 'google-user', account_id: 'synthetic-account', is_admin: isAdmin } });
  render(<MemoryRouter initialEntries={['/login?oauth=success']}><AuthProvider><Routes>
    <Route path="/login" element={<LoginPage lang="en" setLang={() => {}} />} />
    <Route path="/experiments" element={<span>Admin default</span>} />
    <Route path="/projects" element={<span>Member default</span>} />
  </Routes></AuthProvider></MemoryRouter>);
  expect(await screen.findByText(isAdmin ? 'Admin default' : 'Member default')).toBeInTheDocument();
});

it('keeps Google disabled on provider lookup failure without exposing password login', async () => {
  vi.spyOn(global, 'fetch').mockRejectedValue(new Error('provider unavailable'));
  renderLogin('en');
  await screen.findByText('Google sign in is not configured for this installation.');
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();
  expect(document.querySelector('input[type="password"]')).toBeNull();
});

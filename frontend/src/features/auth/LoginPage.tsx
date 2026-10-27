import React, { useState, useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';

import { API_BASE_URL, apiFetch } from '@/services/http';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from './AuthContext';

interface LoginPageProps {
  lang: 'en' | 'ko';
}

export function LoginPage({ lang }: LoginPageProps) {
  const { state, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [providersLoading, setProvidersLoading] = useState(true);
  useEffect(() => {
    let active = true;
    apiFetch(`${API_BASE_URL}/auth/providers`)
      .then(res => res.ok ? res.json() : { google: false })
      .then(data => { if (active) setGoogleEnabled(data.google === true); })
      .catch(() => { if (active) setGoogleEnabled(false); })
      .finally(() => { if (active) setProvidersLoading(false); });
    return () => { active = false; };
  }, []);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const copy = {
    en: {
      title: 'Sign in',
      google: 'Continue with Google',
      googleUnavailable: 'Google sign in is not configured for this installation.',
      googleFailed: 'Google sign in was cancelled or failed. Please try again.',
      checking: 'Checking sign-in options...',
      subtitle: 'Sign in to manage experiments and feature flags.',
      username: 'Username',
      password: 'Password',
      submit: 'Sign in',
      submitting: 'Signing in...',
      error: 'Check your username and password.',
      unavailable: 'Sign in is unavailable. Please try again later.',
    },
    ko: {
      title: '로그인',
      google: 'Google로 계속하기',
      googleUnavailable: '이 설치에는 Google 로그인이 설정되지 않았습니다.',
      googleFailed: 'Google 로그인이 취소되었거나 실패했습니다. 다시 시도해 주세요.',
      checking: '로그인 방식 확인 중...',
      subtitle: '실험과 Feature Flag를 관리하려면 로그인하세요.',
      username: '아이디',
      password: '비밀번호',
      submit: '로그인',
      submitting: '로그인 중...',
      error: '아이디와 비밀번호를 확인해 주세요.',
      unavailable: '현재 로그인할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    },
  }[lang];

  if (state === 'authenticated') {
    const nextPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/experiments';
    return <Navigate to={nextPath} replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      const nextPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/experiments';
      navigate(nextPath, { replace: true });
    } catch (error) {
      setError(error instanceof Error && error.message === 'invalid_credentials' ? copy.error : copy.unavailable);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LockKeyhole size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{copy.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>
          </div>
        </div>

        <Button type="button" variant="outline" className="mb-3 w-full" disabled={!googleEnabled || providersLoading}
          onClick={() => window.location.assign(`${API_BASE_URL}/auth/google/start`)}>{copy.google}</Button>
        {providersLoading ? <p className="mb-4 text-sm text-muted-foreground" role="status">{copy.checking}</p> :
          !googleEnabled && <p className="mb-4 text-sm text-muted-foreground">{copy.googleUnavailable}</p>}
        {new URLSearchParams(location.search).get('oauth') === 'failed' &&
          <p className="mb-4 text-sm text-destructive" role="alert">{copy.googleFailed}</p>}

        <label className="mb-4 block text-sm font-medium text-foreground">
          {copy.username}
          <Input
            className="mt-2 bg-background border-input text-foreground"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="mb-4 block text-sm font-medium text-foreground">
          {copy.password}
          <Input
            className="mt-2 bg-background border-input text-foreground"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="mb-4 text-sm text-destructive" role="alert">{error}</p>}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? copy.submitting : copy.submit}
        </Button>
      </form>
    </main>
  );
}

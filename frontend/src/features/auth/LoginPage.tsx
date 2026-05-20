import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';

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
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const copy = {
    en: {
      title: 'Admin sign in',
      subtitle: 'Sign in to manage experiments and feature flags.',
      username: 'Username',
      password: 'Password',
      submit: 'Sign in',
      submitting: 'Signing in...',
      error: 'Check your username and password.',
    },
    ko: {
      title: '관리자 로그인',
      subtitle: '실험과 Feature Flag를 관리하려면 로그인하세요.',
      username: '아이디',
      password: '비밀번호',
      submit: '로그인',
      submitting: '로그인 중...',
      error: '아이디와 비밀번호를 확인해 주세요.',
    },
  }[lang];

  if (state === 'authenticated') {
    const nextPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/dashboard';
    return <Navigate to={nextPath} replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      const nextPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/dashboard';
      navigate(nextPath, { replace: true });
    } catch {
      setError(copy.error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <LockKeyhole size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{copy.title}</h1>
            <p className="mt-1 text-sm text-slate-400">{copy.subtitle}</p>
          </div>
        </div>

        <label className="mb-4 block text-sm font-medium text-slate-200">
          {copy.username}
          <Input
            className="mt-2 bg-slate-950 border-slate-700 text-slate-100"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="mb-4 block text-sm font-medium text-slate-200">
          {copy.password}
          <Input
            className="mt-2 bg-slate-950 border-slate-700 text-slate-100"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="mb-4 text-sm text-rose-300" role="alert">{error}</p>}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? copy.submitting : copy.submit}
        </Button>
      </form>
    </main>
  );
}

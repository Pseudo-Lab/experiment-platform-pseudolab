import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Diamond, Globe, Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from './AuthContext';

interface LoginPageProps {
  lang: 'en' | 'ko';
  setLang: (lang: 'en' | 'ko') => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export function LoginPage({ lang, setLang, theme, setTheme }: LoginPageProps) {
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
      introTitle: 'Your next product decision starts here.',
      platform: 'OPEN-SOURCE EXPERIMENTATION',
      sample: 'Illustrative example', project: 'Example project · Signup experience', experiment: 'Compare signup messages', experimentText: 'Define a hypothesis and variants, then check signup completion events.', variants: ['A · Original message', 'B · Clear next step'], draft: 'Draft · No data collected', flow: 'Configure → Integrate → Check events → Decide', back: 'Back to the introduction',
      introText: 'Compare screens and features, collect user behavior, and inform your next decision with ExperiBase.',
      about: 'Explore ExperiBase',
      access: 'An administrator account is required. Connect your service through the SDK or API to collect experiment data.',
      language: '한국어로 변경', themeLabel: 'Toggle theme',
      subtitle: 'Sign in to manage experiments and feature flags.',
      username: 'Username',
      password: 'Password',
      submit: 'Sign in',
      submitting: 'Signing in...',
      error: 'Check your username and password.',
      unavailable: 'Sign in is unavailable. Please try again later.',
    },
    ko: {
      title: '관리자 로그인',
      introTitle: '다음 제품 결정, ExperiBase에서 시작하세요.',
      platform: 'OPEN-SOURCE EXPERIMENTATION',
      sample: '설명용 예시', project: '예시 프로젝트 · 가입 경험 개선', experiment: '가입 안내 문구 비교', experimentText: '가설과 비교할 버전을 정하고, 가입 완료 이벤트를 확인하는 실험입니다.', variants: ['A · 기존 안내', 'B · 다음 행동 강조'], draft: '초안 · 데이터 수집 전', flow: '설정 → 서비스 연동 → 수집 확인 → 결과·결정', back: '서비스 소개로 돌아가기',
      introText: '화면과 기능을 비교하고, 사용자 행동을 수집해 다음 결정을 돕는 실험 플랫폼 ExperiBase입니다.',
      about: '서비스 살펴보기',
      access: '관리자 계정으로 이용합니다. 실험 데이터를 수집하려면 서비스에 SDK 또는 API를 연동해야 합니다.',
      language: 'Switch to English', themeLabel: '화면 테마 변경',
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
    if (submitting) return;
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
    <div className="service-entry min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 border-b border-border px-4 py-5 md:px-6">
        <Link to="/" state={location.state} className="flex items-center gap-2 rounded-md font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Diamond aria-hidden="true" className="h-8 w-8 rounded-lg bg-primary p-1.5 text-primary-foreground" />ExperiBase
        </Link>
        <div className="flex items-center gap-1"><Button asChild variant="ghost" className="mr-3 hidden sm:inline-flex"><Link to="/" state={location.state}>{copy.about}</Link></Button>
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={copy.themeLabel}>{theme === 'light' ? <Moon /> : <Sun />}</Button>
          <Button variant="outline" size="sm" onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')} aria-label={copy.language}><Globe aria-hidden="true" />{lang === 'ko' ? 'EN' : 'KO'}</Button>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl items-center justify-center px-4 py-8 md:px-6 lg:py-16">
      <div className="grid w-full items-center gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
        <section aria-label="ExperiBase" className="min-w-0 space-y-5 lg:rounded-2xl lg:border lg:border-primary/15 lg:bg-primary/5 lg:p-9">
          <p className="text-xs font-semibold tracking-widest text-primary">{copy.platform}</p>
          <h2 className="max-w-xl text-2xl font-bold leading-snug tracking-tight break-keep md:text-4xl md:leading-snug">{copy.introTitle}</h2>
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground md:text-base">{copy.introText}</p>
          <div className="hidden lg:block">
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex flex-wrap justify-between gap-2 text-[10px] text-muted-foreground"><span>{copy.project}</span><span>{copy.sample}</span></div>
              <h3 className="mt-3 text-sm font-semibold">{copy.experiment}</h3><p className="mt-2 text-xs leading-loose text-muted-foreground">{copy.experimentText}</p>
              <div className="my-3 flex flex-wrap gap-2">{copy.variants.map(v => <span key={v} className="rounded border border-border px-2 py-1 text-xs">{v}</span>)}</div>
              <span className="rounded-full border border-border bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground">{copy.draft}</span>
            </div>
            <p className="mt-5 text-xs leading-relaxed text-muted-foreground">{copy.flow}</p>
          </div>
        </section>
        <form aria-busy={submitting} onSubmit={handleSubmit} className="w-full rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-7">
            <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{copy.subtitle}</p>
          </div>

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
            {submitting ? copy.submitting : copy.submit}<ArrowRight aria-hidden="true" />
          </Button>
          <p className="mt-4 text-xs leading-loose text-muted-foreground">{copy.access}</p>
          <Link to="/" state={location.state} className="mt-6 block rounded text-center text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">{copy.back}</Link>
        </form>
      </div>
      </main>
    </div>
  );
}

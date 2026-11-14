import React, { lazy, Suspense, useState, useEffect, useLayoutEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { SdkGuidePage } from './features/docs/SdkGuidePage';
import { MainLayout } from './layouts/MainLayout';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { ServiceIntroPage } from './features/about/ServiceIntroPage';
import { LoginPage } from './features/auth/LoginPage';
import { BugReport } from './features/dashboard/components/BugReport';
import { Experiments } from './features/dashboard/components/Experiments';
import { Projects } from './features/dashboard/components/Projects';
import { ProjectProvider } from './contexts/ProjectContext';
import { Button } from './components/ui/button';

const ExperimentDetail = lazy(() => import('./features/dashboard/components/ExperimentDetail').then(module => ({ default: module.ExperimentDetail })));
const GitHubDashboard = lazy(() => import('./features/dashboard/components/GitHubDashboard').then(module => ({ default: module.GitHubDashboard })));
const DiscordDashboard = lazy(() => import('./features/dashboard/components/DiscordDashboard').then(module => ({ default: module.DiscordDashboard })));
const FeatureFlags = lazy(() => import('./features/dashboard/components/FeatureFlags').then(module => ({ default: module.FeatureFlags })));
const ExampleApp = lazy(() => import('./features/example/ExampleApp').then(module => ({ default: module.ExampleApp })));
const ProjectSettings = lazy(() => import('./features/dashboard/components/ProjectSettings').then(module => ({ default: module.ProjectSettings })));
const ApiKeyPage = lazy(() => import('./features/dashboard/components/ApiKeyPage').then(module => ({ default: module.ApiKeyPage })));
const Placements = lazy(() => import('./features/dashboard/components/Placements').then(module => ({ default: module.Placements })));
const BugReportDetail = lazy(() => import('./features/dashboard/components/BugReportDetail').then(module => ({ default: module.BugReportDetail })));

class RouteErrorBoundary extends React.Component<{ lang: 'ko' | 'en'; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <div role="alert" className="space-y-3">
        <p>{this.props.lang === 'ko' ? '화면을 불러오지 못했습니다. 새로고침 후 다시 시도하세요.' : 'Could not load this page. Refresh to try again.'}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>{this.props.lang === 'ko' ? '새로고침' : 'Refresh'}</Button>
      </div>;
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function AppShell() {
  const [lang, setLang] = useState<'en' | 'ko'>(() => {
    const savedLang = localStorage.getItem('lang');
    return (savedLang === 'en' || savedLang === 'ko') ? savedLang : 'ko';
  });

  const [backendStatus, setBackendStatus] = useState<string>("connecting...");
  const { state: authState, user, logout } = useAuth();
  const location = useLocation();
  const isServiceIntro = location.pathname === '/' || location.pathname === '/about' || location.pathname === '/about/';

  const isSdkGuide = location.pathname === '/docs/sdk' || location.pathname === '/docs/sdk/';

  useEffect(() => {
    if (isServiceIntro || isSdkGuide) return;
    const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || '/api/v1';

    fetch(`${apiBaseUrl}/status/`)
      .then(res => res.json())
      .then(data => setBackendStatus(data.status === 'connected' ? 'Online' : 'Error'))
      .catch(() => setBackendStatus('Offline'));
  }, [isServiceIntro, isSdkGuide]);

  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);

  useLayoutEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
  }, []);

  if (isServiceIntro) {
    if (location.pathname !== '/') {
      return <Navigate to={{ pathname: '/', search: location.search, hash: location.hash }} replace state={location.state} />;
    }
    return <ServiceIntroPage lang={lang} setLang={setLang} authenticated={authState === 'authenticated'} />;
  }

  if (isSdkGuide) {
    return <SdkGuidePage lang={lang} setLang={setLang} />;
  }

  if (authState === 'loading') {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-sm font-medium text-muted-foreground">{lang === 'ko' ? '불러오는 중...' : 'Loading...'}</div>
      </main>
    );
  }

  if (location.pathname === '/login') {
    return <LoginPage lang={lang} setLang={setLang} />;
  }

  if (authState === 'anonymous') {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage lang={lang} setLang={setLang} />} />
        <Route path="*" element={<Navigate to="/login" replace state={{ from: location }} />} />
      </Routes>
    );
  }

  return (
    <ProjectProvider key={user?.account_id || user?.username}>
      <MainLayout
        lang={lang}
        setLang={setLang}
        backendStatus={backendStatus}
        userLabel={user?.display_name || user?.email || user?.username}
        userEmail={user?.email}
        accountId={user?.account_id}
        isAdmin={user?.is_admin !== false}
        onLogout={logout}
      >
        <RouteErrorBoundary key={location.pathname} lang={lang}>
        <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">{lang === 'ko' ? '화면을 불러오는 중...' : 'Loading page...'}</p>}>
        <Routes>
          <Route path="/login" element={<Navigate to="/experiments" replace />} />
          <Route path="/dashboard" element={<Navigate to="/experiments" replace />} />
          <Route path="/community" element={<Navigate to="/experiments" replace />} />
          <Route path="/experiments" element={<Experiments lang={lang} isAdmin={user?.is_admin !== false} />} />
          <Route path="/experiments/:id" element={<ExperimentDetail key={location.pathname} lang={lang} isAdmin={user?.is_admin !== false} />} />
          <Route path="/metrics" element={<Navigate to="/metrics/github" replace />} />
          <Route path="/metrics/github" element={user?.is_admin !== false ? <GitHubDashboard lang={lang} /> : <Navigate to="/projects" replace />} />
          <Route path="/metrics/discord" element={user?.is_admin !== false ? <DiscordDashboard lang={lang} /> : <Navigate to="/projects" replace />} />
          <Route path="/bug-report" element={<BugReport lang={lang} />} />
          <Route path="/bug-report/:id" element={<BugReportDetail lang={lang} isAdmin={user?.is_admin === true} />} />
          <Route path="/feature-flags" element={<FeatureFlags lang={lang} isAdmin={user?.is_admin !== false} />} />
          <Route path="/placements" element={user?.is_admin !== false ? <Placements lang={lang} /> : <Navigate to="/projects" replace />} />
          <Route path="/projects" element={<Projects lang={lang} />} />
          <Route path="/project-settings" element={<ProjectSettings lang={lang} />} />
          <Route path="/api-key" element={<ApiKeyPage lang={lang} />} />
          <Route path="/example/*" element={user?.is_admin !== false ? <ExampleApp lang={lang} /> : <Navigate to="/projects" replace />} />
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
        </Suspense>
        </RouteErrorBoundary>
      </MainLayout>
    </ProjectProvider>
  );
}

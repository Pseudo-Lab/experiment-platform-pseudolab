import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { LoginPage } from './features/auth/LoginPage';
import { BugReport } from './features/dashboard/components/BugReport';
import { BugReportDetail } from './features/dashboard/components/BugReportDetail';
import { Experiments } from './features/dashboard/components/Experiments';
import { ExperimentDetail } from './features/dashboard/components/ExperimentDetail';
import { GitHubDashboard } from './features/dashboard/components/GitHubDashboard';
import { DiscordDashboard } from './features/dashboard/components/DiscordDashboard';
import { FeatureFlags } from './features/dashboard/components/FeatureFlags';
import { Projects } from './features/dashboard/components/Projects';
import { ApiKeyPage } from './features/dashboard/components/ApiKeyPage';
import { Placements } from './features/dashboard/components/Placements';
import { ExampleApp } from './features/example/ExampleApp';
import { ProjectProvider } from './contexts/ProjectContext';

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

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
    // Check system preference if no saved theme
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });
  const [backendStatus, setBackendStatus] = useState<string>("connecting...");
  const { state: authState, user, logout } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || '/api/v1';

    fetch(`${apiBaseUrl}/status/`)
      .then(res => res.json())
      .then(data => setBackendStatus(data.status === 'connected' ? 'Online' : 'Error'))
      .catch(() => setBackendStatus('Offline'));
  }, []);

  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  if (authState === 'loading') {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-sm font-medium text-muted-foreground">{lang === 'ko' ? '불러오는 중...' : 'Loading...'}</div>
      </main>
    );
  }

  if (authState === 'anonymous') {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage lang={lang} />} />
        <Route path="*" element={<Navigate to="/login" replace state={{ from: location }} />} />
      </Routes>
    );
  }

  return (
    <ProjectProvider>
      <MainLayout
        lang={lang}
        setLang={setLang}
        theme={theme}
        setTheme={setTheme}
        backendStatus={backendStatus}
        userLabel={user?.username}
        isAdmin={user?.is_admin !== false}
        onLogout={logout}
      >
        <Routes>
          <Route path="/login" element={<Navigate to="/experiments" replace />} />
          <Route path="/" element={<Navigate to="/experiments" replace />} />
          <Route path="/dashboard" element={<Navigate to="/experiments" replace />} />
          <Route path="/community" element={<Navigate to="/experiments" replace />} />
          <Route path="/experiments" element={<Experiments lang={lang} />} />
          <Route path="/experiments/:id" element={<ExperimentDetail lang={lang} isAdmin={user?.is_admin !== false} />} />
          <Route path="/metrics" element={<Navigate to="/metrics/github" replace />} />
          <Route path="/metrics/github" element={user?.is_admin !== false ? <GitHubDashboard lang={lang} /> : <Navigate to="/projects" replace />} />
          <Route path="/metrics/discord" element={user?.is_admin !== false ? <DiscordDashboard lang={lang} /> : <Navigate to="/projects" replace />} />
          <Route path="/bug-report" element={user?.is_admin !== false ? <BugReport lang={lang} /> : <Navigate to="/projects" replace />} />
          <Route path="/bug-report/:id" element={user?.is_admin !== false ? <BugReportDetail lang={lang} /> : <Navigate to="/projects" replace />} />
          <Route path="/feature-flags" element={<FeatureFlags lang={lang} isAdmin={user?.is_admin !== false} />} />
          <Route path="/placements" element={user?.is_admin !== false ? <Placements lang={lang} /> : <Navigate to="/projects" replace />} />
          <Route path="/projects" element={<Projects lang={lang} />} />
          <Route path="/api-key" element={<ApiKeyPage lang={lang} />} />
          <Route path="/example/*" element={user?.is_admin !== false ? <ExampleApp lang={lang} /> : <Navigate to="/projects" replace />} />
        </Routes>
      </MainLayout>
    </ProjectProvider>
  );
}

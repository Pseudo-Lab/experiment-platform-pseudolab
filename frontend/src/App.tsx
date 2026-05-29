import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { Dashboard } from './features/dashboard/components/Dashboard';
import { BugReport } from './features/dashboard/components/BugReport';
import { BugReportDetail } from './features/dashboard/components/BugReportDetail';
import { Experiments } from './features/dashboard/components/Experiments';
import { ExperimentDetail } from './features/dashboard/components/ExperimentDetail';
import { GitHubDashboard } from './features/dashboard/components/GitHubDashboard';
import { DiscordDashboard } from './features/dashboard/components/DiscordDashboard';
import { FeatureFlags } from './features/dashboard/components/FeatureFlags';
import { Analytics } from './features/dashboard/components/Analytics';
import { Projects } from './features/dashboard/components/Projects';
import { ApiKeyPage } from './features/dashboard/components/ApiKeyPage';
import { VisualEditor } from './features/dashboard/components/VisualEditor';
import { Placements } from './features/dashboard/components/Placements';
import { ExampleApp } from './features/example/ExampleApp';
import { ProjectProvider } from './contexts/ProjectContext';

export default function App() {
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

  return (
    <ProjectProvider>
    <MainLayout
      lang={lang}
      setLang={setLang}
      theme={theme}
      setTheme={setTheme}
      backendStatus={backendStatus}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard lang={lang} />} />
        <Route path="/experiments" element={<Experiments lang={lang} />} />
        <Route path="/experiments/:id" element={<ExperimentDetail lang={lang} />} />
        <Route path="/metrics" element={<Navigate to="/metrics/github" replace />} />
        <Route path="/metrics/github" element={<GitHubDashboard lang={lang} />} />
        <Route path="/metrics/discord" element={<DiscordDashboard lang={lang} />} />
        <Route path="/bug-report" element={<BugReport lang={lang} />} />
        <Route path="/bug-report/:id" element={<BugReportDetail lang={lang} />} />
        <Route path="/feature-flags" element={<FeatureFlags lang={lang} />} />
        <Route path="/placements" element={<Placements lang={lang} />} />
        <Route path="/analytics" element={<Analytics lang={lang} />} />
        <Route path="/projects" element={<Projects lang={lang} />} />
        <Route path="/api-key" element={<ApiKeyPage lang={lang} />} />
        <Route path="/projects/:id/visual-editor" element={<VisualEditor lang={lang} />} />
        <Route path="/example/*" element={<ExampleApp lang={lang} />} />
      </Routes>
    </MainLayout>
    </ProjectProvider>
  );
}

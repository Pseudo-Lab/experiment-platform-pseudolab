import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { Dashboard } from './features/dashboard/components/Dashboard';
import { BugReport } from './features/dashboard/components/BugReport';
import { Experiments } from './features/dashboard/components/Experiments';
import { Metrics } from './features/dashboard/components/Metrics';

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
    fetch('http://localhost:8000/api/v1/status/')
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
        <Route path="/metrics" element={<Metrics lang={lang} />} />
        <Route path="/bug-report" element={<BugReport lang={lang} />} />
      </Routes>
    </MainLayout>
  );
}

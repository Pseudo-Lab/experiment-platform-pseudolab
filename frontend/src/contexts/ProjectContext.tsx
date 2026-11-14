import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { projectApi, type Project } from '../services/api';

const STORAGE_KEY = 'currentProjectId';

interface ProjectContextValue {
  projects: Project[];
  loading: boolean;
  error: boolean;
  currentProjectId: string | null;
  currentProject: Project | null;
  setCurrentProjectId: (id: string | null) => void;
  reloadProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue>({
  projects: [],
  loading: false,
  error: false,
  currentProjectId: null,
  currentProject: null,
  setCurrentProjectId: () => {},
  reloadProjects: async () => {},
});

export const useProject = () => useContext(ProjectContext);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentProjectId, setCurrentProjectIdState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY) || null,
  );
  const currentProjectIdRef = useRef<string | null>(currentProjectId);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const setCurrentProjectId = useCallback((id: string | null) => {
    if (!mountedRef.current) return;
    const nextId = id || null;
    currentProjectIdRef.current = nextId;
    setCurrentProjectIdState(nextId);
    if (nextId) localStorage.setItem(STORAGE_KEY, nextId);
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const reloadProjects = useCallback(async () => {
    if (!mountedRef.current) return;
    const seq = ++requestIdRef.current;
    setLoading(true);
    setError(false);
    try {
      const list = await projectApi.list();
      if (!mountedRef.current || seq !== requestIdRef.current) return;
      setProjects(list);
      // Drop and unpersist a stale/inaccessible selection after reload succeeds.
      const activeId = currentProjectIdRef.current;
      if (activeId && !list.some((p) => p.id === activeId)) {
        currentProjectIdRef.current = null;
        setCurrentProjectIdState(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      if (!mountedRef.current || seq !== requestIdRef.current) return;
      setProjects([]);
      setError(true);
    } finally {
      if (mountedRef.current && seq === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void reloadProjects();
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, [reloadProjects]);

  const currentProject = useMemo(
    () => projects.find((p) => p.id === currentProjectId) ?? null,
    [projects, currentProjectId],
  );

  const value = useMemo(
    () => ({ projects, loading, error, currentProjectId, currentProject, setCurrentProjectId, reloadProjects }),
    [projects, loading, error, currentProjectId, currentProject, setCurrentProjectId, reloadProjects],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

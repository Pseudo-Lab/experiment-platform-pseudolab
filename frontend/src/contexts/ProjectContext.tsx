import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { projectApi, type Project } from '../services/api';

const STORAGE_KEY = 'currentProjectId';

interface ProjectContextValue {
  projects: Project[];
  loading: boolean;
  currentProjectId: string | null;
  currentProject: Project | null;
  setCurrentProjectId: (id: string | null) => void;
  reloadProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue>({
  projects: [],
  loading: false,
  currentProjectId: null,
  currentProject: null,
  setCurrentProjectId: () => {},
  reloadProjects: async () => {},
});

export const useProject = () => useContext(ProjectContext);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentProjectId, setCurrentProjectIdState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY),
  );

  const setCurrentProjectId = useCallback((id: string | null) => {
    setCurrentProjectIdState(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const reloadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const list = await projectApi.list();
      setProjects(list);
      // Drop a stale selection that no longer exists.
      setCurrentProjectIdState((prev) =>
        prev && !list.some((p) => p.id === prev) ? null : prev,
      );
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadProjects();
  }, [reloadProjects]);

  const currentProject = useMemo(
    () => projects.find((p) => p.id === currentProjectId) ?? null,
    [projects, currentProjectId],
  );

  const value = useMemo(
    () => ({ projects, loading, currentProjectId, currentProject, setCurrentProjectId, reloadProjects }),
    [projects, loading, currentProjectId, currentProject, setCurrentProjectId, reloadProjects],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

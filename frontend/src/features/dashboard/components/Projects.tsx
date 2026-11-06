import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Plus, FolderOpen, Trash2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { projectApi, type Project, type ProjectSdkStatus } from '../../../services/api';
import { useProject } from '../../../contexts/ProjectContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props { lang: 'en' | 'ko'; }

const t = {
  ko: {
    title: '프로젝트 관리',
    cancel: '취소',
    name: '프로젝트 이름',
    createdAt: '생성일',
    addProject: '프로젝트 추가',
    namePlaceholder: 'e.g. My App',
    create: '생성',
    creating: '생성 중...',
    loading: '불러오는 중...',
    empty: '등록된 프로젝트가 없습니다.',
    errorCreate: '생성에 실패했습니다.',
    delete: '삭제',
    deleting: '삭제 중...',
    deleteConfirm: (name: string) => `"${name}" 프로젝트를 삭제하시겠습니까?\n연결된 실험이나 플래그가 있으면 삭제되지 않습니다.`,
    errorDelete: '삭제에 실패했습니다.',
    sdkConnected: '연결됨',
    sdkNotConnected: 'SDK 미설치',
    sdkChecking: '확인 중...',
    openVisualEditor: 'Visual Editor 열기',
  },
  en: {
    title: 'Project management',
    cancel: 'Cancel',
    name: 'Project Name',
    createdAt: 'Created',
    addProject: 'Add Project',
    namePlaceholder: 'e.g. My App',
    create: 'Create',
    creating: 'Creating...',
    loading: 'Loading...',
    empty: 'No projects yet.',
    errorCreate: 'Failed to create project.',
    delete: 'Delete',
    deleting: 'Deleting...',
    deleteConfirm: (name: string) => `Delete project "${name}"?\nProjects with linked experiments or flags cannot be deleted.`,
    errorDelete: 'Failed to delete project.',
    sdkConnected: 'Connected',
    sdkNotConnected: 'SDK not installed',
    sdkChecking: 'Checking...',
    openVisualEditor: 'Open Visual Editor',
  },
};

export function Projects({ lang }: Props) {
  const tr = t[lang];
  const navigate = useNavigate();
  const { projects, loading, reloadProjects, setCurrentProjectId } = useProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const showForm = searchParams.get('create') === '1';
  const setShowForm = (open: boolean) => {
    setSearchParams((params) => {
      if (open) params.set('create', '1');
      else params.delete('create');
      return params;
    }, { replace: true });
  };
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [sdkStatuses, setSdkStatuses] = useState<Record<string, ProjectSdkStatus['status']>>({});

  useEffect(() => {
    if (projects.length === 0) { setSdkStatuses({}); return; }
    let cancelled = false;
    Promise.allSettled(projects.map((p) => projectApi.sdkStatus(p.id))).then((results) => {
      if (cancelled) return;
      const next: Record<string, ProjectSdkStatus['status']> = {};
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') next[projects[i].id] = r.value.status;
      });
      setSdkStatuses(next);
    });
    return () => { cancelled = true; };
  }, [projects]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      await projectApi.create({ name: newName.trim() });
      await reloadProjects();
      setNewName('');
      setShowForm(false);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : tr.errorCreate);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (p: Project) => {
    if (!window.confirm(tr.deleteConfirm(p.name))) return;
    setDeletingId(p.id);
    setDeleteError(null);
    try {
      await projectApi.delete(p.id);
      await reloadProjects();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : tr.errorDelete);
    } finally {
      setDeletingId(null);
    }
  };

  const renderSdkBadge = (id: string) => {
    const s = sdkStatuses[id];
    if (s === undefined) {
      return <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{tr.sdkChecking}</span>;
    }
    if (s === 'connected') {
      return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">● {tr.sdkConnected}</span>;
    }
    return <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">○ {tr.sdkNotConnected}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{tr.title}</h1>
        <Button onClick={() => setShowForm(!showForm)} size="sm" className="gap-2">
          <Plus size={16} /> {tr.addProject}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <label htmlFor="new-project-name" className="text-xs font-medium text-muted-foreground mb-1 block">{tr.name}</label>
              <Input
                id="new-project-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={tr.namePlaceholder}
                className="text-sm"
              />
            </div>
            {createError && <p className="text-xs text-destructive">{createError}</p>}
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={creating || !newName.trim()} size="sm">
                {creating ? tr.creating : tr.create}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setCreateError(null); }}>
                {tr.cancel}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">{tr.loading}</p>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpen size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">{tr.empty}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer hover:shadow-md hover:border-foreground/40 transition-all"
              onClick={() => { setCurrentProjectId(p.id); navigate('/experiments'); }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      {renderSdkBadge(p.id)}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{p.id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US')}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-muted-foreground hover:text-rose-600"
                      disabled={deletingId === p.id}
                      onClick={(e) => { e.stopPropagation(); handleDelete(p); }}
                      aria-label={tr.delete}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </CardHeader>

            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

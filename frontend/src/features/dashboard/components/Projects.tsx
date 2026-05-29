import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Copy, Check, Plus, FolderOpen, Trash2, Wand2, FlaskConical, Target } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { projectApi, type Project, type ProjectSdkStatus } from '../../../services/api';
import { useProject } from '../../../contexts/ProjectContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props { lang: 'en' | 'ko'; }

const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,39}$/;

const t = {
  ko: {
    title: 'Projects',
    id: '프로젝트 ID',
    name: '프로젝트 이름',
    apiKey: 'API 키',
    createdAt: '생성일',
    addProject: '프로젝트 추가',
    idPlaceholder: 'e.g. my-app',
    namePlaceholder: 'e.g. My App',
    idHelp: '영문 소문자, 숫자, 하이픈. 2~40자.',
    idError: 'ID는 영문 소문자·숫자·하이픈만 허용되며 2~40자여야 합니다.',
    create: '생성',
    creating: '생성 중...',
    copied: '복사됨!',
    copy: '복사',
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
    typeLabel: '프로젝트 유형',
    abTestLabel: 'A/B 테스트',
    abTestDesc: '무작위 배정으로 variant 효과를 측정합니다. Feature Flag, Visual Editor 지원.',
    quasiLabel: '준실험',
    quasiDesc: '대상 집단 전체에 처치를 적용합니다. Placement 기반 노출 제어.',
  },
  en: {
    title: 'Projects',
    id: 'Project ID',
    name: 'Project Name',
    apiKey: 'API Key',
    createdAt: 'Created',
    addProject: 'Add Project',
    idPlaceholder: 'e.g. my-app',
    namePlaceholder: 'e.g. My App',
    idHelp: 'Lowercase letters, numbers, hyphens. 2–40 chars.',
    idError: 'ID must be 2–40 chars: lowercase letters, numbers, hyphens only.',
    create: 'Create',
    creating: 'Creating...',
    copied: 'Copied!',
    copy: 'Copy',
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
    typeLabel: 'Project Type',
    abTestLabel: 'A/B Test',
    abTestDesc: 'Measure variant effects with random assignment. Feature Flag and Visual Editor supported.',
    quasiLabel: 'Quasi-Experiment',
    quasiDesc: 'Apply treatment to an entire cohort. Placement-based exposure control.',
  },
};

function CopyButton({ value, labels }: { value: string; labels: { copy: string; copied: string } }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2 gap-1 text-xs">
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? labels.copied : labels.copy}
    </Button>
  );
}

export function Projects({ lang }: Props) {
  const tr = t[lang];
  const navigate = useNavigate();
  const { projects, loading, reloadProjects, setCurrentProjectId } = useProject();
  const [showForm, setShowForm] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'ab_test' | 'quasi_experiment'>('ab_test');
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
    if (!newId.trim() || !newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    if (!PROJECT_ID_PATTERN.test(newId.trim())) {
      setCreateError(tr.idError);
      setCreating(false);
      return;
    }
    try {
      await projectApi.create({ id: newId.trim(), name: newName.trim(), project_type: newType });
      await reloadProjects();
      setNewId('');
      setNewName('');
      setNewType('ab_test');
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
      return <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-400 dark:bg-slate-800">{tr.sdkChecking}</span>;
    }
    if (s === 'connected') {
      return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">● {tr.sdkConnected}</span>;
    }
    return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-400 dark:bg-slate-800 dark:text-slate-500">○ {tr.sdkNotConnected}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{tr.title}</h1>
        <Button onClick={() => setShowForm(!showForm)} size="sm" className="gap-2">
          <Plus size={16} /> {tr.addProject}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Type selector */}
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2 block">{tr.typeLabel}</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  className={cn(
                    "rounded-xl border-2 p-4 text-left transition-all",
                    newType === 'ab_test'
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                      : "border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700"
                  )}
                  onClick={() => setNewType('ab_test')}
                >
                  <FlaskConical size={18} className={cn("mb-2", newType === 'ab_test' ? "text-indigo-500" : "text-slate-400")} />
                  <div className={cn("text-sm font-semibold", newType === 'ab_test' ? "text-indigo-700 dark:text-indigo-300" : "text-slate-700 dark:text-slate-200")}>{tr.abTestLabel}</div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{tr.abTestDesc}</p>
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-xl border-2 p-4 text-left transition-all",
                    newType === 'quasi_experiment'
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700"
                  )}
                  onClick={() => setNewType('quasi_experiment')}
                >
                  <Target size={18} className={cn("mb-2", newType === 'quasi_experiment' ? "text-emerald-500" : "text-slate-400")} />
                  <div className={cn("text-sm font-semibold", newType === 'quasi_experiment' ? "text-emerald-700 dark:text-emerald-300" : "text-slate-700 dark:text-slate-200")}>{tr.quasiLabel}</div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{tr.quasiDesc}</p>
                </button>
              </div>
            </div>

            {/* ID / Name fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">{tr.id}</label>
                <Input
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  placeholder={tr.idPlaceholder}
                  className="text-sm"
                />
                <p className="text-xs text-slate-400 mt-1">{tr.idHelp}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">{tr.name}</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={tr.namePlaceholder}
                  className="text-sm"
                />
              </div>
            </div>
            {createError && <p className="text-xs text-rose-500">{createError}</p>}
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={creating || !newId.trim() || !newName.trim()} size="sm">
                {creating ? tr.creating : tr.create}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setCreateError(null); setNewType('ab_test'); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {deleteError && <p className="text-xs text-rose-500">{deleteError}</p>}

      {loading ? (
        <p className="text-sm text-slate-400">{tr.loading}</p>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <FolderOpen size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">{tr.empty}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all"
              onClick={() => { setCurrentProjectId(p.id); navigate(p.project_type === 'quasi_experiment' ? '/experiments' : '/api-key'); }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        p.project_type === 'quasi_experiment'
                          ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
                      )}>
                        {p.project_type === 'quasi_experiment' ? (lang === 'ko' ? '준실험' : 'Quasi') : (lang === 'ko' ? 'A/B 테스트' : 'A/B Test')}
                      </span>
                      {renderSdkBadge(p.id)}
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{p.id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {new Date(p.created_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US')}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-slate-400 hover:text-rose-600"
                      disabled={deletingId === p.id}
                      onClick={(e) => { e.stopPropagation(); handleDelete(p); }}
                      aria-label={tr.delete}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-md px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <code className="text-xs font-mono text-slate-600 dark:text-slate-300 flex-1 truncate">
                    {p.api_key}
                  </code>
                  <CopyButton value={p.api_key} labels={{ copy: tr.copy, copied: tr.copied }} />
                </div>
                {p.project_type !== 'quasi_experiment' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 rounded-xl"
                    onClick={(e) => { e.stopPropagation(); navigate(`/projects/${p.id}/visual-editor`); }}
                  >
                    <Wand2 size={14} /> {tr.openVisualEditor}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

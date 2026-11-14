import { AcceptProjectInvitation } from './ProjectSharing';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Plus, FolderOpen, Search } from 'lucide-react';
import { projectApi, type ProjectSdkStatus } from '../../../services/api';
import { useProject } from '../../../contexts/ProjectContext';

interface Props { lang: 'en' | 'ko'; }

const t = {
  ko: {
    title: '프로젝트 목록',
    subtitle: '프로젝트를 선택해 해당 프로젝트의 실험, SDK, 플래그를 관리하세요.',
    cancel: '취소',
    name: '프로젝트 이름',
    addProject: '프로젝트 추가',
    namePlaceholder: 'e.g. My App',
    create: '생성',
    creating: '생성 중...',
    loading: '불러오는 중...',
    empty: '등록된 프로젝트가 없습니다.',
    errorCreate: '생성에 실패했습니다.',
    errorLoad: '프로젝트를 불러오지 못했습니다.',
    retry: '다시 시도',
    searchLabel: '프로젝트 검색',
    searchPlaceholder: '프로젝트 이름 검색...',
    searchEmpty: '검색 조건에 맞는 프로젝트가 없습니다.',
    clearSearch: '검색 초기화',
    sdkConnected: '연결됨',
    sdkNotConnected: 'SDK 미설치',
    sdkChecking: '확인 중...',
    owner: '소유자', viewer: '조회자', editor: '편집자',
  },
  en: {
    title: 'Project list',
    subtitle: 'Choose a project to manage its experiments, SDK, and flags.',
    cancel: 'Cancel',
    name: 'Project Name',
    addProject: 'Add Project',
    namePlaceholder: 'e.g. My App',
    create: 'Create',
    creating: 'Creating...',
    loading: 'Loading...',
    empty: 'No projects yet.',
    errorCreate: 'Failed to create project.',
    errorLoad: 'Could not load projects.',
    retry: 'Retry',
    searchLabel: 'Search projects',
    searchPlaceholder: 'Search by project name...',
    searchEmpty: 'No projects match your search.',
    clearSearch: 'Clear search',
    sdkConnected: 'Connected',
    sdkNotConnected: 'SDK not installed',
    sdkChecking: 'Checking...',
    owner: 'Owner', viewer: 'Viewer', editor: 'Editor',
  },
};

export function Projects({ lang }: Props) {
  const tr = t[lang];
  const navigate = useNavigate();
  const { projects, loading, error, reloadProjects, setCurrentProjectId } = useProject();
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
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [sdkStatuses, setSdkStatuses] = useState<Record<string, ProjectSdkStatus['status']>>({});

  const mountedRef = useRef(true);
  const createSeqRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      createSeqRef.current += 1;
    };
  }, []);

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

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newName.trim() || creating) return;
    const seq = ++createSeqRef.current;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await projectApi.create({ name: newName.trim() });
      if (!mountedRef.current || createSeqRef.current !== seq) return;
      try {
        await reloadProjects();
      } catch {
        // Keep creation flow coherent if context refresh rejects.
      }
      if (!mountedRef.current || createSeqRef.current !== seq) return;
      setNewName('');
      setShowForm(false);
      setCurrentProjectId(created.id);
      navigate('/experiments');
    } catch (err) {
      if (!mountedRef.current || createSeqRef.current !== seq) return;
      setCreateError(err instanceof Error ? err.message : tr.errorCreate);
    } finally {
      if (mountedRef.current && createSeqRef.current === seq) {
        setCreating(false);
      }
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

  const normalizedSearch = search.trim().toLowerCase();
  const filteredProjects = normalizedSearch
    ? projects.filter((p) =>
        p.name.toLowerCase().includes(normalizedSearch) ||
        p.id.toLowerCase().includes(normalizedSearch),
      )
    : projects;

  return (
    <div className="space-y-6">
      <AcceptProjectInvitation lang={lang} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">{tr.title}</h1>
        <Button onClick={() => setShowForm(!showForm)} size="sm" className="gap-2">
          <Plus size={16} /> {tr.addProject}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">{tr.subtitle}</p>

      {showForm && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label htmlFor="new-project-name" className="text-xs font-medium text-muted-foreground mb-1 block">{tr.name}</label>
                <Input
                  id="new-project-name"
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={tr.namePlaceholder}
                  disabled={creating}
                  className="text-sm"
                />
              </div>
              {createError && <p role="alert" className="text-xs text-destructive">{createError}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={creating || !newName.trim()} size="sm">
                  {creating ? tr.creating : tr.create}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setShowForm(false); setCreateError(null); }}>
                  {tr.cancel}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {!loading && !error && (
        <div className="relative w-full max-w-sm">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label={tr.searchLabel}
            placeholder={tr.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">{tr.loading}</p>
      ) : error ? (
        <div role="alert" className="space-y-3">
          <p>{tr.errorLoad}</p>
          <Button variant="outline" onClick={() => void reloadProjects()}>{tr.retry}</Button>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpen size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">{tr.empty}</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground space-y-3">
          <p className="text-sm">{tr.searchEmpty}</p>
          <Button variant="outline" size="sm" onClick={() => setSearch('')}>{tr.clearSearch}</Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredProjects.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer hover:shadow-md hover:border-foreground/40 transition-all"
              onClick={() => { setCurrentProjectId(p.id); navigate('/experiments'); }}
            >
              <CardHeader className="pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base break-words">
                        <button
                          type="button"
                          className="text-left underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                          onClick={(e) => { e.stopPropagation(); setCurrentProjectId(p.id); navigate('/experiments'); }}
                        >
                          {p.name}
                        </button>
                      </CardTitle>
                      {renderSdkBadge(p.id)}
                      <span className="text-xs text-muted-foreground">{tr[p.access_role || 'owner']}</span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(p.created_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US')}
                  </span>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

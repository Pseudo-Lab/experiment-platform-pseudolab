import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Copy, Check, Plus, FolderOpen } from 'lucide-react';
import { projectApi, type Project } from '../../../services/api';

interface Props { lang: 'en' | 'ko'; }

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
    create: '생성',
    creating: '생성 중...',
    copied: '복사됨!',
    copy: '복사',
    loading: '불러오는 중...',
    empty: '등록된 프로젝트가 없습니다.',
    errorCreate: '생성에 실패했습니다.',
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
    create: 'Create',
    creating: 'Creating...',
    copied: 'Copied!',
    copy: 'Copy',
    loading: 'Loading...',
    empty: 'No projects yet.',
    errorCreate: 'Failed to create project.',
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    projectApi.list().then(setProjects).finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newId.trim() || !newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const p = await projectApi.create({ id: newId.trim(), name: newName.trim() });
      setProjects((prev) => [p, ...prev]);
      setNewId('');
      setNewName('');
      setShowForm(false);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : tr.errorCreate);
    } finally {
      setCreating(false);
    }
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
          <CardContent className="pt-6 space-y-3">
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
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setCreateError(null); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{p.id}</p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(p.created_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US')}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-md px-3 py-2">
                  <code className="text-xs font-mono text-slate-600 dark:text-slate-300 flex-1 truncate">
                    {p.api_key}
                  </code>
                  <CopyButton value={p.api_key} labels={{ copy: tr.copy, copied: tr.copied }} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

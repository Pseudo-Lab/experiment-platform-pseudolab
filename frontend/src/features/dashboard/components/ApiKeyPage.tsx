import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  Copy, Check, Eye, EyeOff, Key, Trash2, Plus,
  FolderOpen, CheckCircle2, Clock, Loader2, FlaskConical,
  ChevronRight,
} from 'lucide-react';
import { projectApi, experimentApi, type Project, type ProjectSdkStatus, type Experiment } from '../../../services/api';
import { useProject } from '../../../contexts/ProjectContext';

interface Props { lang: 'en' | 'ko'; }

const STATUS_STYLES: Record<string, string> = {
  running:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  draft:     'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  paused:    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  completed: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  archived:  'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
};
const STATUS_LABELS: Record<string, { ko: string; en: string }> = {
  running:   { ko: '진행 중', en: 'Running' },
  draft:     { ko: '초안', en: 'Draft' },
  paused:    { ko: '일시 정지', en: 'Paused' },
  completed: { ko: '완료', en: 'Completed' },
  archived:  { ko: '보관', en: 'Archived' },
};

const tr = {
  ko: {
    title: 'SDK 연동',
    noProject: '프로젝트를 선택하세요',
    noProjectDesc: '사이드바 상단의 드롭다운에서 프로젝트를 선택하면 해당 프로젝트의 API 키를 확인할 수 있어요.',
    goProjects: '프로젝트 목록으로',
    projectKey: '프로젝트 API 키',
    keyDesc: '클라이언트 사이드 SDK에서 사용하는 공개 키입니다. 소스 코드에 포함해도 안전해요.',
    reveal: '보기',
    hide: '숨기기',
    copy: '복사',
    copied: '복사됨!',
    sdkSetup: 'SDK 설정 예시',
    baseUrl: '앱 도메인',
    baseUrlDesc: 'Visual Editor와 SDK에서 사용할 기본 URL입니다.',
    baseUrlPlaceholder: 'https://your-app.example.com',
    baseUrlEdit: '편집',
    baseUrlSave: '저장',
    baseUrlCancel: '취소',
    sdkStatus: 'SDK 연결 상태',
    sdkConnected: '연결됨',
    sdkNotConnected: 'SDK 대기 중',
    sdkChecking: '확인 중...',
    sdkConnectedDesc: 'SDK가 정상적으로 연결되어 실험 데이터를 수집하고 있습니다.',
    sdkNotConnectedDesc: '아직 수신된 이벤트가 없습니다. 아래 설정 예시를 참고해 SDK를 설치하고, 앱을 방문하면 자동으로 연결됩니다.',
    openVisualEditor: 'Visual Editor 열기',
    abExperiments: 'A/B 테스트 실험',
    abExperimentsDesc: '이 프로젝트에 연결된 A/B 테스트 실험 목록입니다.',
    noAbExperiments: '연결된 A/B 테스트 실험이 없습니다.',
    goCreateExperiment: '실험 만들기',
    dangerZone: 'Danger Zone',
    deleteProject: '프로젝트 삭제',
    deleteProjectDesc: '이 프로젝트와 관련된 모든 데이터가 삭제됩니다. 연결된 실험이나 플래그가 있으면 삭제가 거부됩니다.',
    deleteConfirm: (name: string) => `"${name}" 프로젝트를 삭제하시겠습니까?\n연결된 실험이나 플래그가 있으면 삭제되지 않습니다.`,
    deleting: '삭제 중...',
    deleteError: '삭제에 실패했습니다.',
  },
  en: {
    title: 'SDK Integration',
    noProject: 'Select a Project',
    noProjectDesc: 'Choose a project from the dropdown at the top of the sidebar to view its API key.',
    goProjects: 'Go to projects',
    projectKey: 'Project API Key',
    keyDesc: 'A public key for use with the client-side SDK. Safe to include in source code.',
    reveal: 'Reveal',
    hide: 'Hide',
    copy: 'Copy',
    copied: 'Copied!',
    sdkSetup: 'SDK Setup Example',
    baseUrl: 'App Domain',
    baseUrlDesc: 'Default URL used by Visual Editor and the SDK.',
    baseUrlPlaceholder: 'https://your-app.example.com',
    baseUrlEdit: 'Edit',
    baseUrlSave: 'Save',
    baseUrlCancel: 'Cancel',
    sdkStatus: 'SDK Connection',
    sdkConnected: 'Connected',
    sdkNotConnected: 'Awaiting connection',
    sdkChecking: 'Checking...',
    sdkConnectedDesc: 'The SDK is connected and collecting experiment data.',
    sdkNotConnectedDesc: 'No events received yet. Install the SDK using the example below — once your app is visited, it will connect automatically.',
    openVisualEditor: 'Open Visual Editor',
    abExperiments: 'A/B Test Experiments',
    abExperimentsDesc: 'A/B test experiments linked to this project.',
    noAbExperiments: 'No A/B test experiments yet.',
    goCreateExperiment: 'Create experiment',
    dangerZone: 'Danger Zone',
    deleteProject: 'Delete Project',
    deleteProjectDesc: 'All data associated with this project will be deleted. Deletion fails if linked experiments or flags exist.',
    deleteConfirm: (name: string) => `Delete project "${name}"?\nProjects with linked experiments or flags cannot be deleted.`,
    deleting: 'Deleting...',
    deleteError: 'Failed to delete project.',
  },
};

function CopyButton({ value, labels }: { value: string; labels: { copy: string; copied: string } }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? labels.copied : labels.copy}
    </button>
  );
}

function SdkCodeBlock({ apiKey }: { apiKey: string }) {
  const snippet = `import { ExperimentProvider } from './lib/ExperimentContext';

<ExperimentProvider
  apiKey="${apiKey}"
  flagKeys={['my-flag', 'another-flag']}
>
  <App />
</ExperimentProvider>`;
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative rounded-xl bg-slate-900 dark:bg-slate-950">
      <pre className="overflow-x-auto px-4 pt-4 pb-10 text-[12px] leading-relaxed text-slate-300 font-mono whitespace-pre">
        <code>{snippet}</code>
      </pre>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(snippet);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="absolute bottom-2.5 right-3 flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
        {copied ? '복사됨' : '복사'}
      </button>
    </div>
  );
}

export function ApiKeyPage({ lang }: Props) {
  const t = tr[lang];
  const navigate = useNavigate();
  const { currentProject, reloadProjects } = useProject();

  const [revealed, setRevealed] = useState(false);
  const [sdkStatus, setSdkStatus] = useState<'checking' | 'connected' | 'not_connected'>('checking');
  const [editingBaseUrl, setEditingBaseUrl] = useState(false);
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [abExperiments, setAbExperiments] = useState<Experiment[]>([]);

  useEffect(() => {
    if (!currentProject) return;
    setSdkStatus('checking');
    setBaseUrl(currentProject.base_url ?? null);
    projectApi.sdkStatus(currentProject.id)
      .then((r) => setSdkStatus(r.status === 'connected' ? 'connected' : 'not_connected'))
      .catch(() => setSdkStatus('not_connected'));
    experimentApi.list()
      .then((all) => setAbExperiments(
        all.filter((e) => e.experiment_type === 'ab_test' && e.project_id === currentProject.id)
      ))
      .catch(() => setAbExperiments([]));
  }, [currentProject]);

  const handleSaveBaseUrl = async () => {
    if (!currentProject) return;
    try {
      const updated = await projectApi.patch(currentProject.id, { base_url: baseUrlInput || null });
      setBaseUrl(updated.base_url ?? null);
      setEditingBaseUrl(false);
    } catch { /* ignore */ }
  };

  const handleDelete = async () => {
    if (!currentProject) return;
    if (!window.confirm(t.deleteConfirm(currentProject.name))) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await projectApi.delete(currentProject.id);
      await reloadProjects();
      navigate('/projects');
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : t.deleteError);
    } finally {
      setDeleting(false);
    }
  };

  if (!currentProject) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center px-4 space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mx-auto">
          <Key className="h-8 w-8 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t.noProject}</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{t.noProjectDesc}</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => navigate('/projects')}>
          <FolderOpen size={16} /> {t.goProjects}
        </Button>
      </div>
    );
  }

  const maskedKey = currentProject.api_key.slice(0, 8) + '••••••••••••••••••••' + currentProject.api_key.slice(-4);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t.title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{currentProject.name} · <span className="font-mono">{currentProject.id}</span></p>
      </div>

      {/* API Key card */}
      <Card className="rounded-2xl border border-slate-200 dark:border-slate-800">
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center gap-2">
            <Key size={15} className="text-indigo-500 shrink-0" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t.projectKey}</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5">
            <code className="flex-1 text-sm font-mono text-slate-700 dark:text-slate-200 break-all select-all">
              {revealed ? currentProject.api_key : maskedKey}
            </code>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setRevealed((v) => !v)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                aria-label={revealed ? t.hide : t.reveal}
                title={revealed ? t.hide : t.reveal}
              >
                {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              <CopyButton value={currentProject.api_key} labels={{ copy: t.copy, copied: t.copied }} />
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">{t.keyDesc}</p>
        </CardContent>
      </Card>

      {/* SDK Status */}
      <Card className="rounded-2xl border border-slate-200 dark:border-slate-800">
        <CardContent className="pt-5 space-y-2">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t.sdkStatus}</p>
          <div className="flex items-center gap-2">
            {sdkStatus === 'checking' ? (
              <>
                <Loader2 size={16} className="animate-spin text-slate-400" />
                <span className="text-sm text-slate-400">{t.sdkChecking}</span>
              </>
            ) : sdkStatus === 'connected' ? (
              <>
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{t.sdkConnected}</span>
              </>
            ) : (
              <>
                <Clock size={16} className="text-amber-400" />
                <span className="text-sm text-amber-600 dark:text-amber-400">{t.sdkNotConnected}</span>
              </>
            )}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {sdkStatus === 'connected' ? t.sdkConnectedDesc : t.sdkNotConnectedDesc}
          </p>
        </CardContent>
      </Card>

      {/* SDK Setup */}
      <Card className="rounded-2xl border border-slate-200 dark:border-slate-800">
        <CardContent className="pt-5 space-y-3">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t.sdkSetup}</p>
          <SdkCodeBlock apiKey={currentProject.api_key} />
        </CardContent>
      </Card>

      {/* A/B Test Experiments */}
      <Card className="rounded-2xl border border-slate-200 dark:border-slate-800">
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t.abExperiments}</p>
              <p className="text-xs text-slate-400 mt-0.5">{t.abExperimentsDesc}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 rounded-xl text-xs"
              onClick={() => navigate('/experiments')}
            >
              <Plus size={13} />
              {t.goCreateExperiment}
            </Button>
          </div>
          {abExperiments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
              <FlaskConical size={28} className="opacity-30" />
              <p className="text-sm">{t.noAbExperiments}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {abExperiments.map((exp) => (
                <button
                  key={exp.id}
                  className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-4 py-3 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors text-left"
                  onClick={() => navigate(`/experiments/${exp.id}`)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{exp.name}</p>
                    <p className="text-xs font-mono text-slate-400 truncate mt-0.5">{exp.id}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[exp.status] ?? STATUS_STYLES.draft}`}>
                      {(STATUS_LABELS[exp.status]?.[lang]) ?? exp.status}
                    </span>
                    <ChevronRight size={14} className="text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="rounded-2xl border border-rose-200 dark:border-rose-900/50">
        <CardContent className="pt-5 space-y-3">
          <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{t.dangerZone}</p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t.deleteProject}</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{t.deleteProjectDesc}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-2 rounded-xl border-rose-300 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
              disabled={deleting}
              onClick={handleDelete}
            >
              <Trash2 size={14} />
              {deleting ? t.deleting : t.deleteProject}
            </Button>
          </div>
          {deleteError && <p className="text-xs text-rose-500">{deleteError}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

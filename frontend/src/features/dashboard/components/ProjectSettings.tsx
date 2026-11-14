import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Globe, ShieldAlert, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { ProjectSharing } from './ProjectSharing';
import { projectApi } from '../../../services/api';
import { useProject } from '../../../contexts/ProjectContext';

interface Props {
  lang: 'en' | 'ko';
}

const copy = {
  ko: {
    title: '프로젝트 설정',
    noProject: '프로젝트를 선택하세요',
    noProjectDesc: '사이드바의 프로젝트 목록에서 소유한 프로젝트를 선택하면 설정과 멤버를 관리할 수 있습니다.',
    goProjects: '프로젝트 목록으로',
    ownerOnlyTitle: '소유자만 접근할 수 있습니다',
    ownerOnlyDesc: '앱 도메인 설정, 멤버·초대 관리 및 프로젝트 삭제는 프로젝트 소유자만 할 수 있습니다.',
    backToExperiments: '실험 관리로',
    appDomainTitle: '앱 도메인',
    appDomainDesc: 'Visual Editor에서 열 고객 서비스 앱 주소입니다. SDK의 baseUrl은 이 주소가 아닌 플랫폼 API 주소입니다(예: https://platform.example.invalid/api/v1).',
    appDomainLabel: '고객 앱 URL',
    appDomainPlaceholder: 'https://your-app.example.invalid',
    appDomainSave: '저장',
    appDomainSaving: '저장 중...',
    appDomainSaved: '앱 도메인을 저장했습니다.',
    appDomainInvalid: 'http:// 또는 https://로 시작하는 올바른 URL을 입력하거나 비워 두세요.',
    appDomainError: '앱 도메인을 저장하지 못했습니다.',
    dangerZone: 'Danger Zone',
    deleteProject: '프로젝트 삭제',
    deleteProjectDesc: '이 프로젝트와 관련된 설정을 삭제합니다. 연결된 실험이나 플래그, 서버 키가 남아 있으면 삭제가 거부됩니다.',
    deleteConfirm: (name: string) => `"${name}" 프로젝트를 삭제하시겠습니까?\n연결된 실험이나 플래그가 있으면 삭제되지 않습니다.`,
    deleting: '삭제 중...',
    deleteError: '프로젝트 삭제를 완료하지 못했습니다. 목록을 새로고침한 뒤 다시 확인해 주세요.',
    deleteExperiments: '연결된 실험이 있어 삭제할 수 없습니다. 실험 관리에서 연결된 실험을 먼저 확인해 주세요.',
    deleteFlags: '연결된 플래그가 있어 삭제할 수 없습니다. 플래그 화면에서 연결된 항목을 먼저 확인해 주세요.',
    deleteCredentials: '서버 키 발급 이력이 있어 삭제할 수 없습니다. 폐기된 키의 이력도 보존됩니다.',
    deleteConflict: '프로젝트가 사용 중이거나 상태가 변경되어 삭제할 수 없습니다. 목록을 새로고침한 뒤 연결된 항목을 확인해 주세요.',
    deleteForbidden: '이 프로젝트를 삭제할 권한이 없습니다. 프로젝트와 계정 권한을 확인해 주세요.',
    deleteMissing: '프로젝트에 접근할 수 없습니다. 목록을 새로고침해 주세요.',
    deleteSignedOut: '로그인이 만료됐습니다. 다시 로그인한 뒤 시도해 주세요.',
    deleteServer: '서버 오류로 삭제 결과를 확인하지 못했습니다. 목록을 새로고침해 프로젝트가 남아 있는지 확인해 주세요.',
    deleteNetwork: '삭제 결과를 확인하지 못했습니다. 연결 상태를 확인한 뒤 프로젝트 목록을 새로고침해 주세요.',
  },
  en: {
    title: 'Project settings',
    noProject: 'Select a Project',
    noProjectDesc: 'Choose a project you own from the sidebar project list to manage its settings and members.',
    goProjects: 'Go to project list',
    ownerOnlyTitle: 'Owner access required',
    ownerOnlyDesc: 'Only project owners can update the app domain, manage members or invitations, or delete the project.',
    backToExperiments: 'Back to experiments',
    appDomainTitle: 'App domain',
    appDomainDesc: 'Customer app URL opened by Visual Editor. SDK baseUrl uses your platform API address instead (for example, https://platform.example.invalid/api/v1).',
    appDomainLabel: 'Customer app URL',
    appDomainPlaceholder: 'https://your-app.example.invalid',
    appDomainSave: 'Save',
    appDomainSaving: 'Saving...',
    appDomainSaved: 'App domain saved.',
    appDomainInvalid: 'Enter a valid http:// or https:// URL, or leave blank to clear.',
    appDomainError: 'Failed to save app domain.',
    dangerZone: 'Danger Zone',
    deleteProject: 'Delete Project',
    deleteProjectDesc: 'Delete this project. Deletion is refused if any linked experiments, feature flags, or server credentials remain.',
    deleteConfirm: (name: string) => `Delete project "${name}"?\nProjects with linked experiments or flags cannot be deleted.`,
    deleting: 'Deleting...',
    deleteError: 'Could not complete deletion. Refresh the project list and check again.',
    deleteExperiments: 'This project has linked experiments and cannot be deleted. Check them in Experiments first.',
    deleteFlags: 'This project has linked flags and cannot be deleted. Check them in Feature Flags first.',
    deleteCredentials: 'This project has server credential history and cannot be deleted. Revoked credential records are also retained.',
    deleteConflict: 'This project is in use or its state changed. Refresh the list and check linked resources before trying again.',
    deleteForbidden: 'You cannot delete this project. Check the project and your account permissions.',
    deleteMissing: 'This project is unavailable. Refresh the project list.',
    deleteSignedOut: 'Your session expired. Sign in again before trying.',
    deleteServer: 'The server could not confirm deletion. Refresh the project list to check whether it still exists.',
    deleteNetwork: 'Could not confirm deletion. Check your connection, then refresh the project list.',
  },
};

function parseBaseUrl(raw: string): { ok: true; value: string | null } | { ok: false } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false };
    }
    return { ok: true, value: trimmed };
  } catch {
    return { ok: false };
  }
}

export function ProjectSettings({ lang }: Props) {
  const t = copy[lang];
  const navigate = useNavigate();
  const { currentProject, reloadProjects, setCurrentProjectId } = useProject();

  const isOwner = !!currentProject && (currentProject.access_role || 'owner') === 'owner';

  const [baseUrlInput, setBaseUrlInput] = useState(currentProject?.base_url ?? '');
  const [dirtyBaseUrl, setDirtyBaseUrl] = useState(false);
  const [savingBaseUrl, setSavingBaseUrl] = useState(false);
  const [baseUrlError, setBaseUrlError] = useState<string | null>(null);
  const [baseUrlSaved, setBaseUrlSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const activeProjectIdRef = useRef<string | null>(currentProject?.id ?? null);
  activeProjectIdRef.current = currentProject?.id ?? null;
  const prevProjectIdRef = useRef<string | null>(currentProject?.id ?? null);
  const prevBaseUrlRef = useRef<string | null>(currentProject?.base_url ?? null);
  const saveSeqRef = useRef(0);
  const deleteSeqRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      saveSeqRef.current += 1;
      deleteSeqRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const nextId = currentProject?.id ?? null;
    const nextBaseUrl = currentProject?.base_url ?? null;
    if (prevProjectIdRef.current !== nextId) {
      prevProjectIdRef.current = nextId;
      prevBaseUrlRef.current = nextBaseUrl;
      saveSeqRef.current += 1;
      deleteSeqRef.current += 1;
      setBaseUrlInput(nextBaseUrl ?? '');
      setDirtyBaseUrl(false);
      setSavingBaseUrl(false);
      setBaseUrlError(null);
      setBaseUrlSaved(false);
      setDeleting(false);
      setDeleteError(null);
      return;
    }
    if (prevBaseUrlRef.current !== nextBaseUrl) {
      prevBaseUrlRef.current = nextBaseUrl;
      if (!dirtyBaseUrl && !savingBaseUrl) {
        setBaseUrlInput(nextBaseUrl ?? '');
      }
    }
  }, [currentProject?.id, currentProject?.base_url, dirtyBaseUrl, savingBaseUrl]);

  if (!currentProject) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center px-4 space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
          <FolderOpen className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">{t.noProject}</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{t.noProjectDesc}</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => navigate('/projects')}>
          <FolderOpen size={16} /> {t.goProjects}
        </Button>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">{t.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {currentProject.name}
          </p>
        </div>
        <Card role="alert">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-destructive shrink-0" />
              <CardTitle className="text-lg">{t.ownerOnlyTitle}</CardTitle>
            </div>
            <CardDescription>{t.ownerOnlyDesc}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={() => navigate('/experiments')}>{t.backToExperiments}</Button>
            <Button variant="outline" onClick={() => navigate('/projects')}>{t.goProjects}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSaveBaseUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingBaseUrl || deleting) return;
    const parsed = parseBaseUrl(baseUrlInput);
    if (!parsed.ok) {
      setBaseUrlError(t.appDomainInvalid);
      setBaseUrlSaved(false);
      return;
    }

    const targetId = currentProject.id;
    const seq = ++saveSeqRef.current;
    setSavingBaseUrl(true);
    setBaseUrlError(null);
    setBaseUrlSaved(false);
    try {
      const updated = await projectApi.patch(targetId, { base_url: parsed.value });
      if (!mountedRef.current || activeProjectIdRef.current !== targetId || saveSeqRef.current !== seq) return;
      setBaseUrlInput(updated.base_url ?? '');
      setDirtyBaseUrl(false);
      setBaseUrlSaved(true);
      try {
        await reloadProjects();
      } catch {
        // Keep the saved state coherent if context refresh rejects.
      }
    } catch (err) {
      if (!mountedRef.current || activeProjectIdRef.current !== targetId || saveSeqRef.current !== seq) return;
      setBaseUrlError(
        err instanceof Error && err.message && err.message !== 'Failed to update project'
          ? err.message
          : t.appDomainError,
      );
    } finally {
      if (mountedRef.current && activeProjectIdRef.current === targetId && saveSeqRef.current === seq) {
        setSavingBaseUrl(false);
      }
    }
  };

  const handleDelete = async () => {
    if (deleting || savingBaseUrl) return;
    if (!window.confirm(t.deleteConfirm(currentProject.name))) return;

    const targetId = currentProject.id;
    const seq = ++deleteSeqRef.current;
    setDeleting(true);
    setDeleteError(null);
    try {
      await projectApi.delete(targetId);
      if (!mountedRef.current || activeProjectIdRef.current !== targetId || deleteSeqRef.current !== seq) return;
      // Finish deletion before a list refresh can unmount this page or fail.
      setCurrentProjectId(null);
      navigate('/projects', { replace: true });
      try {
        await reloadProjects();
      } catch {
        // Selection and navigation already reflect the successful deletion.
      }
    } catch (err) {
      if (!mountedRef.current || activeProjectIdRef.current !== targetId || deleteSeqRef.current !== seq) return;
      const status = err instanceof Error && 'status' in err ? err.status : undefined;
      const reason = err instanceof Error && 'reason' in err ? err.reason : undefined;
      const conflict = reason === 'experiments' ? t.deleteExperiments
        : reason === 'feature_flags' ? t.deleteFlags
        : reason === 'server_credentials' ? t.deleteCredentials : t.deleteConflict;
      const messages: Record<number, string> = {
        401: t.deleteSignedOut, 403: t.deleteForbidden, 404: t.deleteMissing, 409: conflict,
      };
      const fallback = typeof status === 'number' && status >= 500 && status < 600 ? t.deleteServer : t.deleteError;
      setDeleteError(typeof status === 'number' ? messages[status] || fallback : t.deleteNetwork);
    } finally {
      if (mountedRef.current && activeProjectIdRef.current === targetId && deleteSeqRef.current === seq) {
        setDeleting(false);
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">{t.title}</h1>
        <p className="text-sm text-muted-foreground mt-1 break-words">
          {currentProject.name}
        </p>
      </div>

      <Card role="region" aria-label={t.appDomainTitle}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe size={18} className="text-muted-foreground shrink-0" />
            <CardTitle className="text-lg">{t.appDomainTitle}</CardTitle>
          </div>
          <CardDescription>{t.appDomainDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveBaseUrl} noValidate className="space-y-3 max-w-xl">
            <label htmlFor="project-base-url" className="block text-sm font-medium text-foreground">
              {t.appDomainLabel}
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                id="project-base-url"
                type="url"
                value={baseUrlInput}
                onChange={(e) => {
                  setBaseUrlInput(e.target.value);
                  setDirtyBaseUrl(true);
                  setBaseUrlError(null);
                  setBaseUrlSaved(false);
                }}
                placeholder={t.appDomainPlaceholder}
                disabled={savingBaseUrl || deleting}
                aria-invalid={baseUrlError ? true : undefined}
                aria-describedby={baseUrlError ? 'project-base-url-error' : undefined}
                className="font-mono text-sm"
              />
              <Button type="submit" disabled={savingBaseUrl || deleting} className="shrink-0">
                {savingBaseUrl ? t.appDomainSaving : t.appDomainSave}
              </Button>
            </div>
            {baseUrlError && (
              <p id="project-base-url-error" role="alert" className="text-sm text-destructive">
                {baseUrlError}
              </p>
            )}
            {baseUrlSaved && (
              <p role="status" className="text-sm text-muted-foreground">
                {t.appDomainSaved}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      <ProjectSharing
        key={currentProject.id}
        project={currentProject}
        lang={lang}
      />

      <Card role="region" aria-label={t.dangerZone} className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-lg text-destructive">{t.dangerZone}</CardTitle>
          <CardDescription>{t.deleteProjectDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">{t.deleteProject}</p>
            <Button
              variant="destructive"
              size="sm"
              className="shrink-0 gap-2"
              disabled={deleting || savingBaseUrl}
              onClick={handleDelete}
            >
              <Trash2 size={14} />
              {deleting ? t.deleting : t.deleteProject}
            </Button>
          </div>
          {deleteError && (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

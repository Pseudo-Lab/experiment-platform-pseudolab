import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Archive, RotateCcw, ToggleLeft, ToggleRight, Plus, RefreshCcw, X } from 'lucide-react';
import { featureFlagApi, type FeatureFlag, type FeatureFlagCreate, type FeatureFlagExposureSummary } from '../../../services/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { useProject } from '../../../contexts/ProjectContext';

interface Props { lang: 'en' | 'ko'; }

const t = {
  ko: {
    title: 'Feature Flags',
    colKey: 'Key', colDesc: '설명', colRollout: '롤아웃 %', colExposure: '노출', colStatus: '상태', colProject: '프로젝트', colActions: '',
    allProjects: '모든 프로젝트',
    noProject: '(없음)',
    assignProject: '프로젝트 지정',
    enabled: '활성', disabled: '비활성', archived: '보관됨',
    includeArchived: '보관된 플래그 포함',
    addFlag: '플래그 추가',
    keyPlaceholder: 'flag-key',
    descPlaceholder: '설명 (선택)',
    productPlaceholder: '제품 (선택)',
    rolloutLabel: '롤아웃 %',
    create: '생성',
    creating: '생성 중...',
    save: '저장',
    saving: '저장 중...',
    refreshExposure: '노출 새로고침',
    refreshingExposure: '새로고침 중...',
    exposureLoading: '집계 중...',
    exposureEmpty: '노출 없음',
    exposureFailed: '노출 집계 실패',
    totalExposure: '전체 호출',
    firstExposure: '분석 대상',
    treatment: 'treatment',
    control: 'control',
    archive: '보관',
    archiving: '보관 중...',
    restore: '복구',
    restoring: '복구 중...',
    archiveConfirm: '이 플래그를 보관할까요? 목록에서 숨겨지고 decide는 control을 반환합니다.',
    restoreConfirm: '이 플래그를 보관 해제할까요? 복구 후에도 안전을 위해 비활성 상태로 유지됩니다.',
    loading: '불러오는 중...',
    empty: '등록된 플래그가 없습니다.',
    errorCreate: '생성에 실패했습니다.',
    errorUpdate: '업데이트에 실패했습니다.',
    errorArchive: '보관에 실패했습니다.',
    errorRestore: '복구에 실패했습니다.',
  },
  en: {
    title: 'Feature Flags',
    colKey: 'Key', colDesc: 'Description', colRollout: 'Rollout %', colExposure: 'Exposure', colStatus: 'Status', colProject: 'Project', colActions: '',
    allProjects: 'All Projects',
    noProject: '(none)',
    assignProject: 'Assign project',
    enabled: 'Enabled', disabled: 'Disabled', archived: 'Archived',
    includeArchived: 'Include archived flags',
    addFlag: 'Add Flag',
    keyPlaceholder: 'flag-key',
    descPlaceholder: 'Description (optional)',
    productPlaceholder: 'Product (optional)',
    rolloutLabel: 'Rollout %',
    create: 'Create',
    creating: 'Creating...',
    save: 'Save',
    saving: 'Saving...',
    refreshExposure: 'Refresh exposure',
    refreshingExposure: 'Refreshing...',
    exposureLoading: 'Summarizing...',
    exposureEmpty: 'No exposure',
    exposureFailed: 'Exposure summary failed',
    totalExposure: 'Total calls',
    firstExposure: 'Analysis users',
    treatment: 'treatment',
    control: 'control',
    archive: 'Archive',
    archiving: 'Archiving...',
    restore: 'Restore',
    restoring: 'Restoring...',
    archiveConfirm: 'Archive this flag? It will be hidden from the list and decide will return control.',
    restoreConfirm: 'Restore this flag? It will stay disabled for safety after restore.',
    loading: 'Loading...',
    empty: 'No flags configured.',
    errorCreate: 'Failed to create flag.',
    errorUpdate: 'Failed to update flag.',
    errorArchive: 'Failed to archive flag.',
    errorRestore: 'Failed to restore flag.',
  },
};

export const FeatureFlags: React.FC<Props> = ({ lang }) => {
  const tr = t[lang];
  const { currentProjectId, projects: availableProjects } = useProject();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newRollout, setNewRollout] = useState(0);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rolloutDrafts, setRolloutDrafts] = useState<Record<string, number>>({});
  const [savingRolloutKey, setSavingRolloutKey] = useState<string | null>(null);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [archivingKey, setArchivingKey] = useState<string | null>(null);
  const [restoringKey, setRestoringKey] = useState<string | null>(null);
  const [assigningProjectKey, setAssigningProjectKey] = useState<string | null>(null);
  const [exposureSummaries, setExposureSummaries] = useState<Record<string, FeatureFlagExposureSummary | null>>({});
  const [exposureLoading, setExposureLoading] = useState(false);

  const loadExposureSummaries = async (items: FeatureFlag[]) => {
    setExposureLoading(true);
    try {
      const results = await Promise.allSettled(items.map(flag => featureFlagApi.exposureSummary(flag.flag_key)));
      setExposureSummaries(Object.fromEntries(items.map((flag, index) => [
        flag.flag_key,
        results[index].status === 'fulfilled' ? results[index].value : null,
      ])));
    } finally {
      setExposureLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    featureFlagApi.list(includeArchived)
      .then(items => {
        setFlags(items);
        setRolloutDrafts(Object.fromEntries(items.map(flag => [flag.flag_key, flag.rollout_pct])));
        void loadExposureSummaries(items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [includeArchived]);

  const replaceFlag = (updated: FeatureFlag) => {
    setFlags(prev => prev.map(f => f.flag_key === updated.flag_key ? updated : f));
    setRolloutDrafts(prev => ({ ...prev, [updated.flag_key]: updated.rollout_pct }));
  };

  const handleCreate = async () => {
    if (!newKey.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const data: FeatureFlagCreate = {
        flag_key: newKey.trim(),
        description: newDesc.trim() || undefined,
        rollout_pct: newRollout,
        enabled: false,
        project_id: newProjectId || undefined,
        product: newProjectId || undefined,
      };
      const created = await featureFlagApi.create(data);
      setFlags(prev => [created, ...prev]);
      setRolloutDrafts(prev => ({ ...prev, [created.flag_key]: created.rollout_pct }));
      setExposureSummaries(prev => ({
        ...prev,
        [created.flag_key]: {
          flag_key: created.flag_key,
          from: null,
          to: null,
          total_exposures: 0,
          unique_users: 0,
          first_exposure_users: 0,
          variant_counts: {},
        },
      }));
      setNewKey(''); setNewDesc(''); setNewProjectId(''); setNewRollout(0); setShowForm(false);
    } catch {
      setError(tr.errorCreate);
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (flag: FeatureFlag) => {
    setUpdatingKey(flag.flag_key);
    setError(null);
    try {
      const updated = await featureFlagApi.update(flag.flag_key, { enabled: !flag.enabled });
      replaceFlag(updated);
    } catch {
      setError(tr.errorUpdate);
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleRolloutSave = async (flag: FeatureFlag) => {
    const pct = rolloutDrafts[flag.flag_key] ?? flag.rollout_pct;
    if (pct === flag.rollout_pct) return;
    setSavingRolloutKey(flag.flag_key);
    setError(null);
    try {
      const updated = await featureFlagApi.update(flag.flag_key, { rollout_pct: pct });
      replaceFlag(updated);
    } catch {
      setError(tr.errorUpdate);
      setRolloutDrafts(prev => ({ ...prev, [flag.flag_key]: flag.rollout_pct }));
    } finally {
      setSavingRolloutKey(null);
    }
  };

  const handleArchive = async (flag: FeatureFlag) => {
    if (!window.confirm(tr.archiveConfirm)) return;
    setArchivingKey(flag.flag_key);
    setError(null);
    try {
      const archived = await featureFlagApi.archive(flag.flag_key);
      if (includeArchived) {
        replaceFlag(archived);
      } else {
        setFlags(prev => prev.filter(f => f.flag_key !== flag.flag_key));
        setRolloutDrafts(prev => {
          const next = { ...prev };
          delete next[flag.flag_key];
          return next;
        });
        setExposureSummaries(prev => {
          const next = { ...prev };
          delete next[flag.flag_key];
          return next;
        });
      }
    } catch {
      setError(tr.errorArchive);
    } finally {
      setArchivingKey(null);
    }
  };

  const handleRestore = async (flag: FeatureFlag) => {
    if (!window.confirm(tr.restoreConfirm)) return;
    setRestoringKey(flag.flag_key);
    setError(null);
    try {
      const restored = await featureFlagApi.restore(flag.flag_key);
      replaceFlag(restored);
    } catch {
      setError(tr.errorRestore);
    } finally {
      setRestoringKey(null);
    }
  };

  const handleAssignProject = async (flag: FeatureFlag, projectId: string | null) => {
    setAssigningProjectKey(flag.flag_key);
    setError(null);
    try {
      const updated = await featureFlagApi.update(flag.flag_key, { project_id: projectId ?? undefined });
      replaceFlag(updated);
    } catch {
      setError(tr.errorUpdate);
    } finally {
      setAssigningProjectKey(null);
    }
  };

  const renderExposureSummary = (flagKey: string) => {
    const summary = exposureSummaries[flagKey];
    if (summary === undefined) return <span className="text-xs text-slate-400">{tr.exposureLoading}</span>;
    if (summary === null) return <span className="text-xs text-amber-600">{tr.exposureFailed}</span>;
    if (summary.total_exposures === 0) return <span className="text-xs text-slate-400">{tr.exposureEmpty}</span>;

    const variantEntries = Object.entries(summary.variant_counts)
      .filter(([, count]) => count > 0)
      .sort(([a], [b]) => {
        if (a === 'control') return -1;
        if (b === 'control') return 1;
        return a.localeCompare(b);
      });

    const labelFor = (key: string) =>
      key === 'control' ? tr.control : key === 'treatment' ? tr.treatment : key;

    const controlChip = 'rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300';
    const variantChip = 'rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300';

    return (
      <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
        <div className="font-semibold text-slate-700 dark:text-slate-300">
          {tr.totalExposure} {summary.total_exposures.toLocaleString()} · {tr.firstExposure} {summary.first_exposure_users.toLocaleString()}
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          {variantEntries.map(([key, count]) => (
            <span key={key} className={key === 'control' ? controlChip : variantChip}>
              {labelFor(key)} {count.toLocaleString()}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const filteredFlags = currentProjectId
    ? flags.filter(f => (f.project_id || f.product) === currentProjectId)
    : flags;

  if (loading) return <p className="text-slate-500 text-sm p-8">{tr.loading}</p>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{tr.title}</h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-800 dark:text-slate-300">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={e => setIncludeArchived(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-indigo-500"
            />
            {tr.includeArchived}
          </label>
          <Button
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={() => loadExposureSummaries(flags)}
            disabled={exposureLoading || flags.length === 0}
          >
            <RefreshCcw className={`h-4 w-4 ${exposureLoading ? 'animate-spin' : ''}`} />
            {exposureLoading ? tr.refreshingExposure : tr.refreshExposure}
          </Button>
          <Button className="gap-2 rounded-xl" onClick={() => setShowForm(v => !v)}>
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {tr.addFlag}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="rounded-2xl border border-slate-200 dark:border-slate-800">
          <CardContent className="pt-5 space-y-3">
            <div className="flex gap-2 flex-wrap">
              <Input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder={tr.keyPlaceholder} className="rounded-xl font-mono flex-1 min-w-32" />
              <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder={tr.descPlaceholder} className="rounded-xl flex-1 min-w-32" />
              <Select
                value={newProjectId || '__none__'}
                onValueChange={(v) => setNewProjectId(v === '__none__' ? '' : v)}
              >
                <SelectTrigger className="rounded-xl w-40">
                  <SelectValue placeholder={tr.productPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{lang === 'ko' ? '(없음)' : '(none)'}</SelectItem>
                  {availableProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-500 shrink-0">{tr.rolloutLabel}</label>
              <input type="range" min={0} max={100} value={newRollout} onChange={e => setNewRollout(Number(e.target.value))} className="flex-1 accent-indigo-500" />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300 w-10 text-right">{newRollout}%</span>
            </div>
            {error && <p className="text-xs text-rose-500">{error}</p>}
            <Button size="sm" className="rounded-xl" onClick={handleCreate} disabled={creating || !newKey.trim()}>
              {creating ? tr.creating : tr.create}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border border-slate-200 dark:border-slate-800">
        <CardContent className="p-0">
          {error && !showForm && <p className="text-xs text-rose-500 px-6 pt-4">{error}</p>}
          {filteredFlags.length === 0 ? (
            <p className="text-sm text-slate-400 p-6">{tr.empty}</p>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                <TableRow>
                  <TableHead className="font-bold text-slate-500">{tr.colKey}</TableHead>
                  <TableHead className="font-bold text-slate-500">{tr.colDesc}</TableHead>
                  <TableHead className="font-bold text-slate-500">{tr.colRollout}</TableHead>
                  <TableHead className="font-bold text-slate-500">{tr.colExposure}</TableHead>
                  <TableHead className="font-bold text-slate-500">{tr.colStatus}</TableHead>
                  <TableHead className="font-bold text-slate-500">{tr.colProject}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFlags.map(flag => {
                  const draftRollout = rolloutDrafts[flag.flag_key] ?? flag.rollout_pct;
                  const rolloutChanged = draftRollout !== flag.rollout_pct;
                  const isSavingRollout = savingRolloutKey === flag.flag_key;
                  const isUpdating = updatingKey === flag.flag_key;
                  const isArchiving = archivingKey === flag.flag_key;
                  const isRestoring = restoringKey === flag.flag_key;
                  const isArchived = Boolean(flag.archived_at);

                  return (
                  <TableRow key={flag.flag_key} className={isArchived ? 'bg-slate-50/70 opacity-75 dark:bg-slate-900/40' : undefined}>
                    <TableCell className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">{flag.flag_key}</TableCell>
                    <TableCell className="text-sm text-slate-500">{flag.description || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <input type="range" min={0} max={100} value={draftRollout}
                          onChange={e => setRolloutDrafts(prev => ({ ...prev, [flag.flag_key]: Number(e.target.value) }))}
                          disabled={isArchived}
                          className="w-24 accent-indigo-500 disabled:opacity-50" />
                        <span className="text-xs font-bold text-slate-500 w-8">{draftRollout}%</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-lg px-2 text-xs"
                          onClick={() => handleRolloutSave(flag)}
                          disabled={!rolloutChanged || isSavingRollout || isArchived}
                        >
                          {isSavingRollout ? tr.saving : tr.save}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>{renderExposureSummary(flag.flag_key)}</TableCell>
                    <TableCell>
                      <span className={`inline-block whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-bold ${isArchived ? 'bg-amber-100 text-amber-700' : flag.enabled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                        {isArchived ? tr.archived : flag.enabled ? tr.enabled : tr.disabled}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={flag.project_id || flag.product || '__none__'}
                        onValueChange={(v) => handleAssignProject(flag, v === '__none__' ? null : v)}
                        disabled={assigningProjectKey === flag.flag_key || isArchived}
                      >
                        <SelectTrigger className="h-7 rounded-lg text-xs w-32 border-slate-200 dark:border-slate-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{tr.noProject}</SelectItem>
                          {availableProjects.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggle(flag)}
                          disabled={isUpdating || isArchiving || isRestoring || isArchived}
                          className="text-slate-400 hover:text-indigo-500 transition-colors disabled:opacity-50"
                          aria-label={flag.enabled ? tr.disabled : tr.enabled}
                        >
                          {flag.enabled ? <ToggleRight className="h-6 w-6 text-indigo-500" /> : <ToggleLeft className="h-6 w-6" />}
                        </button>
                        {isArchived ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 rounded-lg px-2 text-xs text-slate-500 hover:text-indigo-600"
                            onClick={() => handleRestore(flag)}
                            disabled={isRestoring || isUpdating || isArchiving}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            {isRestoring ? tr.restoring : tr.restore}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 rounded-lg px-2 text-xs text-slate-500 hover:text-rose-600"
                            onClick={() => handleArchive(flag)}
                            disabled={isArchiving || isUpdating}
                          >
                            <Archive className="h-3.5 w-3.5 mr-1" />
                            {isArchiving ? tr.archiving : tr.archive}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { ToggleLeft, ToggleRight, Plus, X } from 'lucide-react';
import { featureFlagApi, type FeatureFlag, type FeatureFlagCreate } from '../../../services/api';

interface Props { lang: 'en' | 'ko'; }

const t = {
  ko: {
    title: 'Feature Flags',
    colKey: 'Key', colDesc: '설명', colRollout: '롤아웃 %', colStatus: '상태', colActions: '',
    enabled: '활성', disabled: '비활성',
    addFlag: '플래그 추가',
    keyPlaceholder: 'flag-key',
    descPlaceholder: '설명 (선택)',
    rolloutLabel: '롤아웃 %',
    create: '생성',
    creating: '생성 중...',
    save: '저장',
    saving: '저장 중...',
    loading: '불러오는 중...',
    empty: '등록된 플래그가 없습니다.',
    errorCreate: '생성에 실패했습니다.',
    errorUpdate: '업데이트에 실패했습니다.',
  },
  en: {
    title: 'Feature Flags',
    colKey: 'Key', colDesc: 'Description', colRollout: 'Rollout %', colStatus: 'Status', colActions: '',
    enabled: 'Enabled', disabled: 'Disabled',
    addFlag: 'Add Flag',
    keyPlaceholder: 'flag-key',
    descPlaceholder: 'Description (optional)',
    rolloutLabel: 'Rollout %',
    create: 'Create',
    creating: 'Creating...',
    save: 'Save',
    saving: 'Saving...',
    loading: 'Loading...',
    empty: 'No flags configured.',
    errorCreate: 'Failed to create flag.',
    errorUpdate: 'Failed to update flag.',
  },
};

export const FeatureFlags: React.FC<Props> = ({ lang }) => {
  const tr = t[lang];
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newRollout, setNewRollout] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rolloutDrafts, setRolloutDrafts] = useState<Record<string, number>>({});
  const [savingRolloutKey, setSavingRolloutKey] = useState<string | null>(null);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  useEffect(() => {
    featureFlagApi.list()
      .then(items => {
        setFlags(items);
        setRolloutDrafts(Object.fromEntries(items.map(flag => [flag.flag_key, flag.rollout_pct])));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const replaceFlag = (updated: FeatureFlag) => {
    setFlags(prev => prev.map(f => f.flag_key === updated.flag_key ? updated : f));
    setRolloutDrafts(prev => ({ ...prev, [updated.flag_key]: updated.rollout_pct }));
  };

  const handleCreate = async () => {
    if (!newKey.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const data: FeatureFlagCreate = { flag_key: newKey.trim(), description: newDesc.trim() || undefined, rollout_pct: newRollout, enabled: false };
      const created = await featureFlagApi.create(data);
      setFlags(prev => [created, ...prev]);
      setRolloutDrafts(prev => ({ ...prev, [created.flag_key]: created.rollout_pct }));
      setNewKey(''); setNewDesc(''); setNewRollout(0); setShowForm(false);
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

  if (loading) return <p className="text-slate-500 text-sm p-8">{tr.loading}</p>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{tr.title}</h1>
        <Button className="gap-2 rounded-xl" onClick={() => setShowForm(v => !v)}>
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {tr.addFlag}
        </Button>
      </div>

      {showForm && (
        <Card className="rounded-2xl border border-slate-200 dark:border-slate-800">
          <CardContent className="pt-5 space-y-3">
            <div className="flex gap-2">
              <Input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder={tr.keyPlaceholder} className="rounded-xl font-mono" />
              <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder={tr.descPlaceholder} className="rounded-xl" />
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
          {flags.length === 0 ? (
            <p className="text-sm text-slate-400 p-6">{tr.empty}</p>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                <TableRow>
                  <TableHead className="font-bold text-slate-500">{tr.colKey}</TableHead>
                  <TableHead className="font-bold text-slate-500">{tr.colDesc}</TableHead>
                  <TableHead className="font-bold text-slate-500">{tr.colRollout}</TableHead>
                  <TableHead className="font-bold text-slate-500">{tr.colStatus}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {flags.map(flag => {
                  const draftRollout = rolloutDrafts[flag.flag_key] ?? flag.rollout_pct;
                  const rolloutChanged = draftRollout !== flag.rollout_pct;
                  const isSavingRollout = savingRolloutKey === flag.flag_key;
                  const isUpdating = updatingKey === flag.flag_key;

                  return (
                  <TableRow key={flag.flag_key}>
                    <TableCell className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">{flag.flag_key}</TableCell>
                    <TableCell className="text-sm text-slate-500">{flag.description || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <input type="range" min={0} max={100} value={draftRollout}
                          onChange={e => setRolloutDrafts(prev => ({ ...prev, [flag.flag_key]: Number(e.target.value) }))}
                          className="w-24 accent-indigo-500" />
                        <span className="text-xs font-bold text-slate-500 w-8">{draftRollout}%</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-lg px-2 text-xs"
                          onClick={() => handleRolloutSave(flag)}
                          disabled={!rolloutChanged || isSavingRollout}
                        >
                          {isSavingRollout ? tr.saving : tr.save}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${flag.enabled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                        {flag.enabled ? tr.enabled : tr.disabled}
                      </span>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleToggle(flag)}
                        disabled={isUpdating}
                        className="text-slate-400 hover:text-indigo-500 transition-colors disabled:opacity-50"
                      >
                        {flag.enabled ? <ToggleRight className="h-6 w-6 text-indigo-500" /> : <ToggleLeft className="h-6 w-6" />}
                      </button>
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

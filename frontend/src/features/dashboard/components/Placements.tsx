import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Plus, Trash2, X } from 'lucide-react';
import { placementApi, type Placement, type PlacementCreate } from '../../../services/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { useProject } from '../../../contexts/ProjectContext';

interface Props { lang: 'en' | 'ko'; }

const t = {
  ko: {
    title: 'Placements',
    colKey: 'Key', colName: '이름', colStatus: '상태', colCohort: '대상 기수', colRoles: '허용 역할', colWindow: '기간', colActions: '',
    addPlacement: '배치 추가',
    keyPlaceholder: 'placement-key',
    namePlaceholder: '이름',
    cohortPlaceholder: '기수 (예: 12)',
    rolesPlaceholder: '역할 (쉼표 구분, 예: builder,runner)',
    startPlaceholder: '시작일 (예: 2026-05-28T00:00:00)',
    endPlaceholder: '종료일 (예: 2026-06-10T00:00:00)',
    statusLabel: '상태',
    projectLabel: '프로젝트',
    noProject: '(없음)',
    active: '활성', paused: '일시중지', archived: '보관됨',
    create: '생성',
    creating: '생성 중...',
    deleteConfirm: '이 배치를 삭제할까요?',
    deleting: '삭제 중...',
    loading: '불러오는 중...',
    empty: '등록된 배치가 없습니다.',
    errorCreate: '생성에 실패했습니다.',
    errorDelete: '삭제에 실패했습니다.',
    noRoles: '(제한 없음)',
    allProjects: '전체',
  },
  en: {
    title: 'Placements',
    colKey: 'Key', colName: 'Name', colStatus: 'Status', colCohort: 'Cohort', colRoles: 'Allowed Roles', colWindow: 'Window', colActions: '',
    addPlacement: 'Add Placement',
    keyPlaceholder: 'placement-key',
    namePlaceholder: 'Name',
    cohortPlaceholder: 'Cohort (e.g. 12)',
    rolesPlaceholder: 'Roles (comma-separated, e.g. builder,runner)',
    startPlaceholder: 'Start (e.g. 2026-05-28T00:00:00)',
    endPlaceholder: 'End (e.g. 2026-06-10T00:00:00)',
    statusLabel: 'Status',
    projectLabel: 'Project',
    noProject: '(none)',
    active: 'Active', paused: 'Paused', archived: 'Archived',
    create: 'Create',
    creating: 'Creating...',
    deleteConfirm: 'Delete this placement?',
    deleting: 'Deleting...',
    loading: 'Loading...',
    empty: 'No placements configured.',
    errorCreate: 'Failed to create placement.',
    errorDelete: 'Failed to delete placement.',
    noRoles: '(any)',
    allProjects: 'All',
  },
};

const statusBadge = (status: string, tr: typeof t['en']) => {
  if (status === 'active') return <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-600">{tr.active}</span>;
  if (status === 'paused') return <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">{tr.paused}</span>;
  return <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500">{tr.archived}</span>;
};

const formatWindow = (start?: string | null, end?: string | null) => {
  const fmt = (s?: string | null) => s ? s.slice(0, 10) : '—';
  return `${fmt(start)} ~ ${fmt(end)}`;
};

export const Placements: React.FC<Props> = ({ lang }) => {
  const tr = t[lang];
  const { currentProjectId, projects: availableProjects } = useProject();
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [newKey, setNewKey] = useState('');
  const [newName, setNewName] = useState('');
  const [newStatus, setNewStatus] = useState('active');
  const [newProjectId, setNewProjectId] = useState('');
  const [newCohort, setNewCohort] = useState('');
  const [newRoles, setNewRoles] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const items = await placementApi.list(currentProjectId ?? undefined);
      setPlacements(items);
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [currentProjectId]);

  const handleCreate = async () => {
    if (!newKey.trim() || !newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const roles = newRoles.trim()
        ? newRoles.split(',').map(r => r.trim()).filter(Boolean)
        : undefined;
      const data: PlacementCreate = {
        key: newKey.trim(),
        name: newName.trim(),
        status: newStatus,
        project_id: newProjectId || undefined,
        target_cohort: newCohort.trim() || undefined,
        allowed_roles: roles,
        start_at: newStart.trim() || undefined,
        end_at: newEnd.trim() || undefined,
      };
      const created = await placementApi.create(data);
      setPlacements(prev => [created, ...prev]);
      setNewKey(''); setNewName(''); setNewStatus('active');
      setNewProjectId(''); setNewCohort(''); setNewRoles('');
      setNewStart(''); setNewEnd('');
      setShowForm(false);
    } catch (e: any) {
      setError(e?.message || tr.errorCreate);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (p: Placement) => {
    if (!window.confirm(tr.deleteConfirm)) return;
    setDeletingKey(p.key);
    setError(null);
    try {
      await placementApi.delete(p.key);
      setPlacements(prev => prev.filter(x => x.key !== p.key));
    } catch {
      setError(tr.errorDelete);
    } finally {
      setDeletingKey(null);
    }
  };

  if (loading) return <p className="text-slate-500 text-sm p-8">{tr.loading}</p>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{tr.title}</h1>
        <Button className="gap-2 rounded-xl" onClick={() => setShowForm(v => !v)}>
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {tr.addPlacement}
        </Button>
      </div>

      {showForm && (
        <Card className="rounded-2xl border border-slate-200 dark:border-slate-800">
          <CardContent className="pt-5 space-y-3">
            <div className="flex gap-2 flex-wrap">
              <Input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder={tr.keyPlaceholder} className="rounded-xl font-mono flex-1 min-w-40" />
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder={tr.namePlaceholder} className="rounded-xl flex-1 min-w-40" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="rounded-xl w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{tr.active}</SelectItem>
                  <SelectItem value="paused">{tr.paused}</SelectItem>
                  <SelectItem value="archived">{tr.archived}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={newProjectId || '__none__'} onValueChange={v => setNewProjectId(v === '__none__' ? '' : v)}>
                <SelectTrigger className="rounded-xl w-40">
                  <SelectValue placeholder={tr.projectLabel} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{tr.noProject}</SelectItem>
                  {availableProjects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={newCohort} onChange={e => setNewCohort(e.target.value)} placeholder={tr.cohortPlaceholder} className="rounded-xl w-40" />
              <Input value={newRoles} onChange={e => setNewRoles(e.target.value)} placeholder={tr.rolesPlaceholder} className="rounded-xl flex-1 min-w-48" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Input value={newStart} onChange={e => setNewStart(e.target.value)} placeholder={tr.startPlaceholder} className="rounded-xl flex-1 min-w-52" />
              <Input value={newEnd} onChange={e => setNewEnd(e.target.value)} placeholder={tr.endPlaceholder} className="rounded-xl flex-1 min-w-52" />
            </div>
            {error && <p className="text-xs text-rose-500">{error}</p>}
            <Button size="sm" className="rounded-xl" onClick={handleCreate} disabled={creating || !newKey.trim() || !newName.trim()}>
              {creating ? tr.creating : tr.create}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border border-slate-200 dark:border-slate-800">
        <CardContent className="p-0">
          {error && !showForm && <p className="text-xs text-rose-500 px-6 pt-4">{error}</p>}
          {placements.length === 0 ? (
            <p className="text-sm text-slate-400 p-6">{tr.empty}</p>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                <TableRow>
                  <TableHead className="font-bold text-slate-500">{tr.colKey}</TableHead>
                  <TableHead className="font-bold text-slate-500">{tr.colName}</TableHead>
                  <TableHead className="font-bold text-slate-500">{tr.colStatus}</TableHead>
                  <TableHead className="font-bold text-slate-500">{tr.colCohort}</TableHead>
                  <TableHead className="font-bold text-slate-500">{tr.colRoles}</TableHead>
                  <TableHead className="font-bold text-slate-500">{tr.colWindow}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {placements.map(p => (
                  <TableRow key={p.key}>
                    <TableCell className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">{p.key}</TableCell>
                    <TableCell className="text-sm text-slate-700 dark:text-slate-300">{p.name}</TableCell>
                    <TableCell>{statusBadge(p.status, tr)}</TableCell>
                    <TableCell className="text-sm text-slate-500">{p.target_cohort || '—'}</TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {p.allowed_roles?.length ? p.allowed_roles.join(', ') : tr.noRoles}
                    </TableCell>
                    <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                      {formatWindow(p.start_at, p.end_at)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-lg px-2 text-xs text-slate-500 hover:text-rose-600"
                        onClick={() => handleDelete(p)}
                        disabled={deletingKey === p.key}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

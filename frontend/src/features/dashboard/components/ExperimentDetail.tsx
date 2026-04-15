import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { ArrowLeft, Pencil, Trash2, X, Check, Play, Pause, CheckCircle, Archive } from 'lucide-react';
import { experimentApi, type Experiment, type ExperimentStatus } from '../../../services/api';

interface ExperimentDetailProps {
  lang: 'en' | 'ko';
}

const translations = {
  en: {
    back: 'Back',
    loading: 'Loading...',
    error: 'Failed to load experiment.',
    notFound: 'Experiment not found.',
    labelHypothesis: 'Hypothesis',
    labelStatus: 'Status',
    labelCreated: 'Created',
    labelUpdated: 'Updated',
    sectionVariants: 'Variants',
    colVariantName: 'Name',
    colTrafficRatio: 'Traffic',
    colDescription: 'Description',
    edit: 'Edit',
    delete: 'Delete',
    deleteConfirm: 'Delete this experiment?',
    save: 'Save',
    cancel: 'Cancel',
    saving: 'Saving...',
    labelName: 'Name',
    none: '-',
    actionStart: 'Start',
    actionPause: 'Pause',
    actionResume: 'Resume',
    actionComplete: 'Complete',
    actionArchive: 'Archive',
    statusChangeConfirm: (to: string) => `Change status to "${to}"?`,
  },
  ko: {
    back: '목록으로',
    loading: '불러오는 중...',
    error: '실험 정보를 불러오지 못했습니다.',
    notFound: '실험을 찾을 수 없습니다.',
    labelHypothesis: '가설',
    labelStatus: '상태',
    labelCreated: '생성일',
    labelUpdated: '수정일',
    sectionVariants: 'Variants',
    colVariantName: '이름',
    colTrafficRatio: '트래픽 비율',
    colDescription: '설명',
    edit: '수정',
    delete: '삭제',
    deleteConfirm: '이 실험을 삭제하시겠습니까?',
    save: '저장',
    cancel: '취소',
    saving: '저장 중...',
    labelName: '실험 이름',
    none: '-',
    actionStart: '시작',
    actionPause: '일시정지',
    actionResume: '재개',
    actionComplete: '완료',
    actionArchive: '보관',
    statusChangeConfirm: (to: string) => `상태를 "${to}"(으)로 변경하시겠습니까?`,
  },
};

const statusConfig = {
  running: { en: 'Running', ko: '실행 중', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' },
  draft: { en: 'Draft', ko: '초안', color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' },
  paused: { en: 'Paused', ko: '일시정지', color: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400' },
  completed: { en: 'Completed', ko: '완료', color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
  archived: { en: 'Archived', ko: '보관', color: 'bg-rose-50 text-rose-400 dark:bg-rose-900/20 dark:text-rose-400' },
};

type TransitionButton = {
  to: ExperimentStatus;
  labelKey: 'actionStart' | 'actionPause' | 'actionResume' | 'actionComplete' | 'actionArchive';
  icon: React.ReactNode;
  variant: 'default' | 'outline' | 'destructive';
};

const transitionButtons: Record<ExperimentStatus, TransitionButton[]> = {
  draft: [
    { to: 'running', labelKey: 'actionStart', icon: <Play className="h-3.5 w-3.5" />, variant: 'default' },
    { to: 'archived', labelKey: 'actionArchive', icon: <Archive className="h-3.5 w-3.5" />, variant: 'outline' },
  ],
  running: [
    { to: 'paused', labelKey: 'actionPause', icon: <Pause className="h-3.5 w-3.5" />, variant: 'outline' },
    { to: 'completed', labelKey: 'actionComplete', icon: <CheckCircle className="h-3.5 w-3.5" />, variant: 'outline' },
    { to: 'archived', labelKey: 'actionArchive', icon: <Archive className="h-3.5 w-3.5" />, variant: 'outline' },
  ],
  paused: [
    { to: 'running', labelKey: 'actionResume', icon: <Play className="h-3.5 w-3.5" />, variant: 'default' },
    { to: 'completed', labelKey: 'actionComplete', icon: <CheckCircle className="h-3.5 w-3.5" />, variant: 'outline' },
    { to: 'archived', labelKey: 'actionArchive', icon: <Archive className="h-3.5 w-3.5" />, variant: 'outline' },
  ],
  completed: [],
  archived: [],
};

export const ExperimentDetail: React.FC<ExperimentDetailProps> = ({ lang }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = translations[lang];

  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editHypothesis, setEditHypothesis] = useState('');
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    experimentApi.get(id)
      .then((data) => { setExperiment(data); setLoading(false); })
      .catch(() => { setError(t.error); setLoading(false); });
  }, [id]);

  const startEdit = () => {
    if (!experiment) return;
    setEditName(experiment.name);
    setEditHypothesis(experiment.hypothesis || '');
    setEditing(true);
  };

  const handleSave = async () => {
    if (!experiment) return;
    setSaving(true);
    try {
      const updated = await experimentApi.update(experiment.id, {
        name: editName.trim(),
        hypothesis: editHypothesis.trim() || undefined,
      });
      setExperiment(updated);
      setEditing(false);
    } catch {
      // silent — retry available
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (to: ExperimentStatus) => {
    if (!experiment) return;
    const label = statusConfig[to][lang];
    if (!window.confirm(t.statusChangeConfirm(label))) return;
    setTransitioning(true);
    try {
      const updated = await experimentApi.update(experiment.id, { status: to });
      setExperiment(updated);
    } catch {
      // silent — status badge reflects current state
    } finally {
      setTransitioning(false);
    }
  };

  const handleDelete = async () => {
    if (!experiment || !window.confirm(t.deleteConfirm)) return;
    await experimentApi.delete(experiment.id);
    navigate('/experiments');
  };

  if (loading) return <p className="text-slate-500 dark:text-slate-400 text-sm p-8">{t.loading}</p>;
  if (error) return <p className="text-rose-500 text-sm p-8">{error}</p>;
  if (!experiment) return <p className="text-slate-500 text-sm p-8">{t.notFound}</p>;

  const status = statusConfig[experiment.status];
  const buttons = transitionButtons[experiment.status] ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" className="gap-2 rounded-xl text-slate-500" onClick={() => navigate('/experiments')}>
          <ArrowLeft className="h-4 w-4" />
          {t.back}
        </Button>
        <div className="flex gap-2">
          {!editing && (
            <Button variant="outline" className="gap-2 rounded-xl" onClick={startEdit}>
              <Pencil className="h-4 w-4" />
              {t.edit}
            </Button>
          )}
          <Button variant="outline" className="gap-2 rounded-xl text-rose-600 hover:text-rose-600 border-rose-200" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
            {t.delete}
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <CardHeader className="pb-4">
          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelName}</label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-xl text-lg font-bold" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelHypothesis}</label>
                <Textarea value={editHypothesis} onChange={(e) => setEditHypothesis(e.target.value)} className="rounded-xl resize-none" rows={2} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="gap-1.5 rounded-xl" onClick={handleSave} disabled={saving}>
                  <Check className="h-3.5 w-3.5" />
                  {saving ? t.saving : t.save}
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" onClick={() => setEditing(false)} disabled={saving}>
                  <X className="h-3.5 w-3.5" />
                  {t.cancel}
                </Button>
              </div>
            </div>
          ) : (
            <CardTitle className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              {experiment.name}
            </CardTitle>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!editing && experiment.hypothesis && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t.labelHypothesis}</p>
              <p className="text-slate-700 dark:text-slate-300">{experiment.hypothesis}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t.labelStatus}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${status.color}`}>
                  {status[lang]}
                </span>
                {buttons.map((btn) => (
                  <Button
                    key={btn.to}
                    size="sm"
                    variant={btn.variant}
                    className="gap-1.5 rounded-xl h-7 text-xs"
                    disabled={transitioning}
                    onClick={() => handleStatusChange(btn.to)}
                  >
                    {btn.icon}
                    {t[btn.labelKey]}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t.labelCreated}</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {new Date(experiment.created_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US')}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t.labelUpdated}</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {new Date(experiment.updated_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">{t.sectionVariants}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
              <TableRow>
                <TableHead className="font-bold text-slate-500">{t.colVariantName}</TableHead>
                <TableHead className="font-bold text-slate-500">{t.colTrafficRatio}</TableHead>
                <TableHead className="font-bold text-slate-500">{t.colDescription}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {experiment.variants.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium text-slate-800 dark:text-slate-200">{v.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${v.traffic_ratio * 100}%` }} />
                      </div>
                      <span className="text-xs font-bold text-slate-500">{(v.traffic_ratio * 100).toFixed(0)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-500 dark:text-slate-400 text-sm">
                    {v.description || t.none}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

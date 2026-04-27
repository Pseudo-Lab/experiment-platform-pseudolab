import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { ArrowLeft, Pencil, Trash2, X, Check, Play, Pause, CheckCircle, Archive, TrendingUp, BookOpen, Ship, AlertTriangle, RotateCcw } from 'lucide-react';
import {
  experimentApi, experimentResultApi, decisionApi,
  type Experiment, type ExperimentStatus,
  type ExperimentResult, type Decision, type LearningNote, type DecisionType,
} from '../../../services/api';

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
    sectionResult: 'Experiment Result',
    resultLoading: 'Loading result...',
    resultNoMetric: 'primary_metric is not configured.',
    resultNoData: 'No assigned users.',
    labelTreatment: 'Treatment',
    labelControl: 'Control',
    labelUsers: 'Users',
    labelConversions: 'Conversions',
    labelRate: 'Conv. Rate',
    labelUplift: 'Uplift',
    labelProbWin: 'Prob. Treatment Wins',
    labelSrm: 'SRM Warning',
    srmWarningMsg: 'Sample ratio mismatch detected. Check assignment logic.',
    sectionDecisions: 'Decisions',
    sectionNotes: 'Learning Notes',
    addDecision: 'Add Decision',
    addNote: 'Add Note',
    decisionPlaceholder: 'Enter decision reason...',
    notePlaceholder: 'Enter what you learned...',
    authorPlaceholder: 'Author (optional)',
    submit: 'Save',
    submitting: 'Saving...',
    ship: 'Ship',
    hold: 'Hold',
    rollback: 'Rollback',
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
    sectionResult: '실험 결과',
    resultLoading: '결과 불러오는 중...',
    resultNoMetric: 'primary_metric이 설정되지 않았습니다.',
    resultNoData: '배정된 사용자가 없습니다.',
    labelTreatment: 'Treatment',
    labelControl: 'Control',
    labelUsers: '사용자 수',
    labelConversions: '전환 수',
    labelRate: '전환율',
    labelUplift: 'Uplift',
    labelProbWin: 'Treatment 승률',
    labelSrm: 'SRM 경고',
    srmWarningMsg: '샘플 비율이 예상과 다릅니다. 배정 로직을 확인하세요.',
    sectionDecisions: '의사결정',
    sectionNotes: '학습 노트',
    addDecision: '결정 추가',
    addNote: '노트 추가',
    decisionPlaceholder: '결정 이유를 입력하세요...',
    notePlaceholder: '학습한 내용을 입력하세요...',
    authorPlaceholder: '작성자 (선택)',
    submit: '저장',
    submitting: '저장 중...',
    ship: '배포',
    hold: '보류',
    rollback: '롤백',
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

  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [resultLoading, setResultLoading] = useState(false);

  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [notes, setNotes] = useState<LearningNote[]>([]);
  const [decisionType, setDecisionType] = useState<DecisionType>('SHIP');
  const [decisionReason, setDecisionReason] = useState('');
  const [decisionBy, setDecisionBy] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteBy, setNoteBy] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [submittingNote, setSubmittingNote] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    experimentApi.get(id)
      .then((data) => { setExperiment(data); setLoading(false); })
      .catch(() => { setError(t.error); setLoading(false); });
    decisionApi.list(id).then(setDecisions).catch(() => {});
    decisionApi.listNotes(id).then(setNotes).catch(() => {});
  }, [id]);

  const loadResult = () => {
    if (!id || resultLoading) return;
    setResultLoading(true);
    experimentResultApi.getResult(id)
      .then(setResult)
      .catch(() => {})
      .finally(() => setResultLoading(false));
  };

  const handleAddDecision = async () => {
    if (!id || !decisionReason.trim()) return;
    setSubmittingDecision(true);
    try {
      const d = await decisionApi.create({ experiment_id: id, decision: decisionType, reason: decisionReason.trim(), decided_by: decisionBy.trim() || 'anonymous' });
      setDecisions(prev => [d, ...prev]);
      setDecisionReason('');
      setDecisionBy('');
    } finally {
      setSubmittingDecision(false);
    }
  };

  const handleAddNote = async () => {
    if (!id || !noteContent.trim()) return;
    setSubmittingNote(true);
    try {
      const n = await decisionApi.createNote({ experiment_id: id, content: noteContent.trim(), created_by: noteBy.trim() || undefined });
      setNotes(prev => [n, ...prev]);
      setNoteContent('');
      setNoteBy('');
    } finally {
      setSubmittingNote(false);
    }
  };

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

      {/* ── 실험 결과 ── */}
      <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-500" />
            {t.sectionResult}
          </CardTitle>
          {!result && (
            <Button size="sm" variant="outline" className="rounded-xl" onClick={loadResult} disabled={resultLoading}>
              {resultLoading ? t.resultLoading : (lang === 'ko' ? '결과 불러오기' : 'Load Result')}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!result && !resultLoading && (
            <p className="text-sm text-slate-400">{lang === 'ko' ? '버튼을 눌러 결과를 확인하세요.' : 'Click the button to load results.'}</p>
          )}
          {resultLoading && <p className="text-sm text-slate-400">{t.resultLoading}</p>}
          {result && result.message && <p className="text-sm text-slate-400">{result.message}</p>}
          {result && result.treatment && result.control && (
            <div className="space-y-4">
              {result.srm_warning && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-amber-600 dark:text-amber-400 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {t.srmWarningMsg}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {[{ label: t.labelTreatment, data: result.treatment, color: 'indigo' }, { label: t.labelControl, data: result.control, color: 'slate' }].map(({ label, data, color }) => (
                  <div key={label} className={`p-4 rounded-xl bg-${color}-50 dark:bg-${color}-900/10 border border-${color}-100 dark:border-${color}-800`}>
                    <p className={`text-xs font-bold uppercase text-${color}-500 mb-2`}>{label}</p>
                    <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{(data.rate * 100).toFixed(2)}%</p>
                    <p className="text-xs text-slate-500 mt-1">{data.conversions} / {data.users} {t.labelUsers}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <p className="text-xs text-slate-400 mb-1">{t.labelUplift}</p>
                  <p className={`text-lg font-bold ${(result.uplift ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {((result.uplift ?? 0) * 100).toFixed(2)}%
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <p className="text-xs text-slate-400 mb-1">{t.labelProbWin}</p>
                  <p className="text-lg font-bold text-indigo-600">{((result.probability_treatment_wins ?? 0) * 100).toFixed(1)}%</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <p className="text-xs text-slate-400 mb-1">{lang === 'ko' ? '총 샘플' : 'Sample Size'}</p>
                  <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{result.sample_size.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 의사결정 ── */}
      <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Ship className="h-5 w-5 text-indigo-500" />
            {t.sectionDecisions}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex gap-2">
              {(['SHIP', 'HOLD', 'ROLLBACK'] as DecisionType[]).map((d) => (
                <button key={d} onClick={() => setDecisionType(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${decisionType === d
                    ? d === 'SHIP' ? 'bg-emerald-500 text-white border-emerald-500'
                    : d === 'HOLD' ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-rose-500 text-white border-rose-500'
                    : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-400'}`}>
                  {d === 'SHIP' ? t.ship : d === 'HOLD' ? t.hold : t.rollback}
                </button>
              ))}
            </div>
            <Textarea value={decisionReason} onChange={e => setDecisionReason(e.target.value)} placeholder={t.decisionPlaceholder} className="rounded-xl resize-none" rows={2} />
            <div className="flex gap-2">
              <Input value={decisionBy} onChange={e => setDecisionBy(e.target.value)} placeholder={t.authorPlaceholder} className="rounded-xl" />
              <Button size="sm" className="rounded-xl shrink-0" onClick={handleAddDecision} disabled={submittingDecision || !decisionReason.trim()}>
                {submittingDecision ? t.submitting : t.submit}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {decisions.map(d => (
              <div key={d.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${d.decision === 'SHIP' ? 'bg-emerald-100 text-emerald-600' : d.decision === 'HOLD' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>
                    {d.decision}
                  </span>
                  <span className="text-xs text-slate-400">{d.decided_by} · {new Date(d.decided_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300">{d.reason}</p>
              </div>
            ))}
            {decisions.length === 0 && <p className="text-sm text-slate-400">{lang === 'ko' ? '아직 결정이 없습니다.' : 'No decisions yet.'}</p>}
          </div>
        </CardContent>
      </Card>

      {/* ── 학습 노트 ── */}
      <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-500" />
            {t.sectionNotes}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder={t.notePlaceholder} className="rounded-xl resize-none" rows={2} />
            <div className="flex gap-2">
              <Input value={noteBy} onChange={e => setNoteBy(e.target.value)} placeholder={t.authorPlaceholder} className="rounded-xl" />
              <Button size="sm" className="rounded-xl shrink-0" onClick={handleAddNote} disabled={submittingNote || !noteContent.trim()}>
                {submittingNote ? t.submitting : t.submit}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {notes.map(n => (
              <div key={n.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-400 mb-1">{n.created_by ?? 'anonymous'} · {new Date(n.created_at).toLocaleDateString()}</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{n.content}</p>
              </div>
            ))}
            {notes.length === 0 && <p className="text-sm text-slate-400">{lang === 'ko' ? '아직 노트가 없습니다.' : 'No notes yet.'}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

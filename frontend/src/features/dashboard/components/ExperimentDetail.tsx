import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { ArrowLeft, Pencil, Trash2, X, Check, Play, Pause, CheckCircle, Archive, TrendingUp, BookOpen, Ship, AlertTriangle, SlidersHorizontal, Plus } from 'lucide-react';
import {
  experimentApi, experimentResultApi, decisionApi, experimentPlacementApi,
  type Experiment, type ExperimentStatus,
  type ExperimentResult, type Decision, type LearningNote, type DecisionType,
  type ExperimentPlacementConfig,
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
    sectionPlacements: 'LVUP UI Slots',
    placementsLoading: 'Loading LVUP UI slots...',
    placementsError: 'Failed to load LVUP UI slots.',
    placementsEmpty: 'No LVUP UI slots configured.',
    placementKey: 'Slot key',
    uiId: 'UI ID',
    uiType: 'UI type',
    uiTitle: 'Title',
    uiDescription: 'Description',
    targetUrl: 'Target URL',
    source: 'Source',
    targetCohort: 'Target cohort',
    allowedRoles: 'Allowed roles',
    enabled: 'Enabled',
    disabled: 'Disabled',
    roleBuilder: 'Builder',
    roleRunner: 'Runner',
    addPlacement: 'Add Slot',
    createPlacement: 'Create Slot',
    creatingPlacement: 'Creating...',
    deletePlacement: 'Delete Slot',
    deletingPlacement: 'Deleting...',
    deletePlacementConfirm: 'Delete this LVUP UI slot? Use Disabled instead if it may be reused.',
    placementCreated: 'LVUP UI slot created.',
    placementSaved: 'LVUP UI slot saved.',
    placementDeleted: 'LVUP UI slot deleted.',
    placementCreateError: 'Failed to create LVUP UI slot.',
    placementSaveError: 'Failed to save LVUP UI slot.',
    placementDeleteError: 'Failed to delete LVUP UI slot.',
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
    sectionPlacements: 'LVUP 노출 슬롯',
    placementsLoading: 'LVUP 노출 슬롯을 불러오는 중...',
    placementsError: 'LVUP 노출 슬롯을 불러오지 못했습니다.',
    placementsEmpty: '설정된 LVUP 노출 슬롯이 없습니다.',
    placementKey: '슬롯 키',
    uiId: 'UI ID',
    uiType: 'UI 타입',
    uiTitle: '제목',
    uiDescription: '설명',
    targetUrl: '이동 URL',
    source: 'Source',
    targetCohort: '대상 기수',
    allowedRoles: '허용 역할',
    enabled: '활성',
    disabled: '비활성',
    roleBuilder: '빌더',
    roleRunner: '러너',
    addPlacement: '슬롯 추가',
    createPlacement: '슬롯 생성',
    creatingPlacement: '생성 중...',
    deletePlacement: '슬롯 삭제',
    deletingPlacement: '삭제 중...',
    deletePlacementConfirm: '이 LVUP 노출 슬롯을 삭제하시겠습니까? 다시 사용할 가능성이 있으면 비활성을 사용하세요.',
    placementCreated: 'LVUP 노출 슬롯을 생성했습니다.',
    placementSaved: 'LVUP 노출 슬롯을 저장했습니다.',
    placementDeleted: 'LVUP 노출 슬롯을 삭제했습니다.',
    placementCreateError: 'LVUP 노출 슬롯 생성에 실패했습니다.',
    placementSaveError: 'LVUP 노출 슬롯 저장에 실패했습니다.',
    placementDeleteError: 'LVUP 노출 슬롯 삭제에 실패했습니다.',
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

const roleOptions = ['builder', 'runner'] as const;
const uiTypeOptions = ['banner', 'card', 'modal', 'cta'];

type PlacementForm = {
  placement_key: string;
  ui_id: string;
  ui_type: string;
  title: string;
  description: string;
  target_url: string;
  source: string;
  target_cohort: string;
  allowed_roles: string[];
  enabled: boolean;
};

const toPlacementForm = (placement: ExperimentPlacementConfig): PlacementForm => ({
  placement_key: placement.placement_key,
  ui_id: placement.ui_id,
  ui_type: placement.ui_type,
  title: placement.title,
  description: placement.description,
  target_url: placement.target_url,
  source: placement.source,
  target_cohort: placement.target_cohort,
  allowed_roles: [...placement.allowed_roles],
  enabled: placement.enabled,
});

const emptyPlacementForm = (): PlacementForm => ({
  placement_key: '',
  ui_id: '',
  ui_type: 'banner',
  title: '',
  description: '',
  target_url: '',
  source: 'project_detail_home',
  target_cohort: '12',
  allowed_roles: ['builder', 'runner'],
  enabled: false,
});

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

  const [placements, setPlacements] = useState<ExperimentPlacementConfig[]>([]);
  const [placementsLoading, setPlacementsLoading] = useState(false);
  const [placementsError, setPlacementsError] = useState<string | null>(null);
  const [selectedPlacementKey, setSelectedPlacementKey] = useState<string | null>(null);
  const [placementEditing, setPlacementEditing] = useState(false);
  const [placementCreating, setPlacementCreating] = useState(false);
  const [placementForm, setPlacementForm] = useState<PlacementForm | null>(null);
  const [placementSaving, setPlacementSaving] = useState(false);
  const [placementDeleting, setPlacementDeleting] = useState(false);
  const [placementSaveMessage, setPlacementSaveMessage] = useState<string | null>(null);

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
    setPlacementsLoading(true);
    setPlacementsError(null);
    experimentPlacementApi.list(id)
      .then((data) => {
        setPlacements(data);
        setSelectedPlacementKey((current) => {
          if (current && data.some((placement) => placement.placement_key === current)) return current;
          return data[0]?.placement_key ?? null;
        });
      })
      .catch(() => setPlacementsError(t.placementsError))
      .finally(() => setPlacementsLoading(false));
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

  const selectedPlacement =
    placements.find((placement) => placement.placement_key === selectedPlacementKey) ?? placements[0] ?? null;

  const handleSelectPlacement = (placementKey: string) => {
    setSelectedPlacementKey(placementKey);
    setPlacementEditing(false);
    setPlacementCreating(false);
    setPlacementForm(null);
    setPlacementSaveMessage(null);
  };

  const startPlacementCreate = () => {
    setPlacementForm(emptyPlacementForm());
    setPlacementCreating(true);
    setPlacementEditing(false);
    setPlacementSaveMessage(null);
  };

  const startPlacementEdit = () => {
    if (!selectedPlacement) return;
    setPlacementForm(toPlacementForm(selectedPlacement));
    setPlacementEditing(true);
    setPlacementCreating(false);
    setPlacementSaveMessage(null);
  };

  const cancelPlacementForm = () => {
    setPlacementEditing(false);
    setPlacementCreating(false);
    setPlacementForm(null);
  };

  const updatePlacementForm = <K extends keyof PlacementForm>(key: K, value: PlacementForm[K]) => {
    setPlacementForm((current) => current ? { ...current, [key]: value } : current);
  };

  const togglePlacementRole = (role: string, checked: boolean) => {
    setPlacementForm((current) => {
      if (!current) return current;
      const nextRoles = checked
        ? Array.from(new Set([...current.allowed_roles, role]))
        : current.allowed_roles.filter((item) => item !== role);
      return { ...current, allowed_roles: nextRoles };
    });
  };

  const handlePlacementSave = async () => {
    if (!id || !placementForm) return;
    setPlacementSaving(true);
    setPlacementSaveMessage(null);
    try {
      const payload = {
        ui_id: placementForm.ui_id.trim(),
        ui_type: placementForm.ui_type.trim(),
        title: placementForm.title.trim(),
        description: placementForm.description.trim(),
        target_url: placementForm.target_url.trim(),
        source: placementForm.source.trim(),
        target_cohort: placementForm.target_cohort.trim(),
        allowed_roles: placementForm.allowed_roles,
        enabled: placementForm.enabled,
      };
      if (placementCreating) {
        const created = await experimentPlacementApi.create(id, {
          placement_key: placementForm.placement_key.trim(),
          ...payload,
        });
        setPlacements((current) => [...current, created].sort((a, b) => a.placement_key.localeCompare(b.placement_key)));
        setSelectedPlacementKey(created.placement_key);
        setPlacementSaveMessage(t.placementCreated);
      } else {
        if (!selectedPlacement) return;
        const updated = await experimentPlacementApi.update(id, selectedPlacement.placement_key, payload);
        setPlacements((current) => current.map((placement) => (
          placement.placement_key === updated.placement_key ? updated : placement
        )));
        setPlacementSaveMessage(t.placementSaved);
      }
      setPlacementEditing(false);
      setPlacementCreating(false);
      setPlacementForm(null);
    } catch {
      setPlacementSaveMessage(placementCreating ? t.placementCreateError : t.placementSaveError);
    } finally {
      setPlacementSaving(false);
    }
  };

  const handlePlacementDelete = async () => {
    if (!id || !selectedPlacement || !window.confirm(t.deletePlacementConfirm)) return;
    setPlacementDeleting(true);
    setPlacementSaveMessage(null);
    try {
      await experimentPlacementApi.delete(id, selectedPlacement.placement_key);
      const remaining = placements.filter((placement) => placement.placement_key !== selectedPlacement.placement_key);
      setPlacements(remaining);
      setSelectedPlacementKey(remaining[0]?.placement_key ?? null);
      cancelPlacementForm();
      setPlacementSaveMessage(t.placementDeleted);
    } catch {
      setPlacementSaveMessage(t.placementDeleteError);
    } finally {
      setPlacementDeleting(false);
    }
  };

  if (loading) return <p className="text-slate-500 dark:text-slate-400 text-sm p-8">{t.loading}</p>;
  if (error) return <p className="text-rose-500 text-sm p-8">{error}</p>;
  if (!experiment) return <p className="text-slate-500 text-sm p-8">{t.notFound}</p>;

  const status = statusConfig[experiment.status];
  const buttons = transitionButtons[experiment.status] ?? [];
  const uiTypeSelectOptions = Array.from(
    new Set([...uiTypeOptions, placementForm?.ui_type].filter((value): value is string => Boolean(value))),
  );
  const placementFormValid = Boolean(
    placementForm?.placement_key.trim() &&
    placementForm.ui_id.trim() &&
    placementForm.ui_type.trim() &&
    placementForm.title.trim() &&
    placementForm.description.trim() &&
    placementForm.target_url.trim() &&
    placementForm.source.trim() &&
    placementForm.target_cohort.trim() &&
    placementForm.allowed_roles.length > 0,
  );
  const placementMessageIsSuccess = placementSaveMessage
    ? [t.placementCreated, t.placementSaved, t.placementDeleted].includes(placementSaveMessage)
    : false;

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

      <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <SlidersHorizontal className="h-5 w-5 text-indigo-500" />
            {t.sectionPlacements}
          </CardTitle>
          <div className="flex flex-wrap justify-end gap-2">
            {!placementEditing && !placementCreating && (
              <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" onClick={startPlacementCreate}>
                <Plus className="h-3.5 w-3.5" />
                {t.addPlacement}
              </Button>
            )}
            {selectedPlacement && !placementEditing && !placementCreating && (
              <>
                <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" onClick={startPlacementEdit}>
                  <Pencil className="h-3.5 w-3.5" />
                  {t.edit}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 rounded-xl border-rose-200 text-rose-600 hover:text-rose-600"
                  onClick={handlePlacementDelete}
                  disabled={placementDeleting}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {placementDeleting ? t.deletingPlacement : t.deletePlacement}
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {placementsLoading && <p className="text-sm text-slate-400">{t.placementsLoading}</p>}
          {placementsError && <p className="text-sm text-rose-500">{placementsError}</p>}
          {!placementsLoading && !placementsError && placements.length === 0 && !placementCreating && (
            <p className="text-sm text-slate-400">{t.placementsEmpty}</p>
          )}
          {!placementsLoading && !placementsError && (selectedPlacement || placementCreating) && (
            <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
              <div className="space-y-2">
                {placements.map((placement) => {
                  const active = placement.placement_key === selectedPlacement.placement_key;
                  return (
                    <button
                      type="button"
                      key={placement.placement_key}
                      onClick={() => handleSelectPlacement(placement.placement_key)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                        active
                          ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
                      }`}
                    >
                      <span className="block truncate text-sm font-bold">{placement.placement_key}</span>
                      <span className="mt-1 flex items-center gap-2 text-xs">
                        <span>{placement.ui_type}</span>
                        <span className="text-slate-300">/</span>
                        <span>{placement.enabled ? t.enabled : t.disabled}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                {!placementEditing && !placementCreating && selectedPlacement && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      [t.placementKey, selectedPlacement.placement_key],
                      [t.uiId, selectedPlacement.ui_id],
                      [t.uiType, selectedPlacement.ui_type],
                      [t.uiTitle, selectedPlacement.title],
                      [t.uiDescription, selectedPlacement.description],
                      [t.targetUrl, selectedPlacement.target_url],
                      [t.source, selectedPlacement.source],
                      [t.targetCohort, selectedPlacement.target_cohort],
                      [t.allowedRoles, selectedPlacement.allowed_roles.join(', ')],
                      [t.labelStatus, selectedPlacement.enabled ? t.enabled : t.disabled],
                    ].map(([label, value]) => (
                      <div key={label} className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                        <p className="break-words text-sm font-medium text-slate-700 dark:text-slate-300">{value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {(placementEditing || placementCreating) && placementForm && (
                  <div className="space-y-4">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        checked={placementForm.enabled}
                        onChange={(event) => updatePlacementForm('enabled', event.target.checked)}
                      />
                      {t.enabled}
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.placementKey}</label>
                        <Input
                          value={placementForm.placement_key}
                          onChange={(event) => updatePlacementForm('placement_key', event.target.value)}
                          className="rounded-xl"
                          aria-label={t.placementKey}
                          disabled={!placementCreating}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.uiId}</label>
                        <Input
                          value={placementForm.ui_id}
                          onChange={(event) => updatePlacementForm('ui_id', event.target.value)}
                          className="rounded-xl"
                          aria-label={t.uiId}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.uiType}</label>
                        <Select value={placementForm.ui_type} onValueChange={(value) => updatePlacementForm('ui_type', value)}>
                          <SelectTrigger className="rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {uiTypeSelectOptions.map((value) => (
                              <SelectItem key={value} value={value}>{value}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.uiTitle}</label>
                        <Input
                          value={placementForm.title}
                          onChange={(event) => updatePlacementForm('title', event.target.value)}
                          className="rounded-xl"
                          aria-label={t.uiTitle}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.targetUrl}</label>
                        <Input
                          value={placementForm.target_url}
                          onChange={(event) => updatePlacementForm('target_url', event.target.value)}
                          className="rounded-xl"
                          aria-label={t.targetUrl}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.source}</label>
                        <Input
                          value={placementForm.source}
                          onChange={(event) => updatePlacementForm('source', event.target.value)}
                          className="rounded-xl"
                          aria-label={t.source}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.targetCohort}</label>
                        <Input
                          value={placementForm.target_cohort}
                          onChange={(event) => updatePlacementForm('target_cohort', event.target.value)}
                          className="rounded-xl"
                          aria-label={t.targetCohort}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.uiDescription}</label>
                      <Textarea
                        value={placementForm.description}
                        onChange={(event) => updatePlacementForm('description', event.target.value)}
                        className="rounded-xl resize-none"
                        rows={2}
                        aria-label={t.uiDescription}
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.allowedRoles}</p>
                      <div className="flex flex-wrap gap-3">
                        {roleOptions.map((role) => (
                          <label key={role} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              checked={placementForm.allowed_roles.includes(role)}
                              onChange={(event) => togglePlacementRole(role, event.target.checked)}
                            />
                            {role === 'builder' ? t.roleBuilder : t.roleRunner}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        className="gap-1.5 rounded-xl"
                        onClick={handlePlacementSave}
                        disabled={placementSaving || !placementFormValid}
                      >
                        <Check className="h-3.5 w-3.5" />
                        {placementSaving ? (placementCreating ? t.creatingPlacement : t.saving) : (placementCreating ? t.createPlacement : t.save)}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 rounded-xl"
                        onClick={cancelPlacementForm}
                        disabled={placementSaving}
                      >
                        <X className="h-3.5 w-3.5" />
                        {t.cancel}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {placementSaveMessage && (
            <p className={`text-sm ${placementMessageIsSuccess ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
              {placementSaveMessage}
            </p>
          )}
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

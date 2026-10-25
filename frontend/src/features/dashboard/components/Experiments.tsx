import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { Plus, Search, MoreHorizontal, Eye, Trash2 } from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { experimentApi, type Experiment, type ExperimentStatus } from '../../../services/api';
import { useProject } from '../../../contexts/ProjectContext';
import { CreateExperimentModal } from './CreateExperimentModal';

interface ExperimentsProps {
  lang: 'en' | 'ko';
}

const translations = {
  en: {
    title: 'Experiments',
    description: 'Turn a hypothesis into a test, check the data, and record what you learn.',
    newExperiment: 'New Experiment',
    searchPlaceholder: 'Search experiments...',
    allStatus: 'All Status',
    statusRunning: 'Running',
    statusDraft: 'Draft',
    statusPaused: 'Paused',
    statusCompleted: 'Completed',
    statusArchived: 'Archived',
    allProducts: 'All Products',
    colName: 'Experiment Name',
    colStatus: 'Status',
    colVariants: 'Variants',
    colCreatedAt: 'Created',
    actionView: 'View Details',
    actionDelete: 'Delete',
    loading: 'Loading...',
    error: 'Failed to load experiments.',
    empty: 'No experiments found.',
    deleteConfirm: 'Delete this experiment?',
    retry: 'Retry', clear: 'Clear filters', filteredEmpty: 'No experiments match these filters.', scope: 'Scope', total: 'All experiments', next: 'Next step', design: 'Continue design', review: 'Review results', inspect: 'Check collection', actions: 'Experiment actions', deleteError: 'Could not delete the experiment. Please try again.', emptyHint: 'Start with a name and a hypothesis. Configure collection before launching.',
  },
  ko: {
    title: '실험 관리',
    description: '가설을 세우고, 수집된 데이터를 확인하고, 다음 결정을 기록하세요.',
    newExperiment: '새 실험 생성',
    searchPlaceholder: '실험 검색...',
    allStatus: '모든 상태',
    statusRunning: '실행 중',
    statusDraft: '초안',
    statusPaused: '일시정지',
    statusCompleted: '완료',
    statusArchived: '보관',
    allProducts: '전체 제품',
    colName: '실험명',
    colStatus: '상태',
    colVariants: 'Variants',
    colCreatedAt: '생성일',
    actionView: '상세 보기',
    actionDelete: '삭제',
    loading: '불러오는 중...',
    error: '실험 목록을 불러오지 못했습니다.',
    empty: '실험이 없습니다.',
    deleteConfirm: '이 실험을 삭제하시겠습니까?',
    retry: '다시 시도', clear: '필터 초기화', filteredEmpty: '조건에 맞는 실험이 없습니다.', scope: '조회 범위', total: '전체 실험', next: '다음 단계', design: '설계 이어가기', review: '결과 확인', inspect: '수집 확인', actions: '실험 작업', deleteError: '실험을 삭제하지 못했습니다. 다시 시도해주세요.', emptyHint: '이름과 가설부터 작성하세요. 데이터 수집 설정은 실험 시작 전에 채울 수 있습니다.',
  },
};

const statusConfig = {
  running: { en: 'Running', ko: '실행 중', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' },
  draft: { en: 'Draft', ko: '초안', color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' },
  paused: { en: 'Paused', ko: '일시정지', color: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400' },
  completed: { en: 'Completed', ko: '완료', color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
  archived: { en: 'Archived', ko: '보관', color: 'bg-rose-50 text-rose-400 dark:bg-rose-900/20 dark:text-rose-400' },
};

export const Experiments: React.FC<ExperimentsProps> = ({ lang }) => {
  const navigate = useNavigate();
  const t = translations[lang];
  const { currentProjectId, currentProject } = useProject();

  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ExperimentStatus>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchExperiments = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await experimentApi.list();
      setExperiments(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExperiments();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm(t.deleteConfirm)) return;
    setDeleteError(false);
    try {
      await experimentApi.delete(id);
      setExperiments((prev) => prev.filter((e) => e.id !== id));
    } catch {
      setDeleteError(true);
    }
  };

  const scopedExperiments = experiments.filter((exp) => !currentProjectId || (exp.project_id || exp.product) === currentProjectId);
  const filteredExperiments = scopedExperiments.filter((exp) =>
    `${exp.name} ${exp.hypothesis || ''}`.toLowerCase().includes(search.toLowerCase()) &&
    (statusFilter === 'all' || exp.status === statusFilter)
  );
  const nextStep = (exp: Experiment) => exp.status === 'draft' ? t.design : exp.status === 'running' ? t.inspect : t.review;
  const nextPath = (exp: Experiment) => `/experiments/${encodeURIComponent(exp.id)}${exp.status === 'draft' ? '' : exp.status === 'running' ? '?view=health' : '?view=results'}`;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">{t.title}</h1>
          <p className="text-muted-foreground mt-1">{t.description}</p>
        </div>
        <Button className="gap-2 rounded-xl shadow-lg" size="lg" onClick={() => setShowCreateModal(true)}>
          <Plus size={18} />
          {t.newExperiment}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">{t.scope}: <span className="font-medium text-foreground">{currentProject?.name || currentProjectId || (lang === 'ko' ? '전체 프로젝트' : 'All projects')}</span></p>
      <div role="group" className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label={t.allStatus}>
        {(['all', 'draft', 'running', 'completed'] as const).map((status) => (
          <Button key={status} variant="outline" aria-pressed={statusFilter === status}
            onClick={() => setStatusFilter(status)}
            className={`h-auto min-h-24 flex-col items-start gap-2 rounded-xl p-4 ${statusFilter === status ? 'border-primary bg-accent' : 'bg-card'}`}>
            <span className="text-xs text-muted-foreground">{status === 'all' ? t.total : statusConfig[status][lang]}</span>
            <span className="text-2xl font-semibold tabular-nums">{loading || error ? '—' : scopedExperiments.filter(exp => status === 'all' || exp.status === status).length}</span>
          </Button>
        ))}
      </div>
      {deleteError && <p role="alert" className="text-sm text-destructive">{t.deleteError}</p>}

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            aria-label={t.searchPlaceholder}
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-12 rounded-xl bg-card"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-full sm:w-40 h-12 rounded-xl bg-card" aria-label={t.allStatus}>
            <SelectValue placeholder={t.allStatus} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allStatus}</SelectItem>
            <SelectItem value="running">{t.statusRunning}</SelectItem>
            <SelectItem value="draft">{t.statusDraft}</SelectItem>
            <SelectItem value="paused">{t.statusPaused}</SelectItem>
            <SelectItem value="completed">{t.statusCompleted}</SelectItem>
            <SelectItem value="archived">{t.statusArchived}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">{t.loading}</p>
      ) : error ? (
        <Card role="alert" className="p-6 space-y-3"><p>{t.error}</p><Button variant="outline" onClick={fetchExperiments}>{t.retry}</Button></Card>
      ) : filteredExperiments.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <h2 className="font-semibold">{scopedExperiments.length ? t.filteredEmpty : t.empty}</h2>
          {scopedExperiments.length ? <Button variant="outline" onClick={() => { setSearch(''); setStatusFilter('all'); }}>{t.clear}</Button> : <><p className="text-sm text-muted-foreground">{t.emptyHint}</p><Button onClick={() => setShowCreateModal(true)}>{t.newExperiment}</Button></>}
        </Card>
      ) : (
        <>
          {/* 데스크탑 테이블 */}
          <Card className="hidden md:block rounded-2xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                <TableRow>
                  <TableHead className="font-bold text-slate-500">{t.colName}</TableHead>
                  <TableHead className="font-bold text-slate-500">{t.colStatus}</TableHead>
                  <TableHead className="font-bold text-slate-500">{t.next}</TableHead>
                  <TableHead className="font-bold text-slate-500">{t.colCreatedAt}</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExperiments.map((exp) => (
                  <TableRow
                    key={exp.id}
                    className="group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    onClick={() => navigate(`/experiments/${exp.id}`)}
                  >
                    <TableCell>
                      <p className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        <Link to={`/experiments/${encodeURIComponent(exp.id)}`} onClick={event => event.stopPropagation()}>{exp.name}</Link>
                      </p>
                      {exp.hypothesis && (
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{exp.hypothesis}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${statusConfig[exp.status].color}`}>
                        {statusConfig[exp.status][lang]}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-300 font-medium">
                      <Link className="underline underline-offset-4" to={nextPath(exp)} onClick={event => event.stopPropagation()}>{nextStep(exp)}</Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(exp.created_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US')}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`${t.actions}: ${exp.name}`}
                            className=" text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => navigate(`/experiments/${exp.id}`)}>
                            <Eye className="h-4 w-4 text-slate-400" />
                            <span className="font-medium">{t.actionView}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer text-rose-600 focus:text-rose-600" onClick={() => handleDelete(exp.id)}>
                            <Trash2 className="h-4 w-4" />
                            <span className="font-medium">{t.actionDelete}</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* 모바일 카드 */}
          <div className="md:hidden space-y-3">
            {filteredExperiments.map((exp) => (
              <div
                key={exp.id}
                onClick={() => navigate(`/experiments/${exp.id}`)}
                className="bg-card rounded-2xl border dark:border-slate-800 p-4 shadow-sm cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-bold text-slate-800 dark:text-slate-100 text-sm flex-1"><Link to={`/experiments/${encodeURIComponent(exp.id)}`}>{exp.name}</Link></p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${statusConfig[exp.status].color}`}>
                    {statusConfig[exp.status][lang]}
                  </span>
                </div>
                {exp.hypothesis && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{exp.hypothesis}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400"><Link to={nextPath(exp)} onClick={event => event.stopPropagation()}>{nextStep(exp)} →</Link></span>
                  <span className="text-xs text-slate-400">
                    {new Date(exp.created_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showCreateModal && (
        <CreateExperimentModal
          lang={lang}
          onClose={() => setShowCreateModal(false)}
          onCreated={(created) => {
            setShowCreateModal(false);
            navigate(`/experiments/${encodeURIComponent(created.id)}`);
          }}
        />
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { CreateExperimentModal } from './CreateExperimentModal';

interface ExperimentsProps {
  lang: 'en' | 'ko';
}

const translations = {
  en: {
    title: 'Experiments',
    description: 'Create and manage your A/B tests.',
    newExperiment: 'New Experiment',
    searchPlaceholder: 'Search experiments...',
    allStatus: 'All Status',
    statusRunning: 'Running',
    statusDraft: 'Draft',
    statusPaused: 'Paused',
    statusCompleted: 'Completed',
    statusArchived: 'Archived',
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
  },
  ko: {
    title: '실험 관리',
    description: 'A/B 테스트를 생성하고 관리하세요.',
    newExperiment: '새 실험 생성',
    searchPlaceholder: '실험 검색...',
    allStatus: '모든 상태',
    statusRunning: '실행 중',
    statusDraft: '초안',
    statusPaused: '일시정지',
    statusCompleted: '완료',
    statusArchived: '보관',
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

  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ExperimentStatus>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchExperiments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await experimentApi.list(statusFilter === 'all' ? undefined : statusFilter);
      setExperiments(data);
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExperiments();
  }, [statusFilter]);

  const handleDelete = async (id: string) => {
    if (!window.confirm(t.deleteConfirm)) return;
    try {
      await experimentApi.delete(id);
      setExperiments((prev) => prev.filter((e) => e.id !== id));
    } catch {
      // silent fail — 목록 새로고침으로 대응
      fetchExperiments();
    }
  };

  const filteredExperiments = experiments.filter((exp) =>
    exp.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{t.title}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{t.description}</p>
        </div>
        <Button className="gap-2 rounded-xl shadow-lg" size="lg" onClick={() => setShowCreateModal(true)}>
          <Plus size={18} />
          {t.newExperiment}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-12 rounded-xl bg-white dark:bg-slate-900"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-full sm:w-40 h-12 rounded-xl bg-white dark:bg-slate-900" aria-label={t.allStatus}>
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
        <p className="text-slate-500 dark:text-slate-400 text-sm">{t.loading}</p>
      ) : error ? (
        <p className="text-rose-500 text-sm">{error}</p>
      ) : filteredExperiments.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400 text-sm">{t.empty}</p>
      ) : (
        <>
          {/* 데스크탑 테이블 */}
          <Card className="hidden md:block rounded-2xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                <TableRow>
                  <TableHead className="font-bold text-slate-500">{t.colName}</TableHead>
                  <TableHead className="font-bold text-slate-500">{t.colStatus}</TableHead>
                  <TableHead className="font-bold text-slate-500">{t.colVariants}</TableHead>
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
                        {exp.name}
                      </p>
                      {exp.hypothesis && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">{exp.hypothesis}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${statusConfig[exp.status].color}`}>
                        {statusConfig[exp.status][lang]}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-300 font-medium">
                      {exp.variants.length}
                    </TableCell>
                    <TableCell className="text-slate-500 dark:text-slate-400 text-sm">
                      {new Date(exp.created_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US')}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
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
                className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 p-4 shadow-sm cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-bold text-slate-800 dark:text-slate-100 text-sm flex-1">{exp.name}</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${statusConfig[exp.status].color}`}>
                    {statusConfig[exp.status][lang]}
                  </span>
                </div>
                {exp.hypothesis && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-2">{exp.hypothesis}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{t.colVariants}: {exp.variants.length}</span>
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
          onCreated={() => {
            setShowCreateModal(false);
            fetchExperiments();
          }}
        />
      )}
    </div>
  );
};

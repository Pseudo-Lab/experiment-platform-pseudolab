import React, { useState } from 'react';
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
import { Plus, Search, MoreHorizontal, Play, Pause, Archive, Eye } from 'lucide-react';
import { Card } from '../../../components/ui/card';

interface ExperimentsProps {
  lang: 'en' | 'ko';
}

interface Experiment {
  id: string;
  name: string;
  hypothesis: string;
  status: 'running' | 'draft' | 'stopped' | 'completed';
  metric: string;
  traffic: number;
  variants: number;
  startDate: string;
  participants: number;
}

const experiments: Experiment[] = [
  {
    id: "exp-001",
    name: "Discord 온보딩 플로우 개선",
    hypothesis: "간소화된 온보딩 플로우가 가입 완료율을 높일 것이다",
    status: "running",
    metric: "가입 완료율",
    traffic: 50,
    variants: 2,
    startDate: "2024-12-25",
    participants: 1234,
  },
  {
    id: "exp-002",
    name: "알림 빈도 최적화",
    hypothesis: "적절한 알림 빈도가 일일 활성 사용자를 증가시킬 것이다",
    status: "running",
    metric: "DAU",
    traffic: 30,
    variants: 3,
    startDate: "2024-12-20",
    participants: 856,
  },
  {
    id: "exp-003",
    name: "채널 추천 알고리즘 v2",
    hypothesis: "개선된 추천 알고리즘이 채널 참여율을 높일 것이다",
    status: "completed",
    metric: "채널 참여율",
    traffic: 100,
    variants: 2,
    startDate: "2024-12-01",
    participants: 2100,
  },
  {
    id: "exp-004",
    name: "프로필 페이지 리디자인",
    hypothesis: "새로운 프로필 디자인이 프로필 조회수를 증가시킬 것이다",
    status: "draft",
    metric: "프로필 조회",
    traffic: 0,
    variants: 2,
    startDate: "-",
    participants: 0,
  },
  {
    id: "exp-005",
    name: "스터디 그룹 매칭 개선",
    hypothesis: "ML 기반 매칭이 그룹 유지율을 향상시킬 것이다",
    status: "stopped",
    metric: "그룹 유지율",
    traffic: 0,
    variants: 2,
    startDate: "2024-12-10",
    participants: 450,
  },
];

export const Experiments: React.FC<ExperimentsProps> = ({ lang }) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const translations = {
    en: {
      title: "Experiments",
      description: "Create and manage your A/B tests.",
      newExperiment: "New Experiment",
      searchPlaceholder: "Search experiments...",
      allStatus: "All Status",
      statusRunning: "Running",
      statusDraft: "Draft",
      statusCompleted: "Completed",
      statusStopped: "Stopped",
      colName: "Experiment Name",
      colStatus: "Status",
      colMetric: "Primary Metric",
      colTraffic: "Traffic",
      colParticipants: "Participants",
      colStartDate: "Start Date",
      actionView: "View Details",
      actionStop: "Stop Experiment",
      actionStart: "Start Experiment",
      actionArchive: "Archive",
    },
    ko: {
      title: "실험 관리",
      description: "A/B 테스트를 생성하고 관리하세요.",
      newExperiment: "새 실험 생성",
      searchPlaceholder: "실험 검색...",
      allStatus: "모든 상태",
      statusRunning: "실행 중",
      statusDraft: "초안",
      statusCompleted: "완료",
      statusStopped: "중지됨",
      colName: "실험명",
      colStatus: "상태",
      colMetric: "주요 메트릭",
      colTraffic: "트래픽",
      colParticipants: "참여자",
      colStartDate: "시작일",
      actionView: "상세 보기",
      actionStop: "실험 중지",
      actionStart: "실험 시작",
      actionArchive: "아카이브",
    }
  };

  const t = translations[lang];

  const statusConfig = {
    running: { label: t.statusRunning, color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" },
    draft: { label: t.statusDraft, color: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400" },
    stopped: { label: t.statusStopped, color: "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400" },
    completed: { label: t.statusCompleted, color: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
  };

  const filteredExperiments = experiments.filter((exp) => {
    const matchesSearch = exp.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || exp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{t.title}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{t.description}</p>
        </div>
        <Button className="gap-2 rounded-xl shadow-lg" size="lg">
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40 h-12 rounded-xl bg-white dark:bg-slate-900" aria-label={t.allStatus}>
            <SelectValue placeholder={t.allStatus} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allStatus}</SelectItem>
            <SelectItem value="running">{t.statusRunning}</SelectItem>
            <SelectItem value="draft">{t.statusDraft}</SelectItem>
            <SelectItem value="completed">{t.statusCompleted}</SelectItem>
            <SelectItem value="stopped">{t.statusStopped}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="rounded-2xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
            <TableRow>
              <TableHead className="font-bold text-slate-500">{t.colName}</TableHead>
              <TableHead className="font-bold text-slate-500">{t.colStatus}</TableHead>
              <TableHead className="font-bold text-slate-500">{t.colMetric}</TableHead>
              <TableHead className="font-bold text-slate-500">{t.colTraffic}</TableHead>
              <TableHead className="font-bold text-slate-500">{t.colParticipants}</TableHead>
              <TableHead className="font-bold text-slate-500">{t.colStartDate}</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredExperiments.map((experiment) => (
              <TableRow key={experiment.id} className="group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <TableCell>
                  <div className="block">
                    <p className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{experiment.name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                      {experiment.hypothesis}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${statusConfig[experiment.status].color}`}>
                    {statusConfig[experiment.status].label}
                  </span>
                </TableCell>
                <TableCell className="text-slate-600 dark:text-slate-300 font-medium">
                  {experiment.metric}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-16 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${experiment.traffic}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {experiment.traffic}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-slate-600 dark:text-slate-300 font-mono">
                  {experiment.participants.toLocaleString()}
                </TableCell>
                <TableCell className="text-slate-500 dark:text-slate-400 text-sm">
                  {experiment.startDate}
                </TableCell>
                <TableCell>
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
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem className="gap-2 cursor-pointer">
                        <Eye className="h-4 w-4 text-slate-400" />
                        <span className="font-medium">{t.actionView}</span>
                      </DropdownMenuItem>
                      {experiment.status === "running" ? (
                        <DropdownMenuItem className="gap-2 cursor-pointer text-amber-600 focus:text-amber-600">
                          <Pause className="h-4 w-4" />
                          <span className="font-medium">{t.actionStop}</span>
                        </DropdownMenuItem>
                      ) : experiment.status === "draft" ? (
                        <DropdownMenuItem className="gap-2 cursor-pointer text-emerald-600 focus:text-emerald-600">
                          <Play className="h-4 w-4" />
                          <span className="font-medium">{t.actionStart}</span>
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem className="gap-2 cursor-pointer text-rose-600 focus:text-rose-600">
                        <Archive className="h-4 w-4" />
                        <span className="font-medium">{t.actionArchive}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Plus, BarChart3, Clock, CheckCircle2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { experimentApi, Experiment } from '@/services/api';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface DashboardProps {
    lang: 'en' | 'ko';
}

export const Dashboard: React.FC<DashboardProps> = ({ lang }) => {
    const [experiments, setExperiments] = useState<Experiment[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const translations = {
        en: {
            welcome: "Welcome to ExperiBase",
            welcomeSub: "Here's the latest overview of your data valuation experiments.",
            newExperiment: "New Experiment",
            activeExps: "Active Experiments",
            lastWeek: "from last week",
            participants: "Total Participants",
            growth: "growth",
            winningRate: "Winning Rate",
            yesterday: "from yesterday",
            noData: "No recent experiment data",
            noDataSub: "Start a new experiment to see real-time data valuation metrics here.",
            statusActive: "Active",
            statusDraft: "Draft",
            statusCompleted: "Completed"
        },
        ko: {
            welcome: "실험플랫폼에 오신 것을 환영합니다",
            welcomeSub: "데이터 밸류에이션 실험의 최신 현황을 확인하세요.",
            newExperiment: "새 실험 생성",
            activeExps: "활성 실험",
            lastWeek: "지난주 대비",
            participants: "총 참여자 수",
            growth: "성장",
            winningRate: "승률",
            yesterday: "어제 대비",
            noData: "최근 실험 데이터가 없습니다",
            noDataSub: "실시간 데이터 가치 지표를 확인하려면 새로운 실험을 시작하세요.",
            statusActive: "활성",
            statusDraft: "초안",
            statusCompleted: "종료"
        }
    };

    const t = translations[lang];

    useEffect(() => {
        experimentApi.list()
            .then(data => {
                setExperiments(data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error(err);
                setIsLoading(false);
            });
    }, []);

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{t.welcome}</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">{t.welcomeSub}</p>
                </div>
                <Button className="gap-2 rounded-xl shadow-lg" size="lg">
                    <Plus size={18} />
                    {t.newExperiment}
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                    { label: t.activeExps, value: experiments.filter(e => e.status === 'active').length.toString(), change: `+2 ${t.lastWeek}`, trend: "up" },
                    { label: t.participants, value: "48.2k", change: `+12% ${t.growth}`, trend: "up" },
                    { label: t.winningRate, value: "64%", change: `-2% ${t.yesterday}`, trend: "down" }
                ].map((stat, i) => (
                    <Card key={i} className="hover:shadow-xl dark:hover:shadow-indigo-900/10 hover:-translate-y-1 transition-all group rounded-2xl">
                        <CardContent className="p-6">
                            <p className="text-sm font-bold text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors uppercase tracking-wider">{stat.label}</p>
                            <div className="flex items-end justify-between mt-3">
                                <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{stat.value}</p>
                                <p className={cn(
                                    "text-xs font-bold px-2 py-1 rounded-full",
                                    stat.trend === "up" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400"
                                )}>{stat.change}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-20">
                    <div role="progressbar" className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : experiments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {experiments.map((exp) => (
                        <Card key={exp.id} className="hover:shadow-lg transition-all rounded-2xl">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <Badge variant={exp.status === 'active' ? 'default' : exp.status === 'draft' ? 'outline' : 'secondary'} className={cn(
                                        "gap-1.5 px-2.5 py-0.5 rounded-full",
                                        exp.status === 'active' && "bg-emerald-50 text-emerald-600 hover:bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400",
                                        exp.status === 'draft' && "bg-amber-50 text-amber-600 hover:bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400",
                                        exp.status === 'completed' && "bg-slate-100 text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400"
                                    )}>
                                        {exp.status === 'active' ? <Clock size={12} /> : <CheckCircle2 size={12} />}
                                        {t[`status${exp.status.charAt(0).toUpperCase() + exp.status.slice(1)}` as keyof typeof t]}
                                    </Badge>
                                    <span className="text-xs text-slate-400">{new Date(exp.created_at).toLocaleDateString()}</span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{exp.name}</h3>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="p-8 border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center text-center py-20">
                    <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm flex items-center justify-center mb-4">
                        <BarChart3 className="text-indigo-600 dark:text-indigo-400" size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t.noData}</h3>
                    <p className="text-slate-500 dark:text-slate-400 max-w-xs mt-2">{t.noDataSub}</p>
                </div>
            )}
        </div>
    );
};

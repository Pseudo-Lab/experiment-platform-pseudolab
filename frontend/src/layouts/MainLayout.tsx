import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    ChevronRight,
    ChevronLeft,
    LayoutDashboard,
    FlaskConical,
    GitBranch,
    MessageSquare,
    Bug,
    Settings,
    Menu,
    Bell,
    User,
    Sun,
    Moon,
    Globe,
    ToggleLeft,
    BarChart2,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Button } from '../components/ui/button';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface SidebarItemProps {
    icon: any;
    label: string;
    active?: boolean;
    expanded?: boolean;
    onClick: () => void;
}

const SidebarItem = ({
    icon: Icon,
    label,
    active = false,
    expanded = true,
    onClick
}: SidebarItemProps) => (
    <button
        onClick={onClick}
        className={cn(
            "flex items-center w-full gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-200 rounded-lg group relative",
            active
                ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
        )}
    >
        <Icon size={20} className="shrink-0" />
        <span className={cn(
            "flex-1 text-left whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out",
            expanded ? "opacity-100 max-w-[200px] ml-0" : "opacity-0 max-w-0 -ml-4"
        )}>
            {label}
        </span>
        {active && expanded && <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />}
    </button>
);

interface MainLayoutProps {
    children: React.ReactNode;
    lang: 'en' | 'ko';
    setLang: (lang: 'en' | 'ko') => void;
    theme: 'light' | 'dark';
    setTheme: (theme: 'light' | 'dark') => void;
    backendStatus: string;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
    children,
    lang,
    setLang,
    theme,
    setTheme,
    backendStatus
}) => {
    const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const location = useLocation();
    const navigate = useNavigate();

    const activePath = location.pathname;

    const handleNav = (path: string) => {
        navigate(path);
        if (window.innerWidth < 1024) setSidebarOpen(false);
    };

    const translations = {
        en: { dashboard: "Overview", experiments: "Experiments", githubMetrics: "GitHub Activity", discordMetrics: "Discord Activity", bugReport: "Bugs & Requests", featureFlags: "Feature Flags", analytics: "Analytics", settings: "Settings" },
        ko: { dashboard: "개요", experiments: "실험 관리", githubMetrics: "GitHub 활동 분석", discordMetrics: "Discord 활동 분석", bugReport: "버그 & 기능 요청", featureFlags: "Feature Flags", analytics: "Analytics", settings: "설정" }
    };

    const t = translations[lang];

    const minSwipeDistance = 50;
    const edgeSwipeZone = 48;

    const currentSectionLabel =
        activePath === '/dashboard' ? t.dashboard :
        activePath === '/experiments' ? t.experiments :
        activePath === '/metrics/github' ? t.githubMetrics :
        activePath === '/metrics/discord' ? t.discordMetrics :
        activePath === '/bug-report' ? t.bugReport :
        activePath === '/feature-flags' ? t.featureFlags :
        activePath === '/analytics' ? t.analytics :
        t.dashboard;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        const startX = e.targetTouches[0].clientX;

        // 모바일에서 사이드바가 닫힌 상태일 때는 왼쪽 엣지 영역에서 시작한 스와이프만 열기 허용
        if (window.innerWidth < 1024 && !isSidebarOpen && startX > edgeSwipeZone) {
            setTouchStart(null);
            return;
        }

        setTouchStart(startX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isRightSwipe && window.innerWidth < 1024) {
            setSidebarOpen(true);
        }
        if (isLeftSwipe && window.innerWidth < 1024) {
            setSidebarOpen(false);
        }
    };

    return (
        <div 
            className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 flex flex-col bg-white dark:bg-slate-900 border-r dark:border-slate-800 transition-all duration-300 ease-in-out shadow-lg lg:shadow-none",
                    isSidebarOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full lg:w-20 lg:translate-x-0"
                )}
            >
                {/* Desktop Sidebar Toggle (Floating on border) */}
                <button 
                    onClick={() => setSidebarOpen(!isSidebarOpen)} 
                    className="hidden lg:flex absolute -right-3 top-5 z-50 items-center justify-center w-6 h-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm transition-all hover:scale-110"
                    aria-label="Toggle sidebar"
                >
                    {isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                </button>

                <div className="flex items-center justify-between h-16 px-4 lg:px-6 border-b dark:border-slate-800">
                    <div className="flex items-center">
                        <div className="bg-indigo-600 p-1.5 rounded-lg shrink-0 shadow-md shadow-indigo-200 dark:shadow-none">
                            <FlaskConical className="text-white" size={20} />
                        </div>
                        <div className={cn("ml-3 flex flex-col transition-all duration-300 overflow-hidden", isSidebarOpen ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0")}>
                            <span className="text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100 whitespace-nowrap">ExperiBase</span>
                            <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded-md w-fit uppercase whitespace-nowrap", backendStatus === 'Online' ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400")}>
                                {backendStatus}
                            </span>
                        </div>
                    </div>
                    {/* Mobile Close Button */}
                    <button 
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors"
                        aria-label="Close sidebar menu"
                    >
                        <ChevronLeft size={24} />
                    </button>
                </div>

                <nav className="flex-1 px-3 py-6 space-y-2">
                    <SidebarItem icon={LayoutDashboard} label={t.dashboard} active={activePath === '/dashboard'} expanded={isSidebarOpen} onClick={() => handleNav('/dashboard')} />
                    <SidebarItem icon={FlaskConical} label={t.experiments} active={activePath === '/experiments'} expanded={isSidebarOpen} onClick={() => handleNav('/experiments')} />
                    <SidebarItem icon={GitBranch} label={t.githubMetrics} active={activePath === '/metrics/github'} expanded={isSidebarOpen} onClick={() => handleNav('/metrics/github')} />
                    <SidebarItem icon={MessageSquare} label={t.discordMetrics} active={activePath === '/metrics/discord'} expanded={isSidebarOpen} onClick={() => handleNav('/metrics/discord')} />
                    <SidebarItem icon={Bug} label={t.bugReport} active={activePath === '/bug-report'} expanded={isSidebarOpen} onClick={() => handleNav('/bug-report')} />
                    <SidebarItem icon={ToggleLeft} label={t.featureFlags} active={activePath === '/feature-flags'} expanded={isSidebarOpen} onClick={() => handleNav('/feature-flags')} />
                    <SidebarItem icon={BarChart2} label={t.analytics} active={activePath === '/analytics'} expanded={isSidebarOpen} onClick={() => handleNav('/analytics')} />
                </nav>

                <div className="p-3 mt-auto border-t dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <SidebarItem icon={Settings} label={t.settings} expanded={isSidebarOpen} onClick={() => { }} />
                </div>
            </aside>

            {isSidebarOpen && <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

            <main className={cn("flex-1 flex flex-col min-w-0 min-h-screen transition-all duration-300", isSidebarOpen ? "lg:pl-64" : "lg:pl-20")}>
                <header className="flex items-center justify-between h-16 px-4 md:px-8 border-b dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!isSidebarOpen)} className="lg:hidden rounded-lg text-slate-500" aria-label="Open sidebar menu">
                            <Menu size={20} />
                        </Button>
                        <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300 hidden sm:block">
                            {currentSectionLabel}
                        </h2>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">

                        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="text-slate-500 rounded-lg" aria-label="Toggle theme">
                            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                        </Button>

                        <Button variant="outline" size="sm" onClick={() => setLang(lang === 'en' ? 'ko' : 'en')} className="gap-1 font-bold text-slate-500 rounded-lg" aria-label="Toggle language">
                            <Globe size={14} /> {lang.toUpperCase()}
                        </Button>

                        <Button variant="ghost" size="icon" className="relative text-slate-500 rounded-lg">
                            <Bell size={20} />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                        </Button>
                        <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white cursor-pointer shadow-md hover:scale-105 transition-transform">
                            <User size={18} />
                        </div>
                    </div>
                </header>
                <div className="flex-1 p-4 md:p-8 overflow-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};

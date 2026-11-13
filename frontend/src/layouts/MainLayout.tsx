import { IterglowLogo } from '../components/IterglowLogo';
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    ChevronRight,
    ChevronLeft,
    ChevronDown,
    FlaskConical,
    Info,
    BookOpen,
    Bug,
    Menu,
    Globe,
    User,
    LogOut,
    ToggleLeft,
    Code2,
    FolderOpen,
    Key,
    Plug,
    Flag,
    Plus,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Button } from '../components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuItem, DropdownMenuLabel } from '../components/ui/dropdown-menu';
import { useProject } from '../contexts/ProjectContext';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface SidebarItemProps {
    icon: any;
    label: string;
    active?: boolean;
    expanded?: boolean;
    secondary?: boolean;
    onClick: () => void;
}

const SidebarItem = ({
    icon: Icon,
    label,
    active = false,
    expanded = true,
    secondary = false,
    onClick
}: SidebarItemProps) => (
    <button
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        title={!expanded ? label : undefined}
        className={cn(
            "flex items-center w-full gap-3 px-3 rounded-lg group relative transition-all duration-200",
            secondary ? "py-1.5 text-xs font-medium" : "py-2.5 text-sm font-medium",
            active
                ? "bg-card text-foreground shadow-sm"
                : secondary
                  ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
    >
        <Icon size={secondary ? 17 : 20} className="shrink-0" />
        <span className={cn(
            "flex-1 text-left whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out",
            expanded ? "opacity-100 max-w-[200px] ml-0" : "opacity-0 max-w-0 -ml-4"
        )}>
            {label}
        </span>
        {active && expanded && <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-primary" />}
    </button>
);

const SectionDivider = ({ label, expanded }: { label: string; expanded: boolean }) => (
    <div className={cn("flex items-center gap-2 px-2 pb-1", expanded ? "pt-5" : "pt-4")}>
        {expanded ? (
            <>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap shrink-0">
                    {label}
                </span>
                <div className="flex-1 h-px bg-border" />
            </>
        ) : (
            <div className="w-full h-px bg-border" />
        )}
    </div>
);

interface MainLayoutProps {
    children: React.ReactNode;
    lang: 'en' | 'ko';
    setLang: (lang: 'en' | 'ko') => void;
    theme?: 'light' | 'dark';
    setTheme?: (theme: 'light' | 'dark') => void;
    backendStatus: string;
    userLabel?: string;
    userEmail?: string | null;
    accountId?: string | null;
    isAdmin?: boolean;
    onLogout?: () => void | Promise<void>;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
    children,
    lang,
    setLang,
    userLabel,
    userEmail,
    accountId,
    isAdmin = true,
    onLogout
}) => {
    const [logoutFailed, setLogoutFailed] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    const location = useLocation();
    const navigate = useNavigate();
    const { projects, currentProjectId, setCurrentProjectId, loading } = useProject();
    const selectedProject = projects.find(project => project.id === currentProjectId);

    const activePath = location.pathname;
    const isCommunity = activePath.startsWith("/metrics");

    const handleNav = (path: string) => {
        navigate(path);
        if (window.innerWidth < 1024) setSidebarOpen(false);
    };

    const translations = {
        en: { experiments: "Experiments", githubMetrics: "GitHub Activity", discordMetrics: "Discord Activity", bugReport: "Bugs & suggestions", featureFlags: "Feature Flags", projects: "Project management", apiKey: "SDK Integration", example: "Example App", settings: "Settings", placements: "Placements", sectionOther: "Analytics & Other", sectionProjectTools: "Project Tools", sectionNoProject: "Select a Project", allProjects: "All Projects", selectProject: "Select a project", noProjectHint: "Select a project above to see more menu items", newProject: "New Project", logout: "Logout" },
        ko: { experiments: "실험 관리", githubMetrics: "GitHub 활동 분석", discordMetrics: "Discord 활동 분석", bugReport: "버그·건의", featureFlags: "Feature Flags", projects: "프로젝트 관리", apiKey: "SDK 연동", example: "예제 앱", settings: "설정", placements: "Placements", sectionOther: "분석 / 기타", sectionProjectTools: "프로젝트 도구", sectionNoProject: "프로젝트를 선택하세요", allProjects: "전체 프로젝트", selectProject: "프로젝트를 선택하세요", noProjectHint: "프로젝트를 선택하면 더 많은 메뉴가 표시됩니다", newProject: "새 프로젝트", logout: "로그아웃" }
    };

    const t = translations[lang];
    const accountCopy = lang === 'ko'
        ? { menu: '계정 메뉴', account: '계정', signedIn: '로그인 계정', id: '계정 ID', pending: '로그아웃 중...', failed: '로그아웃하지 못했습니다. 다시 시도해 주세요.' }
        : { menu: 'Account menu', account: 'Account', signedIn: 'Signed in as', id: 'Account ID', pending: 'Signing out...', failed: 'Sign out failed. Please try again.' };

    const minSwipeDistance = 50;
    const edgeSwipeZone = 48;

    const currentSectionLabel =
        activePath.startsWith('/experiments') ? t.experiments :
        activePath === '/metrics/github' ? t.githubMetrics :
        activePath === '/metrics/discord' ? t.discordMetrics :
        activePath === '/bug-report' ? t.bugReport :
        activePath === '/feature-flags' ? t.featureFlags :
        activePath === '/placements' ? t.placements :
        activePath === '/projects' ? t.projects :
        activePath === '/api-key' ? t.apiKey :
        activePath.startsWith('/example') ? t.example :
        t.experiments;

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
            className="flex min-h-screen bg-background text-foreground font-sans transition-colors duration-300"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r border-border transition-all duration-300 ease-in-out shadow-lg lg:shadow-none",
                    isSidebarOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full lg:w-20 lg:translate-x-0"
                )}
            >
                {/* Desktop Sidebar Toggle (Floating on border) */}
                <button 
                    onClick={() => setSidebarOpen(!isSidebarOpen)} 
                    className="hidden lg:flex absolute -right-3 top-5 z-50 items-center justify-center w-6 h-6 bg-card border border-border rounded-full text-muted-foreground hover:text-foreground shadow-sm transition-all hover:scale-110"
                    aria-label="Toggle sidebar"
                >
                    {isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                </button>

                <div className="flex items-center justify-between h-16 px-4 lg:px-6 border-b dark:border-slate-800">
                    <div className="flex flex-col gap-1">
                        <Link to="/projects" onClick={() => { if (window.innerWidth < 1024) setSidebarOpen(false); }} aria-label={lang === 'ko' ? 'Iterglow 홈' : 'Iterglow home'} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <IterglowLogo lang={lang} compact={!isSidebarOpen} />
                        </Link>
                    </div>
                    {/* Mobile Close Button */}
                    <button 
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-2 -mr-2 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                        aria-label="Close sidebar menu"
                    >
                        <ChevronLeft size={24} />
                    </button>
                </div>

                {!isCommunity && (
                    <section aria-label={t.projects} className="px-3 pt-4">
                        {isSidebarOpen ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="h-auto w-full justify-start gap-3 bg-background p-3 text-left" aria-label={t.selectProject}>
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                                            <FolderOpen size={18} />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate font-semibold">{selectedProject?.name || currentProjectId || t.allProjects}</span>
                                            <span className="block truncate text-xs font-normal text-muted-foreground">{lang === 'ko' ? '프로젝트 전환' : 'Switch project'}</span>
                                        </span>
                                        <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-60 max-w-[calc(100vw-2rem)]">
                                    <DropdownMenuRadioGroup value={currentProjectId ?? '__all__'} onValueChange={value => {
                                        setCurrentProjectId(value === '__all__' ? null : value);
                                        if (activePath.startsWith('/experiments/')) handleNav('/experiments');
                                        else if (window.innerWidth < 1024) setSidebarOpen(false);
                                    }} className="max-h-64 overflow-y-auto">
                                        <DropdownMenuRadioItem value="__all__">{t.allProjects}</DropdownMenuRadioItem>
                                        {loading && <DropdownMenuItem disabled>{lang === 'ko' ? '불러오는 중...' : 'Loading...'}</DropdownMenuItem>}
                                        {projects.map(project => <DropdownMenuRadioItem key={project.id} value={project.id}><span className="truncate">{project.name}</span></DropdownMenuRadioItem>)}
                                    </DropdownMenuRadioGroup>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="gap-2" onSelect={() => handleNav('/projects')}>
                                        <FolderOpen size={15} />{t.projects}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="gap-2" onSelect={() => handleNav('/projects?create=1')}>
                                        <Plus size={15} />{t.newProject}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <Button variant="ghost" size="icon" className="w-full" aria-label={t.selectProject} title={t.selectProject} onClick={() => setSidebarOpen(true)}>
                                <FolderOpen size={20} />
                            </Button>
                        )}
                    </section>
                )}

                <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
                    <SectionDivider label={lang === 'ko' ? '실험 플랫폼' : 'Experiment platform'} expanded={isSidebarOpen} />
                    <SidebarItem icon={FlaskConical} label={t.experiments} active={activePath.startsWith('/experiments')} expanded={isSidebarOpen} onClick={() => handleNav('/experiments')} />
                    <SidebarItem icon={Plug} label={t.apiKey} active={activePath === '/api-key'} expanded={isSidebarOpen} onClick={() => handleNav('/api-key')} />
                    <SidebarItem icon={Flag} label={t.featureFlags} active={activePath === '/feature-flags'} expanded={isSidebarOpen} onClick={() => handleNav('/feature-flags')} />
                </nav>

                <div className="px-3 pb-3 pt-2 mt-auto border-t dark:border-slate-800 bg-muted/40 space-y-1">
                    <SidebarItem icon={Bug} label={t.bugReport} active={activePath.startsWith('/bug-report')} expanded={isSidebarOpen} onClick={() => handleNav('/bug-report')} secondary />
                    <Button asChild variant="ghost" className="w-full justify-start gap-3 px-3 text-muted-foreground" title={lang === 'ko' ? 'SDK 가이드' : 'SDK guide'}>
                        <Link to="/docs/sdk" state={{ from: location }} aria-label={lang === 'ko' ? 'SDK 가이드' : 'SDK guide'}>
                            <BookOpen aria-hidden="true" className="shrink-0" />
                            {isSidebarOpen && <span>{lang === 'ko' ? 'SDK 가이드' : 'SDK guide'}</span>}
                        </Link>
                    </Button>
                    <Button asChild variant="ghost" className="w-full justify-start gap-3 px-3 text-muted-foreground" title={lang === 'ko' ? '서비스 소개' : 'About Iterglow'}>
                        <Link to="/" aria-label={lang === 'ko' ? '서비스 소개' : 'About Iterglow'}>
                            <Info aria-hidden="true" className="shrink-0" />
                            {isSidebarOpen && <span>{lang === 'ko' ? '서비스 소개' : 'About Iterglow'}</span>}
                        </Link>
                    </Button>
                    {isAdmin && currentProjectId === 'demo-app' && (
                        <SidebarItem icon={Code2} label={t.example} active={activePath.startsWith('/example')} expanded={isSidebarOpen} onClick={() => handleNav('/example')} secondary />
                    )}
                </div>
            </aside>

            {isSidebarOpen && <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

            <main className={cn("flex-1 flex flex-col min-w-0 min-h-screen transition-all duration-300", isSidebarOpen ? "lg:pl-64" : "lg:pl-20")}>
                <header className="flex items-center justify-between h-16 px-4 md:px-8 border-b dark:border-slate-800 bg-card sticky top-0 z-30">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!isSidebarOpen)} className="lg:hidden rounded-lg text-muted-foreground" aria-label="Open sidebar menu">
                            <Menu size={20} />
                        </Button>
                        <h2 className="text-sm font-semibold text-muted-foreground hidden sm:block">
                            {currentSectionLabel}
                        </h2>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                        <Button variant="outline" size="sm" onClick={() => setLang(lang === 'en' ? 'ko' : 'en')} className="gap-1 font-bold text-muted-foreground rounded-lg" aria-label="Toggle language">
                            <Globe size={14} /> {lang.toUpperCase()}
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="min-h-11 gap-2 rounded-lg text-muted-foreground" aria-label={accountCopy.menu}>
                                    <User size={18} aria-hidden="true" />
                                    <span className="md:hidden">{accountCopy.account}</span>
                                    <span className="hidden max-w-[160px] truncate md:inline">{userLabel || accountCopy.account}</span>
                                    <ChevronDown size={14} aria-hidden="true" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-2rem)]">
                                <DropdownMenuLabel className="font-normal">
                                    <p className="text-xs text-muted-foreground">{accountCopy.signedIn}</p>
                                    <p className="mt-1 break-all text-sm font-medium">{userLabel || accountCopy.account}</p>
                                    {userEmail && userEmail !== userLabel && <p className="mt-1 break-all text-sm text-muted-foreground">{userEmail}</p>}
                                    {!userEmail && accountId && <p className="mt-2 break-all text-xs text-muted-foreground">{accountCopy.id}: {accountId}</p>}
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="min-h-11 gap-2"
                                    disabled={loggingOut || !onLogout}
                                    onSelect={async (event) => {
                                        event.preventDefault();
                                        setLogoutFailed(false);
                                        setLoggingOut(true);
                                        try { await onLogout?.(); } catch { setLogoutFailed(true); }
                                        finally { setLoggingOut(false); }
                                    }}
                                >
                                    <LogOut size={16} aria-hidden="true" />
                                    {loggingOut ? accountCopy.pending : t.logout}
                                </DropdownMenuItem>
                                {logoutFailed && <p role="alert" className="px-2 py-2 text-sm text-destructive">{accountCopy.failed}</p>}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>
                <div className="flex-1 p-4 md:p-8 overflow-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};

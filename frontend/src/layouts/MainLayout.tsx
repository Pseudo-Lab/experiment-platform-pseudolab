import { ProjectInvitationInbox } from '../features/dashboard/components/ProjectInvitationInbox';
import { IterglowLogo } from '../components/IterglowLogo';
import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
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
    Settings,
    ExternalLink,
    ChevronsUpDown,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Button } from '../components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuItem, DropdownMenuLabel } from '../components/ui/dropdown-menu';
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
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">
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
    const { projects, currentProjectId, currentProject, setCurrentProjectId, loading, error, reloadProjects } = useProject();
    const projectListRef = useRef<HTMLDivElement>(null);
    const [projectListOverflows, setProjectListOverflows] = useState(false);
    const projectShortcuts = projects.slice(0, 5);
    if (currentProject && !projectShortcuts.some(project => project.id === currentProject.id)) {
        projectShortcuts.splice(4, 1, currentProject);
    }

    const activePath = location.pathname.replace(/\/+$/, '') || '/';
    const isCommunity = activePath.startsWith("/metrics");
    const isProjectManagement = activePath === '/projects';
    const isWorkspaceList = ['/experiments', '/api-key', '/feature-flags', '/placements', '/project-settings'].includes(activePath);
    const isWorkspace = isWorkspaceList || activePath.startsWith('/experiments/') || activePath.startsWith('/example');

    useEffect(() => {
        const list = projectListRef.current;
        if (!list) { setProjectListOverflows(false); return; }
        const update = () => {
            setProjectListOverflows(list.scrollHeight > list.clientHeight + 1);
            if (isProjectManagement) return;
            const active = list.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
            if (!active) return;
            const bounds = list.getBoundingClientRect();
            const row = active.getBoundingClientRect();
            if (row.top < bounds.top + 4) list.scrollTop += row.top - bounds.top - 4;
            else if (row.bottom > bounds.bottom - 4) list.scrollTop += row.bottom - bounds.bottom + 4;
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, [currentProjectId, projects, isSidebarOpen, isProjectManagement, isCommunity, loading, error, currentProject?.access_role, isAdmin]);


    const handleNav = (path: string) => {
        navigate(path);
        if (window.innerWidth < 1024) setSidebarOpen(false);
    };

    const translations = {
        en: { experiments: "Experiments", githubMetrics: "GitHub Activity", discordMetrics: "Discord Activity", bugReport: "Bugs & suggestions", featureFlags: "Feature Flags", projects: "Project list", projectSettings: "Settings & members", apiKey: "SDK Integration", example: "Example App", settings: "Settings", placements: "Placements", sectionOther: "Analytics & Other", sectionProjectTools: "Project Tools", sectionNoProject: "Select a Project", allProjects: "All Projects", selectProject: "Select a project", noProjectHint: "Select a project above to see more menu items", newProject: "New Project", logout: "Logout" },
        ko: { experiments: "실험 관리", githubMetrics: "GitHub 활동 분석", discordMetrics: "Discord 활동 분석", bugReport: "버그·건의", featureFlags: "Feature Flags", projects: "프로젝트 목록", projectSettings: "설정·멤버", apiKey: "SDK 연동", example: "예제 앱", settings: "설정", placements: "Placements", sectionOther: "분석 / 기타", sectionProjectTools: "프로젝트 도구", sectionNoProject: "프로젝트를 선택하세요", allProjects: "전체 프로젝트", selectProject: "프로젝트를 선택하세요", noProjectHint: "프로젝트를 선택하면 더 많은 메뉴가 표시됩니다", newProject: "새 프로젝트", logout: "로그아웃" }
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
        activePath === '/project-settings' ? t.projectSettings :
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

                <div className="flex shrink-0 items-center justify-between h-16 px-4 lg:px-6 border-b dark:border-slate-800">
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

                <nav aria-label={lang === 'ko' ? '프로젝트 탐색' : 'Project navigation'} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-4">
                    {!isCommunity && (
                        <section aria-label={t.projects} className="flex min-h-0 shrink flex-col pt-4">
                            <div className={cn('flex shrink-0 gap-1', !isSidebarOpen && 'flex-col')}>
                                <SidebarItem icon={FolderOpen} label={t.projects} active={isProjectManagement} expanded={isSidebarOpen} onClick={() => handleNav('/projects')} />
                                <Button variant="ghost" size="icon" className="min-h-11 min-w-11 shrink-0 text-muted-foreground" aria-label={t.newProject} title={t.newProject} onClick={() => handleNav('/projects?create=1')}>
                                    <Plus size={18} />
                                </Button>
                            </div>
                            {isSidebarOpen && (
                                <div className="mt-2 flex min-h-0 flex-col">
                                    <div ref={projectListRef} role="group" aria-label={lang === 'ko' ? '프로젝트 빠른 전환' : 'Quick project switch'} className="project-shortcut-scroll -mx-1 min-h-14 max-h-32 scroll-py-1 space-y-1 overflow-y-auto overscroll-contain border-y border-border/60 bg-muted/20 p-1">
                                    {loading ? <p role="status" className="px-3 py-2 text-xs text-muted-foreground">{lang === 'ko' ? '불러오는 중...' : 'Loading...'}</p> : error ? (
                                        <Button variant="ghost" className="h-auto w-full justify-start whitespace-normal text-left text-xs" onClick={() => void reloadProjects()}>{lang === 'ko' ? '프로젝트 다시 불러오기' : 'Retry loading projects'}</Button>
                                    ) : projectShortcuts.map(project => (
                                        <button key={project.id} type="button" aria-label={project.name} title={project.name}
                                            aria-pressed={!isProjectManagement && currentProjectId === project.id}
                                            className={cn('flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring', !isProjectManagement && currentProjectId === project.id ? 'bg-accent font-semibold text-accent-foreground' : 'text-muted-foreground')}
                                            onClick={() => {
                                                if (project.id === currentProjectId && isWorkspace) {
                                                    if (window.innerWidth < 1024) setSidebarOpen(false);
                                                    return;
                                                }
                                                setCurrentProjectId(project.id);
                                                const retainTool = ['/experiments', '/feature-flags', '/api-key', '/project-settings'].includes(activePath)
                                                    && !(activePath === '/api-key' && project.access_role === 'viewer')
                                                    && !(activePath === '/project-settings' && (project.access_role || 'owner') !== 'owner');
                                                if (!retainTool) handleNav('/experiments');
                                                else if (window.innerWidth < 1024) setSidebarOpen(false);
                                            }}>
                                            <FolderOpen size={14} aria-hidden="true" className="shrink-0" />
                                            <span className="truncate">{project.name}</span>
                                        </button>
                                    ))}
                                    </div>
                                    {!loading && !error && projects.length > 0 && (
                                        <div className="flex h-9 shrink-0 items-center justify-between gap-1">
                                            <span className="flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground">
                                                {projectListOverflows && <><ChevronsUpDown size={12} aria-hidden="true" />{lang === 'ko' ? '스크롤' : 'Scroll'}</>}
                                            </span>
                                            <Button variant="ghost" size="sm" className="h-8 gap-1 px-1 text-xs text-foreground" onClick={() => handleNav('/projects')}>
                                                {lang === 'ko' ? `전체 ${projects.length}개 보기` : `View all ${projects.length}`}
                                                <ChevronRight size={13} aria-hidden="true" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    )}
                    {!isProjectManagement && !isCommunity && currentProject && !error && !loading ? (
                        <section aria-label={lang === 'ko' ? '현재 프로젝트 도구' : 'Current project tools'} className="shrink-0">
                            <SectionDivider label={currentProject.name} expanded={isSidebarOpen} />
                            <SidebarItem icon={FlaskConical} label={t.experiments} active={activePath.startsWith('/experiments')} expanded={isSidebarOpen} onClick={() => handleNav('/experiments')} />
                            {currentProject.access_role !== 'viewer' && <SidebarItem icon={Plug} label={t.apiKey} active={activePath === '/api-key'} expanded={isSidebarOpen} onClick={() => handleNav('/api-key')} />}
                            <SidebarItem icon={Flag} label={t.featureFlags} active={activePath === '/feature-flags'} expanded={isSidebarOpen} onClick={() => handleNav('/feature-flags')} />
                            {(currentProject.access_role || 'owner') === 'owner' && <SidebarItem icon={Settings} label={t.projectSettings} active={activePath === '/project-settings'} expanded={isSidebarOpen} onClick={() => handleNav('/project-settings')} />}
                        </section>
                    ) : isSidebarOpen && !isCommunity && !loading && !error && (
                        <p className="px-3 pt-5 text-xs leading-relaxed text-muted-foreground">{lang === 'ko' ? '프로젝트를 선택하면 실험과 도구가 표시됩니다.' : 'Choose a project to open its experiments and tools.'}</p>
                    )}
                </nav>

                <div className="shrink-0 px-3 pb-3 pt-2 mt-auto border-t dark:border-slate-800 bg-muted/40 space-y-1">
                    <SidebarItem icon={Bug} label={t.bugReport} active={activePath.startsWith('/bug-report')} expanded={isSidebarOpen} onClick={() => handleNav('/bug-report')} secondary />
                    <Button asChild variant="ghost" className="w-full justify-start gap-3 px-3 text-muted-foreground" title={lang === 'ko' ? 'SDK 가이드 (새 탭)' : 'SDK guide (new tab)'}>
                        <Link to="/docs/sdk" target="_blank" rel="noopener noreferrer" aria-describedby="sidebar-new-tab-hint" aria-label={lang === 'ko' ? 'SDK 가이드' : 'SDK guide'}>
                            <BookOpen aria-hidden="true" className="shrink-0" />
                            {isSidebarOpen && <><span>{lang === 'ko' ? 'SDK 가이드' : 'SDK guide'}</span><ExternalLink size={13} aria-hidden="true" className="ml-auto shrink-0" /></>}
                        </Link>
                    </Button>
                    <Button asChild variant="ghost" className="w-full justify-start gap-3 px-3 text-muted-foreground" title={lang === 'ko' ? '서비스 소개 (새 탭)' : 'About Iterglow (new tab)'}>
                        <Link to="/" target="_blank" rel="noopener noreferrer" aria-describedby="sidebar-new-tab-hint" aria-label={lang === 'ko' ? '서비스 소개' : 'About Iterglow'}>
                            <Info aria-hidden="true" className="shrink-0" />
                            {isSidebarOpen && <><span>{lang === 'ko' ? '서비스 소개' : 'About Iterglow'}</span><ExternalLink size={13} aria-hidden="true" className="ml-auto shrink-0" /></>}
                        </Link>
                    </Button>
                    <span id="sidebar-new-tab-hint" className="sr-only">{lang === 'ko' ? '새 탭에서 열립니다.' : 'Opens in a new tab.'}</span>
                    {isAdmin && currentProject?.id === 'demo-app' && (
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
                    {accountId && <ProjectInvitationInbox key={accountId} lang={lang} />}
                    {isWorkspace && loading && !(activePath === '/project-settings' && currentProject) ? (
                        <p role="status" className="text-sm text-muted-foreground">{lang === 'ko' ? '프로젝트를 불러오는 중...' : 'Loading projects...'}</p>
                    ) : isWorkspace && error ? (
                        <div role="alert" className="space-y-3">
                            <p>{lang === 'ko' ? '프로젝트를 불러오지 못했습니다.' : 'Could not load projects.'}</p>
                            <Button variant="outline" onClick={() => void reloadProjects()}>{lang === 'ko' ? '다시 시도' : 'Retry'}</Button>
                        </div>
                    ) : (isWorkspaceList && !currentProject) || (activePath.startsWith('/example') && currentProject?.id !== 'demo-app') ? (
                        <Navigate to="/projects" replace />
                    ) : (
                        <React.Fragment key={isWorkspaceList ? currentProjectId : 'page'}>{children}</React.Fragment>
                    )}
                </div>
            </main>
        </div>
    );
};

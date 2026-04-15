import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronRight, Paperclip, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Badge } from '../../../components/ui/badge';
import { Card } from '../../../components/ui/card';
import { bugReportApi, type BugReport as BugReportType, type BugCategory, type BugSeverity, type BugStatus, type Attachment } from '../../../services/api';

interface BugReportProps {
    lang: 'en' | 'ko';
}

const translations = {
    en: {
        issueList: "Bugs & Requests", newIssue: "New Report", issueId: "ID", issueTitle: "Issue Title",
        issueDate: "Date", issueStatus: "Status", issueSeverity: "Severity",
        statusReported: "Open", statusInProgress: "In Progress", statusResolved: "Resolved",
        sevMinor: "Minor", sevMajor: "Major", sevCritical: "Critical",
        title: "Title", category: "Category", severity: "Severity", description: "Description", submit: "Submit",
        placeholderTitle: "Short description", placeholderDesc: "What happened?",
        catUI: "UI/UX", catFunc: "Functional", catPerf: "Performance", catFeature: "Feature Request", catOther: "Other",
        pasteImage: "Paste, drag & drop, or click to upload", attachments: "Attachments",
        loading: "Loading...", error: "Failed to load reports.", submitting: "Submitting...",
        uploadingFile: "Uploading...", noReports: "No reports yet.",
    },
    ko: {
        issueList: "버그 & 기능 요청", newIssue: "제보/요청하기", issueId: "번호", issueTitle: "이슈 제목",
        issueDate: "등록일", issueStatus: "상태", issueSeverity: "심각도",
        statusReported: "Open", statusInProgress: "In Progress", statusResolved: "Resolved",
        sevMinor: "Minor", sevMajor: "Major", sevCritical: "Critical",
        title: "제목", category: "유형", severity: "심각도", description: "상세 내용", submit: "제출하기",
        placeholderTitle: "문제에 대한 짧은 설명", placeholderDesc: "발생한 상황에 대해 자세히 알려주세요...",
        catUI: "UI/UX 디자인", catFunc: "기능 오류", catPerf: "성능 이슈", catFeature: "기능 요청", catOther: "기타",
        pasteImage: "붙여넣기 · 드래그 앤 드롭 · 클릭하여 업로드", attachments: "첨부 파일",
        loading: "불러오는 중...", error: "목록을 불러오지 못했습니다.", submitting: "제출 중...",
        uploadingFile: "업로드 중...", noReports: "등록된 이슈가 없습니다.",
    }
};

const STATUS_BADGE: Record<BugStatus, 'destructive' | 'secondary' | 'outline'> = {
    reported: 'destructive',
    in_progress: 'secondary',
    resolved: 'outline',
};

const SEVERITY_COLOR: Record<BugSeverity, string> = {
    minor: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    major: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export const BugReport: React.FC<BugReportProps> = ({ lang }) => {
    const [view, setView] = useState<'list' | 'form'>('list');
    const [reports, setReports] = useState<BugReportType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const navigate = useNavigate();

    // form state
    const [formTitle, setFormTitle] = useState('');
    const [formCategory, setFormCategory] = useState<BugCategory>('ui');
    const [formSeverity, setFormSeverity] = useState<BugSeverity>('minor');
    const [formDesc, setFormDesc] = useState('');
    const [uploadedAttachments, setUploadedAttachments] = useState<Attachment[]>([]);
    const [uploadingFile, setUploadingFile] = useState(false);

    const t = translations[lang];

    const fetchReports = async () => {
        setLoading(true);
        setError(false);
        try {
            const data = await bugReportApi.list();
            setReports(data);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchReports(); }, []);

    const handleFileUpload = async (files: FileList | null) => {
        if (!files) return;
        setUploadingFile(true);
        try {
            for (const file of Array.from(files)) {
                const attachment = await bugReportApi.uploadAttachment(file);
                setUploadedAttachments(prev => [...prev, attachment]);
            }
        } finally {
            setUploadingFile(false);
        }
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                e.preventDefault();
                const blob = items[i].getAsFile();
                if (blob) {
                    const file = new File([blob], `pasted-image-${Date.now()}.png`, { type: blob.type });
                    await handleFileUpload([file] as unknown as FileList);
                }
            }
        }
    };

    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => setIsDragging(false);

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        await handleFileUpload(e.dataTransfer.files);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formTitle.trim()) return;
        setSubmitting(true);
        try {
            await bugReportApi.create({
                title: formTitle,
                category: formCategory,
                severity: formSeverity,
                description: formDesc || undefined,
                attachment_keys: uploadedAttachments,
            });
            setFormTitle('');
            setFormCategory('ui');
            setFormSeverity('minor');
            setFormDesc('');
            setUploadedAttachments([]);
            await fetchReports();
            setView('list');
        } finally {
            setSubmitting(false);
        }
    };

    const statusLabel = (status: BugStatus) => ({
        reported: t.statusReported,
        in_progress: t.statusInProgress,
        resolved: t.statusResolved,
    }[status]);

    const shortId = (id: string) => `#${id.slice(0, 6).toUpperCase()}`;

    return (
        <div className="max-w-5xl mx-auto space-y-8" onPaste={handlePaste}>
            {view === 'list' ? (
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight dark:text-slate-100">{t.issueList}</h1>
                        </div>
                        <Button onClick={() => setView('form')} className="gap-2 rounded-xl" size="lg">
                            <Plus size={18} /> {t.newIssue}
                        </Button>
                    </div>

                    {loading ? (
                        <p className="text-slate-500">{t.loading}</p>
                    ) : error ? (
                        <p className="text-red-500">{t.error}</p>
                    ) : reports.length === 0 ? (
                        <p className="text-slate-400">{t.noReports}</p>
                    ) : (
                        <>
                        {/* 데스크탑 테이블 */}
                        <Card className="hidden md:block rounded-2xl overflow-hidden shadow-sm">
                            <Table>
                                <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                                    <TableRow>
                                        <TableHead className="w-[100px] text-xs font-bold text-slate-400 uppercase tracking-widest">{t.issueId}</TableHead>
                                        <TableHead className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t.issueTitle}</TableHead>
                                        <TableHead className="w-[110px] text-xs font-bold text-slate-400 uppercase tracking-widest">{t.issueSeverity}</TableHead>
                                        <TableHead className="w-[130px] text-xs font-bold text-slate-400 uppercase tracking-widest">{t.issueStatus}</TableHead>
                                        <TableHead className="w-[120px] text-xs font-bold text-slate-400 uppercase tracking-widest text-right">{t.issueDate}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reports.map((report) => (
                                        <TableRow key={report.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer group" onClick={() => navigate(`/bug-report/${report.id}`)}>
                                            <TableCell className="font-mono text-sm text-slate-400">{shortId(report.id)}</TableCell>
                                            <TableCell className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 transition-colors">{report.title}</TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${SEVERITY_COLOR[report.severity]}`}>
                                                    {report.severity}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={STATUS_BADGE[report.status]} className="uppercase text-[10px] px-2">
                                                    {statusLabel(report.status)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm font-medium text-slate-500 dark:text-slate-400 text-right">
                                                {report.created_at.slice(0, 10)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>

                        {/* 모바일 카드 리스트 */}
                        <div className="md:hidden space-y-3">
                            {reports.map((report) => (
                                <div key={report.id} onClick={() => navigate(`/bug-report/${report.id}`)}
                                    className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 p-4 shadow-sm cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <span className="font-bold text-slate-800 dark:text-slate-100 text-sm flex-1">{report.title}</span>
                                        <span className="font-mono text-xs text-slate-400">{shortId(report.id)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${SEVERITY_COLOR[report.severity]}`}>
                                            {report.severity}
                                        </span>
                                        <Badge variant={STATUS_BADGE[report.status]} className="uppercase text-[10px] px-2">
                                            {statusLabel(report.status)}
                                        </Badge>
                                        <span className="text-xs text-slate-400 ml-auto">{report.created_at.slice(0, 10)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        </>
                    )}
                </div>
            ) : (
                <div className="max-w-3xl mx-auto space-y-8">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => setView('list')} className="rounded-lg text-slate-500">
                            <ChevronRight className="rotate-180" size={24} />
                        </Button>
                        <h1 className="text-3xl font-extrabold tracking-tight dark:text-slate-100">{t.newIssue}</h1>
                    </div>
                    <Card className="p-8 rounded-3xl shadow-xl border dark:border-slate-800 bg-white dark:bg-slate-900">
                        <form className="space-y-6" onSubmit={handleSubmit}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t.title}</label>
                                    <Input
                                        className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950"
                                        placeholder={t.placeholderTitle}
                                        value={formTitle}
                                        onChange={e => setFormTitle(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t.category}</label>
                                    <Select value={formCategory} onValueChange={v => setFormCategory(v as BugCategory)}>
                                        <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ui">{t.catUI}</SelectItem>
                                            <SelectItem value="functional">{t.catFunc}</SelectItem>
                                            <SelectItem value="performance">{t.catPerf}</SelectItem>
                                            <SelectItem value="feature_request">{t.catFeature}</SelectItem>
                                            <SelectItem value="other">{t.catOther}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t.severity}</label>
                                <Select value={formSeverity} onValueChange={v => setFormSeverity(v as BugSeverity)}>
                                    <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="minor">{t.sevMinor}</SelectItem>
                                        <SelectItem value="major">{t.sevMajor}</SelectItem>
                                        <SelectItem value="critical">{t.sevCritical}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t.description}</label>
                                <Textarea
                                    className="min-h-[160px] rounded-xl bg-slate-50 dark:bg-slate-950"
                                    placeholder={t.placeholderDesc}
                                    value={formDesc}
                                    onChange={e => setFormDesc(e.target.value)}
                                    onPaste={handlePaste}
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t.attachments}</label>
                                <label
                                    htmlFor="file-upload"
                                    className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer block w-full text-center transition-colors ${isDragging ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-800 hover:border-indigo-500/50'}`}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                >
                                    <Paperclip className={`mx-auto ${isDragging ? 'text-indigo-500' : 'text-slate-400'}`} size={24} />
                                    <p className="text-sm font-bold text-slate-500">
                                        {uploadingFile ? t.uploadingFile : t.pasteImage}
                                    </p>
                                    <input id="file-upload" type="file" multiple accept="image/*,*/*" className="hidden" onChange={e => handleFileUpload(e.target.files)} />
                                </label>
                                {uploadedAttachments.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {uploadedAttachments.map((a, i) => (
                                            <div key={i} className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-1 text-sm">
                                                <Paperclip size={12} className="text-slate-400" />
                                                <span className="text-slate-600 dark:text-slate-300">{a.name}</span>
                                                <button type="button" onClick={() => setUploadedAttachments(prev => prev.filter((_, j) => j !== i))}>
                                                    <X size={12} className="text-slate-400 hover:text-red-500" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <Button className="w-full h-12 rounded-xl font-bold text-md" size="lg" disabled={submitting || uploadingFile}>
                                {submitting ? t.submitting : t.submit}
                            </Button>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
};

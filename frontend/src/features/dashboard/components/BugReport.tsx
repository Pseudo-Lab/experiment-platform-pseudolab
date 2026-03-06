import React, { useState } from 'react';
import { Plus, ChevronRight, Paperclip } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Badge } from '../../../components/ui/badge';
import { Card } from '../../../components/ui/card';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface BugReportProps {
    lang: 'en' | 'ko';
}

export const BugReport: React.FC<BugReportProps> = ({ lang }) => {
    const [view, setView] = useState<'list' | 'form'>('list');
    const [attachedFiles, setAttachedFiles] = useState<{ name: string, url: string, type: string }[]>([]);

    const translations = {
        en: {
            issueList: "Issue Tracker", newIssue: "New Issue", issueId: "ID", issueTitle: "Issue Title", issueDate: "Date", issueStatus: "Status",
            statusReported: "Reported", statusInProgress: "In Progress", statusResolved: "Resolved",
            title: "Title", category: "Category", description: "Description", submit: "Submit",
            placeholderTitle: "Short description", placeholderDesc: "What happened?",
            catUI: "UI/UX", catFunc: "Functional", catPerf: "Performance", catOther: "Other",
            pasteImage: "Paste image or click to upload", attachments: "Attachments"
        },
        ko: {
            issueList: "이슈 게시판", newIssue: "버그 제보하기", issueId: "번호", issueTitle: "이슈 제목", issueDate: "등록일", issueStatus: "상태",
            statusReported: "이슈 등록", statusInProgress: "처리 중", statusResolved: "해결 완료",
            title: "제목", category: "유형", description: "상세 내용", submit: "제출하기",
            placeholderTitle: "문제에 대한 짧은 설명", placeholderDesc: "발생한 상황에 대해 자세히 알려주세요...",
            catUI: "UI/UX 디자인", catFunc: "기능 오류", catPerf: "성능 이슈", catOther: "기타",
            pasteImage: "클립보드 이미지를 붙여넣거나 클릭하여 업로드하세요", attachments: "첨부 파일"
        }
    };

    const t = translations[lang];

    const handleFileUpload = (files: FileList | null) => {
        if (!files) return;
        const newFiles = Array.from(files).map(file => ({
            name: file.name, url: URL.createObjectURL(file), type: file.type
        }));
        setAttachedFiles(prev => [...prev, ...newFiles]);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    setAttachedFiles(prev => [...prev, { name: `pasted-image-${Date.now()}.png`, url, type: blob.type }]);
                }
            }
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8" onPaste={handlePaste}>
            {view === 'list' ? (
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight dark:text-slate-100">{t.issueList}</h1>
                            <p className="text-slate-500 dark:text-slate-400 mt-1">Check and track existing bug reports.</p>
                        </div>
                        <Button onClick={() => setView('form')} className="gap-2 rounded-xl" size="lg">
                            <Plus size={18} /> {t.newIssue}
                        </Button>
                    </div>

                    <Card className="hidden md:block rounded-2xl overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                                <TableRow>
                                    <TableHead className="w-[100px] text-xs font-bold text-slate-400 uppercase tracking-widest">{t.issueId}</TableHead>
                                    <TableHead className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t.issueTitle}</TableHead>
                                    <TableHead className="w-[150px] text-xs font-bold text-slate-400 uppercase tracking-widest">{t.issueStatus}</TableHead>
                                    <TableHead className="w-[150px] text-xs font-bold text-slate-400 uppercase tracking-widest text-right">{t.issueDate}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {[
                                    { id: "#104", title: "Mobile layout breaking on iPhone 13", status: "statusReported", date: "2026-02-20" },
                                    { id: "#103", title: "Supabase connection timeout in local k3s", status: "statusInProgress", date: "2026-02-19" }
                                ].map((issue, i) => (
                                    <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer group">
                                        <TableCell className="font-mono text-sm text-slate-400">{issue.id}</TableCell>
                                        <TableCell className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 transition-colors">{issue.title}</TableCell>
                                        <TableCell>
                                            <Badge variant={issue.status === 'statusReported' ? "destructive" : "secondary"} className="uppercase text-[10px] px-2">
                                                {t[issue.status as keyof typeof t]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm font-medium text-slate-500 dark:text-slate-400 text-right">{issue.date}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
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
                        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); setView('list'); }}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t.title}</label>
                                    <Input className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950" placeholder={t.placeholderTitle} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t.category}</label>
                                    <Select>
                                        <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950">
                                            <SelectValue placeholder={t.catUI} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ui">{t.catUI}</SelectItem>
                                            <SelectItem value="func">{t.catFunc}</SelectItem>
                                            <SelectItem value="perf">{t.catPerf}</SelectItem>
                                            <SelectItem value="other">{t.catOther}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t.description}</label>
                                <Textarea className="min-h-[160px] rounded-xl bg-slate-50 dark:bg-slate-950" placeholder={t.placeholderDesc} />
                            </div>
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t.attachments}</label>
                                <label htmlFor="file-upload" className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center gap-2 hover:border-indigo-500/50 cursor-pointer block w-full text-center">
                                    <Paperclip className="text-slate-400 mx-auto" size={24} />
                                    <p className="text-sm font-bold text-slate-500">{t.pasteImage}</p>
                                    <input id="file-upload" type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e.target.files)} />
                                </label>
                            </div>
                            <Button className="w-full h-12 rounded-xl font-bold text-md" size="lg">
                                {t.submit}
                            </Button>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
};

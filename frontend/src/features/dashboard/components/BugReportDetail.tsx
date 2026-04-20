import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Paperclip, MessageSquare } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import { Input } from '../../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { bugReportApi, type BugReport, type BugStatus, type BugSeverity } from '../../../services/api';

interface BugReportDetailProps {
  lang: 'en' | 'ko';
}

const translations = {
  en: {
    back: 'Back', loading: 'Loading...', error: 'Failed to load.', notFound: 'Not found.',
    labelCategory: 'Category', labelSeverity: 'Severity', labelStatus: 'Status',
    labelCreated: 'Created', labelUpdated: 'Updated', labelDesc: 'Description',
    labelAttachments: 'Attachments', sectionComments: 'Comments',
    placeholderComment: 'Leave a comment...', placeholderAuthor: 'Name (optional)',
    submitComment: 'Comment', submitting: 'Submitting...',
    noComments: 'No comments yet.', noDesc: 'No description.',
    statusReported: 'Open', statusInProgress: 'In Progress', statusResolved: 'Resolved',
    sevMinor: 'Minor', sevMajor: 'Major', sevCritical: 'Critical',
    catUI: 'UI/UX', catFunc: 'Functional', catPerf: 'Performance', catOther: 'Other',
  },
  ko: {
    back: '목록으로', loading: '불러오는 중...', error: '불러오지 못했습니다.', notFound: '이슈를 찾을 수 없습니다.',
    labelCategory: '유형', labelSeverity: '심각도', labelStatus: '상태',
    labelCreated: '등록일', labelUpdated: '수정일', labelDesc: '상세 내용',
    labelAttachments: '첨부 파일', sectionComments: '댓글',
    placeholderComment: '댓글을 남겨주세요...', placeholderAuthor: '이름 (선택)',
    submitComment: '댓글 작성', submitting: '작성 중...',
    noComments: '댓글이 없습니다.', noDesc: '내용 없음.',
    statusReported: 'Open', statusInProgress: 'In Progress', statusResolved: 'Resolved',
    sevMinor: 'Minor', sevMajor: 'Major', sevCritical: 'Critical',
    catUI: 'UI/UX 디자인', catFunc: '기능 오류', catPerf: '성능 이슈', catOther: '기타',
  },
};

const SEVERITY_COLOR: Record<BugSeverity, string> = {
  minor: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  major: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const STATUS_BADGE: Record<BugStatus, 'destructive' | 'secondary' | 'outline'> = {
  reported: 'destructive',
  in_progress: 'secondary',
  resolved: 'outline',
};

export const BugReportDetail: React.FC<BugReportDetailProps> = ({ lang }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = translations[lang];

  const [report, setReport] = useState<BugReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [commentContent, setCommentContent] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const fetchReport = async () => {
    if (!id) return;
    setLoading(true);
    setError(false);
    try {
      const data = await bugReportApi.get(id);
      setReport(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, [id]);

  const handleStatusChange = async (status: BugStatus) => {
    if (!id) return;
    const updated = await bugReportApi.update(id, { status });
    setReport(updated);
  };

  const handleSeverityChange = async (severity: BugSeverity) => {
    if (!id) return;
    const updated = await bugReportApi.update(id, { severity });
    setReport(updated);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !commentContent.trim()) return;
    setSubmittingComment(true);
    try {
      const updated = await bugReportApi.addComment(id, commentContent, commentAuthor || undefined);
      setReport(updated);
      setCommentContent('');
      setCommentAuthor('');
    } finally {
      setSubmittingComment(false);
    }
  };

  const statusLabel = (status: BugStatus) => ({
    reported: t.statusReported,
    in_progress: t.statusInProgress,
    resolved: t.statusResolved,
  }[status]);

  const categoryLabel = (cat: string) => ({
    ui: t.catUI, functional: t.catFunc, performance: t.catPerf, other: t.catOther,
  }[cat] ?? cat);

  const handleDelete = async () => {
    if (!id || !window.confirm(lang === 'ko' ? '정말로 이 리포트를 삭제하시겠습니까?' : 'Are you sure you want to delete this report?')) return;
    try {
      await bugReportApi.delete(id);
      navigate('/bug-report');
    } catch (err) {
      alert(lang === 'ko' ? '삭제에 실패했습니다.' : 'Failed to delete.');
    }
  };

  if (loading) return <div className="p-8 text-slate-500">{t.loading}</div>;
  if (error) return <div className="p-8 text-red-500">{t.error}</div>;
  if (!report) return <div className="p-8 text-slate-400">{t.notFound}</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/bug-report')} className="rounded-lg text-slate-500">
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-2xl font-extrabold tracking-tight dark:text-slate-100 flex-1">{report.title}</h1>
        <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-500 hover:text-red-600 hover:bg-red-50">
          {lang === 'ko' ? '삭제' : 'Delete'}
        </Button>
      </div>

      {/* 메타 정보 + 상태 변경 */}
      <Card className="rounded-2xl">
        <CardContent className="px-6 pb-6 pt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-slate-400 font-semibold uppercase">{t.labelCategory}</p>
            <p className="text-sm font-medium">{categoryLabel(report.category)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-400 font-semibold uppercase">{t.labelStatus}</p>
            <Select value={report.status} onValueChange={v => handleStatusChange(v as BugStatus)}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reported">{t.statusReported}</SelectItem>
                <SelectItem value="in_progress">{t.statusInProgress}</SelectItem>
                <SelectItem value="resolved">{t.statusResolved}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-400 font-semibold uppercase">{t.labelSeverity}</p>
            <Select value={report.severity} onValueChange={v => handleSeverityChange(v as BugSeverity)}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minor">{t.sevMinor}</SelectItem>
                <SelectItem value="major">{t.sevMajor}</SelectItem>
                <SelectItem value="critical">{t.sevCritical}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-400 font-semibold uppercase">{t.labelCreated}</p>
            <p className="text-sm">{report.created_at.slice(0, 10)}</p>
          </div>
        </CardContent>
      </Card>

      {/* 설명 */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2 pt-4 px-6">
          <CardTitle className="text-sm font-bold text-slate-500 uppercase">{t.labelDesc}</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
            {report.description || <span className="text-slate-400">{t.noDesc}</span>}
          </p>
        </CardContent>
      </Card>

      {/* 첨부 파일 */}
      {report.attachments.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-sm font-bold text-slate-500 uppercase">{t.labelAttachments}</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {report.attachments.map((a, i) => (
                <div key={i} className="group relative">
                  {a.type.startsWith('image/') && a.url ? (
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="block aspect-video rounded-xl overflow-hidden border dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shadow-sm hover:ring-2 hover:ring-indigo-500 transition-all">
                      <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {a.name}
                      </div>
                    </a>
                  ) : (
                    <a href={a.url ?? '#'} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-4 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors h-full">
                      <Paperclip size={16} className="text-slate-400 shrink-0" />
                      <span className="text-slate-600 dark:text-slate-300 truncate font-medium">{a.name}</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 댓글 */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2 pt-4 px-6">
          <CardTitle className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2">
            <MessageSquare size={14} />
            {t.sectionComments} ({report.comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 space-y-4">
          {report.comments.length === 0 ? (
            <p className="text-sm text-slate-400">{t.noComments}</p>
          ) : (
            <div className="space-y-3">
              {report.comments.map((comment) => (
                <div key={comment.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      {comment.author || 'Anonymous'}
                    </span>
                    <span className="text-xs text-slate-400">{comment.created_at.slice(0, 16).replace('T', ' ')}</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{comment.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* 댓글 입력 폼 */}
          <form onSubmit={handleAddComment} className="space-y-3 pt-2 border-t dark:border-slate-700">
            {/* TODO: OAuth 연동 시 이 필드 제거 — 로그인한 사용자 정보로 자동 대체 */}
            <Input
              className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 text-sm"
              placeholder={t.placeholderAuthor}
              value={commentAuthor}
              onChange={e => setCommentAuthor(e.target.value)}
            />
            <Textarea
              className="rounded-xl bg-slate-50 dark:bg-slate-950 text-sm min-h-[80px]"
              placeholder={t.placeholderComment}
              value={commentContent}
              onChange={e => setCommentContent(e.target.value)}
              required
            />
            <Button type="submit" className="rounded-xl" disabled={submittingComment || !commentContent.trim()}>
              {submittingComment ? t.submitting : t.submitComment}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

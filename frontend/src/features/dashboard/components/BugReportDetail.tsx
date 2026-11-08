import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { bugReportApi, type BugReport, type BugStatus, type BugSeverity } from '../../../services/api';

const words = {
  ko: { back: '목록으로', loading: '불러오는 중…', error: '처리하지 못했습니다. 다시 시도해 주세요.', retry: '다시 시도',
    status: '처리 상태', bug: '버그', suggestion: '건의', reported: '접수', in_progress: '확인 중', resolved: '완료',
    content: '내용', images: '스크린샷', comments: '댓글', empty: '아직 댓글이 없습니다.', comment: '댓글 내용', submit: '댓글 등록',
    saving: '저장 중…', hint: '댓글은 로그인한 사용자에게 공유됩니다. 비밀번호·비밀 키·개인정보를 남기지 마세요.',
    member: '사용자', admin: '관리자', noContent: '내용이 없습니다.', severity: '심각도', minor: '낮음', major: '중요', critical: '긴급', remove: '삭제', confirmRemove: '이 게시글과 댓글을 삭제하시겠습니까?'  },
  en: { back: 'Back to feedback', loading: 'Loading…', error: 'Could not complete the request. Please try again.', retry: 'Retry',
    status: 'Status', bug: 'Bug', suggestion: 'Suggestion', reported: 'Received', in_progress: 'In review', resolved: 'Done',
    content: 'Details', images: 'Screenshots', comments: 'Comments', empty: 'No comments yet.', comment: 'Comment', submit: 'Post comment',
    saving: 'Saving…', hint: 'Comments are shared with signed-in users. Do not include passwords, secret keys or personal information.',
    member: 'Member', admin: 'Administrator', noContent: 'No details provided.', severity: 'Severity', minor: 'Minor', major: 'Major', critical: 'Critical', remove: 'Delete', confirmRemove: 'Delete this feedback and its comments?'  },
};

export const BugReportDetail: React.FC<{ lang: 'ko' | 'en'; isAdmin?: boolean }> = ({ lang, isAdmin = false }) => {
  const { id } = useParams<{id: string}>();
  const t = words[lang];
  const navigate = useNavigate();
  const [report, setReport] = useState<BugReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    if (!id) return;
    setLoading(true); setError(false); setReport(null);
    try { setReport(await bugReportApi.get(id)); }
    catch { setError(true); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [id]);
  const changeStatus = async (status: BugStatus) => {
    if (!id || busy || !isAdmin) return;
    setBusy(true); setError(false);
    try { setReport(await bugReportApi.update(id, {status})); }
    catch { setError(true); }
    finally { setBusy(false); }
  };
  const changeSeverity = async (severity: BugSeverity) => {
    if (!id || busy || !isAdmin) return;
    setBusy(true); setError(false);
    try { setReport(await bugReportApi.update(id, {severity})); }
    catch { setError(true); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!id || busy || !isAdmin || !window.confirm(t.confirmRemove)) return;
    setBusy(true); setError(false);
    try { await bugReportApi.delete(id); navigate('/bug-report'); }
    catch { setError(true); }
    finally { setBusy(false); }
  };
  const addComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id || busy || !comment.trim()) return;
    setBusy(true); setError(false);
    try { setReport(await bugReportApi.addComment(id, comment.trim())); setComment(''); }
    catch { setError(true); }
    finally { setBusy(false); }
  };
  return <section className="max-w-3xl mx-auto space-y-6">
    <Link to="/bug-report" className="text-sm underline underline-offset-4">← {t.back}</Link>
    {loading && <p role="status">{t.loading}</p>}
    {error && <div role="alert" className="text-destructive space-y-2"><p>{t.error}</p>
      {!report && <Button variant="outline" onClick={() => void load()}>{t.retry}</Button>}</div>}
    {report && <>
      <div className="space-y-3"><div className="flex items-start justify-between gap-3"><h1 className="text-2xl font-bold break-all">{report.title}</h1>
        {isAdmin && <Button variant="ghost" size="sm" disabled={busy} onClick={() => void remove()}>{t.remove}</Button>}</div>
        <div className="flex flex-wrap items-center gap-3 text-sm"><Badge variant="outline">{report.category === 'feature_request' ? t.suggestion : t.bug}</Badge>
          <span className="text-muted-foreground">{report.created_at.slice(0,10)}</span>
          {isAdmin ? <label>{t.status} <select aria-label={t.status} value={report.status} disabled={busy}
            className="h-10 rounded-md border border-input bg-background px-3" onChange={e => void changeStatus(e.target.value as BugStatus)}>
            {(['reported', 'in_progress', 'resolved'] as BugStatus[]).map(status => <option key={status} value={status}>{t[status]}</option>)}
          </select></label> : <Badge>{t[report.status]}</Badge>}
          {isAdmin && <label>{t.severity} <select aria-label={t.severity} value={report.severity} disabled={busy}
            className="h-10 rounded-md border border-input bg-background px-3" onChange={e => void changeSeverity(e.target.value as BugSeverity)}>
            {(['minor', 'major', 'critical'] as BugSeverity[]).map(value => <option key={value} value={value}>{t[value]}</option>)}
          </select></label>}
        </div>
      </div>
      <Card><CardHeader><CardTitle className="text-base">{t.content}</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap break-words text-sm">{report.description || t.noContent}</p></CardContent></Card>
      {report.attachments.length > 0 && <Card><CardHeader><CardTitle className="text-base">{t.images}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">{report.attachments.map(attachment =>
          <a key={attachment.key} href={attachment.url} target="_blank" rel="noopener noreferrer" className="rounded border p-2 break-all text-sm">
            <img src={attachment.url} alt={attachment.name} className="max-h-64 w-full object-contain" />{attachment.name}
          </a>)}</CardContent></Card>}
      <Card><CardHeader><CardTitle className="text-base">{t.comments} ({report.comments.length})</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {report.comments.length === 0 ? <p className="text-sm text-muted-foreground">{t.empty}</p> : <ul className="space-y-3">
            {report.comments.map(item => <li key={item.id} className="rounded-md bg-muted/40 p-4 space-y-2">
              <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{item.author === 'Administrator' ? t.admin : t.member}</span>
                <span>{item.created_at.slice(0,16).replace('T',' ')}</span></div>
              <p className="text-sm whitespace-pre-wrap break-words">{item.content}</p>
            </li>)}
          </ul>}
          <form onSubmit={addComment} className="space-y-3 border-t pt-4"><label htmlFor="feedback-comment" className="text-sm font-medium">{t.comment}</label>
            <Textarea id="feedback-comment" value={comment} onChange={e => setComment(e.target.value)} required maxLength={5000} aria-describedby="comment-hint" />
            <p id="comment-hint" className="text-xs text-muted-foreground">{t.hint}</p>
            <Button type="submit" disabled={busy || !comment.trim()}>{busy ? t.saving : t.submit}</Button>
          </form>
        </CardContent>
      </Card>
    </>}
  </section>;
};

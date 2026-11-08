import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Card, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { bugReportApi, type BugReport as Report, type BugStatus, type Attachment } from '../../../services/api';

const words = {
  ko: { heading: '버그·건의', intro: '오류와 개선 아이디어를 공유하고 처리 상황을 확인하세요.', new: '등록하기',
    title: '제목', type: '유형', bug: '버그', suggestion: '건의', content: '내용', images: '스크린샷 (선택)',
    hint: 'PNG/JPEG, 파일당 900 KiB 이하, 최대 3개. 비밀번호·SDK 비밀 키·개인정보는 올리지 마세요. 등록 내용은 로그인한 사용자에게 공유됩니다. 제출하지 않은 첨부는 업로드 24시간 후부터 운영자가 수동 정리할 수 있습니다. 오래 열린 작성창에서는 다시 첨부해야 할 수 있습니다.',
    submit: '등록', cancel: '취소', loading: '불러오는 중…', sending: '등록 중…', uploading: '이미지 업로드 중…',
    error: '처리하지 못했습니다. 다시 시도해 주세요.', retry: '다시 시도', empty: '등록된 버그·건의가 없습니다.',
    reported: '접수', in_progress: '확인 중', resolved: '완료', all: '전체', status: '상태', date: '등록일',
    remove: '첨부 제거', fileError: 'PNG/JPEG 파일당 900 KiB 이하로 최대 3개까지 첨부할 수 있습니다.' },
  en: { heading: 'Bugs & suggestions', intro: 'Share issues and ideas, and follow their progress.', new: 'New feedback',
    title: 'Title', type: 'Type', bug: 'Bug', suggestion: 'Suggestion', content: 'Details', images: 'Screenshots (optional)',
    hint: 'PNG/JPEG, up to 900 KiB each, 3 files maximum. Do not include passwords, secret SDK keys or personal information. Feedback is shared with signed-in users. Unsubmitted attachments may be manually removed by the operator once they are 24 hours old. You may need to reattach files in a long-open form.',
    submit: 'Submit', cancel: 'Cancel', loading: 'Loading…', sending: 'Submitting…', uploading: 'Uploading images…',
    error: 'Could not complete the request. Please try again.', retry: 'Retry', empty: 'No feedback yet.',
    reported: 'Received', in_progress: 'In review', resolved: 'Done', all: 'All', status: 'Status', date: 'Created',
    remove: 'Remove attachment', fileError: 'Attach up to 3 PNG/JPEG files, no more than 900 KiB each.' },
};

export const BugReport: React.FC<{ lang: 'ko' | 'en' }> = ({ lang }) => {
  const t = words[lang];
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [kind, setKind] = useState('bug');
  const [filter, setFilter] = useState('all');
  const [status, setStatus] = useState('all');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try { setReports(await bugReportApi.list()); }
    catch { setError(t.error); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const upload = async (files: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files);
    if (attachments.length + selected.length > 3 || selected.some(file =>
      !['image/png', 'image/jpeg'].includes(file.type) || !file.size || file.size > 900 * 1024)) {
      setError(t.fileError); return;
    }
    setUploading(true); setError('');
    try {
      for (const file of selected) {
        const attachment = await bugReportApi.uploadAttachment(file);
        setAttachments(previous => [...previous, attachment]);
      }
    } catch { setError(t.error); }
    finally { setUploading(false); }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || uploading || !title.trim() || !content.trim()) return;
    setBusy(true); setError('');
    try {
      const report = await bugReportApi.create({ title: title.trim(), description: content.trim(),
        category: kind === 'suggestion' ? 'feature_request' : 'functional', severity: 'minor', attachment_keys: attachments });
      navigate(`/bug-report/${report.id}`);
    } catch { setError(t.error); }
    finally { setBusy(false); }
  };
  const visible = reports.filter(report => (status === 'all' || report.status === status)
    && (filter === 'all' || (report.category === 'feature_request' ? 'suggestion' : 'bug') === filter));
  const selectClass = 'h-10 rounded-md border border-input bg-background px-3 text-sm';

  return <section className="max-w-5xl mx-auto space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-2xl font-bold">{t.heading}</h1><p className="text-sm text-muted-foreground mt-2">{t.intro}</p></div>
      {!form && <Button onClick={() => { setForm(true); setError(''); }}><Plus size={16} className="mr-2" />{t.new}</Button>}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {form ? <Card><CardContent className="pt-6">
      <form onSubmit={submit} className="space-y-5">
        <div><label htmlFor="feedback-title" className="text-sm font-medium">{t.title}</label>
          <Input id="feedback-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={160} required /></div>
        <div><label htmlFor="feedback-kind" className="text-sm font-medium mr-3">{t.type}</label>
          <select id="feedback-kind" value={kind} onChange={e => setKind(e.target.value)} className={selectClass}>
            <option value="bug">{t.bug}</option><option value="suggestion">{t.suggestion}</option>
          </select></div>
        <div><label htmlFor="feedback-content" className="text-sm font-medium">{t.content}</label>
          <Textarea id="feedback-content" value={content} onChange={e => setContent(e.target.value)} maxLength={10000} required className="min-h-40" /></div>
        <div className="space-y-3"><label htmlFor="feedback-images" className="text-sm font-medium">{t.images}</label>
          <Input id="feedback-images" type="file" accept="image/png,image/jpeg" multiple disabled={uploading || busy || attachments.length >= 3}
            onChange={e => { void upload(e.target.files); e.target.value = ''; }} aria-describedby="feedback-hint" />
          <p id="feedback-hint" className="text-xs text-muted-foreground">{t.hint}</p>
          {uploading && <p role="status" className="text-sm">{t.uploading}</p>}
          <div className="flex flex-wrap gap-3">{attachments.map(attachment => <div key={attachment.key} className="w-36 space-y-1">
            <img src={attachment.url} alt={attachment.name} className="h-24 w-36 object-contain rounded border" />
            <Button type="button" variant="outline" size="sm" disabled={busy || uploading} aria-label={`${t.remove}: ${attachment.name}`}
              onClick={() => setAttachments(old => old.filter(item => item.key !== attachment.key))}><X size={14} />{t.remove}</Button>
          </div>)}</div>
        </div>
        <div className="flex gap-3"><Button type="submit" disabled={busy || uploading || !title.trim() || !content.trim()}>{busy ? t.sending : t.submit}</Button>
          <Button type="button" variant="outline" disabled={busy || uploading} onClick={() => { setForm(false); setError(''); }}>{t.cancel}</Button></div>
      </form>
    </CardContent></Card> : <>
      <div className="flex flex-wrap gap-4">
        <label className="text-sm">{t.type} <select aria-label={t.type} className={selectClass} value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">{t.all}</option><option value="bug">{t.bug}</option><option value="suggestion">{t.suggestion}</option>
        </select></label>
        <label className="text-sm">{t.status} <select aria-label={t.status} className={selectClass} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="all">{t.all}</option>{(['reported','in_progress','resolved'] as BugStatus[]).map(value => <option key={value} value={value}>{t[value]}</option>)}
        </select></label>
      </div>
      {loading ? <p role="status">{t.loading}</p> : error ? <Button variant="outline" onClick={() => void load()}>{t.retry}</Button>
        : visible.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground">{t.empty}</CardContent></Card>
        : <ul className="space-y-3">{visible.map(report => <li key={report.id}>
          <Link to={`/bug-report/${report.id}`} className="block rounded-lg border bg-card p-5 hover:bg-muted/40 focus-visible:outline focus-visible:outline-2">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold break-all">{report.title}</h2>
              <Badge variant="outline">{t[report.status]}</Badge></div>
            <div className="mt-3 flex gap-4 text-xs text-muted-foreground"><span>{report.category === 'feature_request' ? t.suggestion : t.bug}</span>
              <span>{t.date}: {report.created_at.slice(0,10)}</span></div>
          </Link>
        </li>)}</ul>}
    </>}
  </section>;
};

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useProject } from '@/contexts/ProjectContext';
import { projectSharingApi as api, type PendingProjectInvitation } from '@/services/api';

const copy = {
  ko: {
    title: '받은 프로젝트 초대', loading: '초대 확인 중...', refresh: '새로고침',
    from: '초대한 사람', unknown: '프로젝트 관리자', viewer: '조회자', editor: '편집자',
    accept: '수락', decline: '거절', busy: '처리 중...', expires: '초대 만료 시각', retry: '다시 시도',
    error: '초대를 확인하지 못했습니다. 다시 시도해 주세요.',
    unavailable: '만료되거나 회수된 초대입니다. 목록을 새로고침해 주세요.',
    wrongAccount: '초대받은 이메일의 Google 계정으로 다시 로그인해 주세요.',
    joined: '프로젝트에 참여했습니다.', declined: '초대를 거절했습니다.',
  },
  en: {
    title: 'Project invitations', loading: 'Checking invitations...', refresh: 'Refresh',
    from: 'Invited by', unknown: 'Project administrator', viewer: 'Viewer', editor: 'Editor',
    accept: 'Accept', decline: 'Decline', busy: 'Working...', expires: 'Invitation expires at', retry: 'Retry',
    error: 'Could not check invitations. Please retry.',
    unavailable: 'This invitation expired or was revoked. Refresh the list.',
    wrongAccount: 'Sign in again with the invited Google email account.',
    joined: 'You joined the project.', declined: 'Invitation declined.',
  },
};

export function ProjectInvitationInbox({ lang }: { lang: 'ko' | 'en' }) {
  const t = copy[lang];
  const [invitations, setInvitations] = useState<PendingProjectInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<'load' | 'unavailable' | 'account' | null>(null);
  const [notice, setNotice] = useState<'joined' | 'declined' | null>(null);
  const request = useRef(0);
  const mounted = useRef(true);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { reloadProjects, setCurrentProjectId } = useProject();

  const load = useCallback(async () => {
    const revision = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await api.pending();
      if (revision === request.current) setInvitations(rows);
    } catch {
      if (revision === request.current) setError('load');
    } finally {
      if (revision === request.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; ++request.current; };
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => { void load(); };
    window.addEventListener('focus', refresh);
    return () => { ++request.current; window.removeEventListener('focus', refresh); };
  }, [load, pathname]);

  const respond = async (invitation: PendingProjectInvitation, accept: boolean) => {
    setBusy(invitation.id);
    setError(null);
    setNotice(null);
    try {
      if (accept) {
        const project = await api.acceptPending(invitation.id);
        if (!mounted.current) return;
        await reloadProjects();
        if (!mounted.current) return;
        setCurrentProjectId(project.id);
        setNotice('joined');
        navigate('/experiments');
      } else {
        await api.decline(invitation.id);
        if (!mounted.current) return;
        setNotice('declined');
      }
      setInvitations(rows => rows.filter(row => row.id !== invitation.id));
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error && ['404', '410'].includes(e.message) ? 'unavailable'
        : e instanceof Error && e.message === '403' ? 'account' : 'load');
    } finally {
      ++request.current;
      if (mounted.current) { setLoading(false); setBusy(null); }
    }
  };

  // No invitations is the normal empty state; avoid placing an empty panel on every screen.
  if (!loading && !invitations.length && !error && !notice) return null;
  return (
    <section aria-label={t.title} aria-busy={loading || busy !== null} className="mb-6 space-y-4 rounded-xl border border-border bg-card p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{t.title}</h2>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading || busy !== null}>{t.refresh}</Button>
      </div>
      {loading && <p role="status" className="text-sm text-muted-foreground">{t.loading}</p>}
      {notice && <p role="status" className="text-sm">{t[notice]}</p>}
      {error && <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{error === 'account' ? t.wrongAccount : error === 'unavailable' ? t.unavailable : t.error}</p><Button variant="outline" size="sm" disabled={loading || busy !== null} onClick={() => void load()}>{t.retry}</Button></div>}
      <ul className="divide-y divide-border">
        {invitations.map(invitation => <li key={invitation.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0 space-y-1">
            <h3 className="break-words text-sm font-semibold">{invitation.project_name}</h3>
            <p className="break-words text-sm text-muted-foreground">{t.from}: {invitation.inviter_name || t.unknown} · {t[invitation.role]}</p>
            <p className="text-xs text-muted-foreground">{t.expires}: {new Date(invitation.expires_at * 1000).toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US')}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button disabled={busy !== null || loading} onClick={() => void respond(invitation, true)}>{busy === invitation.id ? t.busy : t.accept}</Button>
            <Button variant="outline" disabled={busy !== null || loading} onClick={() => void respond(invitation, false)}>{t.decline}</Button>
          </div>
        </li>)}
      </ul>
    </section>
  );
}

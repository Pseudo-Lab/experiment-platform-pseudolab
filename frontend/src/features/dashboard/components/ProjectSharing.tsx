import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  projectSharingApi as api,
  type Project,
  type ProjectMember,
  type ProjectInvitation,
  type ProjectRole,
} from "@/services/api";
import { useProject } from "@/contexts/ProjectContext";

const copy = {
  ko: {
    title: "프로젝트 공유",
    owner: "소유자",
    viewer: "조회자",
    editor: "편집자",
    role: "초대 권한",
    email: "초대할 Google 계정 이메일",
    invalidEmail: "올바른 이메일 주소를 입력해 주세요.",
    recipient: "초대받는 이메일",
    wrongAccount: "초대받은 이메일의 Google 계정으로 로그인해 주세요. 이메일 소유권의 추가 확인이 필요한 계정은 소유자에게 문의해 주세요.",
    create: "이메일로 초대",
    createdNotice: "초대를 등록했습니다. 상대가 해당 이메일로 로그인하면 확인할 수 있습니다.",
    busy: "처리 중...",
    close: "닫기",
    load: "불러오는 중...",
    retry: "다시 시도",
    error:
      "요청을 완료하지 못했습니다. 권한과 연결을 확인한 뒤 다시 시도하세요.",
    hint: "상대가 가입하거나 로그인하면 받은 초대가 표시됩니다. Gmail 또는 Google Workspace 주소를 사용해 주세요. 초대는 7일 후 만료되며 이메일은 별도로 발송하지 않습니다.",
    permission:
      "조회자는 실험·결과를 보고, 편집자는 실험·플래그와 공개 SDK 키를 관리합니다. 초대·멤버·프로젝트 설정은 소유자만 관리합니다.",
    members: "멤버",
    changeRole: "권한 변경",
    processedAt: "처리 시각", actions: "관리", previous: "이전", next: "다음", historyTable: "초대 이력 표 — 가로로 스크롤할 수 있습니다.",
    remove: "멤버 제거",
    removeConfirm: "이 멤버의 프로젝트 접근 권한을 제거할까요?",
    history: "초대 이력",
    pending: "대기",
    accepted: "수락",
    expired: "만료",
    revoked: "회수",
    declined: "거절",
    declinedAt: "거절 시각",
    filter: "초대 상태",
    allStatus: "모든 상태",
    refresh: "새로고침",
    created: "발급 시각",
    acceptedAt: "수락 시각",
    acceptedBy: "수락한 계정",
    revokedAt: "회수 시각",
    none: "조건에 맞는 초대 이력이 없습니다.",
    revoke: "초대 회수",
    expires: "초대 만료 시각",
    acceptTitle: "프로젝트 초대",
    accept: "초대 수락",
    later: "나중에",
    invalid: "만료·회수·사용된 초대입니다. 소유자에게 다시 초대해 달라고 요청하세요.",
    joined: "프로젝트에 참여했습니다.",
  },
  en: {
    title: "Project sharing",
    owner: "Owner",
    viewer: "Viewer",
    editor: "Editor",
    role: "Invitation role",
    email: "Google account email to invite",
    invalidEmail: "Enter a valid email address.",
    recipient: "Invited email",
    wrongAccount: "Sign in with the invited Google email account. If additional email ownership verification is required, contact the owner.",
    create: "Invite by email",
    createdNotice: "Invitation created. They can find it after signing in with this email.",
    busy: "Working...",
    close: "Close",
    load: "Loading...",
    retry: "Retry",
    error:
      "Could not complete the request. Check your access and connection, then retry.",
    hint: "They will see the invitation after signing up or signing in. Use a Gmail or Google Workspace address. Invitations expire in 7 days; no email is sent.",
    permission:
      "Viewers read experiments and results. Editors manage experiments, flags and the public SDK key. Only owners manage invitations, members and project settings.",
    members: "Members",
    changeRole: "Change role",
    processedAt: "Processed at", actions: "Actions", previous: "Previous", next: "Next", historyTable: "Invitation history table — scroll horizontally for more columns.",
    remove: "Remove member",
    removeConfirm: "Remove this member’s project access?",
    history: "Invitation history",
    pending: "Pending",
    accepted: "Accepted",
    expired: "Expired",
    revoked: "Revoked",
    declined: "Declined",
    declinedAt: "Declined at",
    filter: "Invitation status",
    allStatus: "All statuses",
    refresh: "Refresh",
    created: "Created",
    acceptedAt: "Accepted at",
    acceptedBy: "Accepted by",
    revokedAt: "Revoked at",
    none: "No invitations match this filter.",
    revoke: "Revoke invitation",
    expires: "Invitation expires at",
    acceptTitle: "Project invitation",
    accept: "Accept invitation",
    later: "Later",
    invalid:
      "This invitation has expired, been revoked or been used. Ask the owner to invite you again.",
    joined: "You joined the project.",
  },
};

export function ProjectSharing({
  project,
  lang,
  onClose,
}: {
  project: Project;
  lang: "ko" | "en";
  onClose?: () => void;
}) {
  const t = copy[lang];
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [invites, setInvites] = useState<ProjectInvitation[]>([]);
  const [statusFilter, setStatusFilter] = useState<
    ProjectInvitation["status"] | "all"
  >("all");
  const [page, setPage] = useState(1);
  const visibleInvites = invites.filter(
    (i) => statusFilter === "all" || i.status === statusFilter,
  );
  const pageCount = Math.max(1, Math.ceil(visibleInvites.length / 10));
  const currentPage = Math.min(page, pageCount);
  const pageInvites = visibleInvites.slice((currentPage - 1) * 10, currentPage * 10);
  const formatTime = (seconds: number) =>
    new Date(seconds * 1000).toLocaleString(lang === "ko" ? "ko-KR" : "en-US");
  const [role, setRole] = useState<ProjectRole>("viewer");
  const [email, setEmail] = useState("");
  const [invalidEmail, setInvalidEmail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [created, setCreated] = useState(false);
  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const [m, i] = await Promise.all([
        api.members(project.id),
        api.invitations(project.id),
      ]);
      setMembers(m);
      setInvites(i);
      setPage(1);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [project.id]);
  const change = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(false);
    try {
      await action();
      await load();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  const create = () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@<>\x00-\x1f\x7f]+@[^\s@<>\x00-\x1f\x7f]+\.[^\s@<>\x00-\x1f\x7f]+$/.test(normalizedEmail)) {
      setInvalidEmail(true);
      return;
    }
    setInvalidEmail(false);
    void change(async () => {
      setCreated(false);
      await api.invite(project.id, role, normalizedEmail);
      setCreated(true);
      setEmail("");
    });
  };
  return (
    <>
    <Card role="region" aria-label={t.title}>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="min-w-0">
          <CardTitle className="text-lg">{t.title}</CardTitle>
          <p className="mt-1 break-words text-sm text-muted-foreground">
            {project.name}
          </p>
        </div>
        {onClose && <Button variant="ghost" onClick={onClose}>
          {t.close}
        </Button>}
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="max-w-prose text-sm text-muted-foreground">
          {t.permission}
        </p>
        {created && <p role="status" className="max-w-prose text-sm text-muted-foreground">{t.createdNotice}</p>}
        {error && (
          <div role="alert" className="space-y-2">
            <p className="text-sm text-destructive">{t.error}</p>
            <Button variant="outline" disabled={busy || loading} onClick={load}>
              {t.retry}
            </Button>
          </div>
        )}
        {loading ? (
          <p role="status">{t.load}</p>
        ) : (
          <>
            <div className="space-y-3">
              <label className="block text-sm" htmlFor="invitation-email">{t.email}</label>
              <Input id="invitation-email" type="email" autoComplete="off" maxLength={254}
                value={email} disabled={busy} aria-invalid={invalidEmail}
                aria-describedby={invalidEmail ? "invitation-email-error" : undefined}
                onChange={e => { setEmail(e.target.value); setInvalidEmail(false); setCreated(false); }} />
              {invalidEmail && <p id="invitation-email-error" role="alert" className="text-sm text-destructive">{t.invalidEmail}</p>}
              <label className="block text-sm" htmlFor="invitation-role">
                {t.role}
              </label>
              <div className="flex flex-wrap gap-3">
                <select
                  id="invitation-role"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={role}
                  disabled={busy}
                  onChange={(e) => setRole(e.target.value as ProjectRole)}
                >
                  <option value="viewer">{t.viewer}</option>
                  <option value="editor">{t.editor}</option>
                </select>
                <Button onClick={create} disabled={busy}>
                  {busy ? t.busy : t.create}
                </Button>
              </div>
              <p className="max-w-prose text-sm text-muted-foreground">
                {t.hint}
              </p>
            </div>
            <section className="space-y-3">
              <h3 className="font-semibold">{t.members}</h3>
              <ul className="divide-y divide-border">
                {members.map((m) => (
                  <li
                    key={m.account_id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0 flex-1 basis-48 break-all">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{m.display_name || m.email || m.account_id}</p>
                        <Badge variant="secondary" className="shrink-0">{t[m.role]}</Badge>
                      </div>
                      {m.display_name && m.email && m.email !== m.display_name && <p className="mt-1 text-sm text-muted-foreground">{m.email}</p>}
                    </div>
                    {m.role !== "owner" && (
                      <div className="flex flex-wrap gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" disabled={busy}
                              aria-label={`${t.changeRole}: ${m.display_name || m.email || m.account_id}`}>
                              {t.changeRole}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuRadioGroup value={m.role} onValueChange={value => {
                              if (value !== m.role) void change(() => api.update(project.id, m.account_id, value as ProjectRole));
                            }}>
                              <DropdownMenuRadioItem value="viewer" disabled={busy}>{t.viewer}</DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="editor" disabled={busy}>{t.editor}</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm(t.removeConfirm))
                              void change(() =>
                                api.remove(project.id, m.account_id),
                              );
                          }}
                        >
                          {t.remove}
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </CardContent>
    </Card>
    <Card role="region" aria-label={t.history}>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{t.history}</h3>
        <Button variant="outline" disabled={busy || loading} onClick={load}>{t.refresh}</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div role="group" aria-label={t.filter} className="flex flex-wrap gap-2">
          {(["all", "pending", "accepted", "declined", "expired", "revoked"] as const).map(status => (
            <Button key={status} size="sm" className="rounded-full"
              variant={statusFilter === status ? "default" : "outline"}
              aria-pressed={statusFilter === status} disabled={busy || loading}
              onClick={() => { setStatusFilter(status); setPage(1); }}>
              {status === "all" ? t.allStatus : t[status]}
            </Button>
          ))}
        </div>
        {loading ? <p role="status">{t.load}</p> : <>
          <div className="max-w-full overflow-x-auto rounded-md border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" tabIndex={0} role="region" aria-label={t.historyTable}>
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                <tr>
                  {[t.recipient, t.role, t.filter, t.created, t.expires, t.acceptedBy, t.processedAt, t.actions].map(label =>
                    <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageInvites.map(i => {
                  const processedAt = i.accepted_at ?? i.declined_at ?? i.revoked_at;
                  return <tr key={i.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">{i.recipient_email || "—"}</td>
                    <td className="px-4 py-3">{t[i.role]}</td>
                    <td className="px-4 py-3"><Badge variant="secondary">{t[i.status]}</Badge></td>
                    <td className="px-4 py-3 tabular-nums">{formatTime(i.created_at)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatTime(i.expires_at)}</td>
                    <td className="px-4 py-3" title={i.accepted_email || undefined}>{i.accepted_display_name || i.accepted_email || i.accepted_by || "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{processedAt == null ? "—" : formatTime(processedAt)}</td>
                    <td className="px-4 py-3">{i.status === "pending" ? <Button size="sm" variant="outline" disabled={busy}
                      onClick={() => void change(() => api.revoke(project.id, i.id))}>{t.revoke}</Button> : "—"}</td>
                  </tr>;
                })}
                {visibleInvites.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-muted-foreground">{t.none}</td></tr>}
              </tbody>
            </table>
          </div>
          {visibleInvites.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p role="status" className="tabular-nums text-muted-foreground">{(currentPage - 1) * 10 + 1}–{Math.min(currentPage * 10, visibleInvites.length)} / {visibleInvites.length}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={busy || currentPage === 1} onClick={() => setPage(currentPage - 1)}>{t.previous}</Button>
              <Button size="sm" variant="outline" disabled={busy || currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>{t.next}</Button>
            </div>
          </div>}
        </>}
      </CardContent>
    </Card>
    </>
  );
}

export function AcceptProjectInvitation({ lang }: { lang: "ko" | "en" }) {
  const t = copy[lang],
    location = useLocation(),
    navigate = useNavigate();
  const token = new URLSearchParams(location.hash.slice(1)).get("invite");
  const { reloadProjects, setCurrentProjectId } = useProject();
  const [preview, setPreview] = useState<{
    name: string;
    role: ProjectRole;
  } | null>(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setPreview(await api.preview(token));
    } catch (e) {
      setError(e instanceof Error && e.message === "410" ? t.invalid : t.error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (token) void load();
  }, [token, lang]);
  if (!token) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.acceptTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p role="status">{t.load}</p>
        ) : (
          <>
            {preview && (
              <>
                <p className="break-words font-semibold">{preview.name}</p>
                <p>
                  {t.role}: {t[preview.role]}
                </p>
                <p className="max-w-prose text-sm text-muted-foreground">
                  {t.permission}
                </p>
              </>
            )}
            {error && (
              <div role="alert">
                <p className="text-destructive">{error}</p>
                <Button variant="outline" disabled={busy} onClick={load}>
                  {t.retry}
                </Button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy || !preview}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    const project = await api.accept(token);
                    await reloadProjects();
                    setCurrentProjectId(project.id);
                    navigate("/experiments", { replace: true });
                  } catch (e) {
                    setError(e instanceof Error && e.message === "410" ? t.invalid
                      : e instanceof Error && e.message === "403" ? t.wrongAccount : t.error);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? t.busy : t.accept}
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => navigate("/projects", { replace: true })}
              >
                {t.later}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

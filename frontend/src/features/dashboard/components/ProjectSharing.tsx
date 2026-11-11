import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    create: "초대 링크 만들기",
    busy: "처리 중...",
    close: "닫기",
    load: "불러오는 중...",
    retry: "다시 시도",
    error:
      "요청을 완료하지 못했습니다. 권한과 연결을 확인한 뒤 다시 시도하세요.",
    hint: "링크를 가진 한 계정이 수락할 수 있으며 7일 후 만료됩니다. 원하는 사람에게만 전달하세요.",
    permission:
      "조회자는 실험·결과를 보고, 편집자는 실험·플래그와 공개 SDK 키를 관리합니다. 초대·멤버·프로젝트 설정은 소유자만 관리합니다.",
    link: "초대 링크",
    copy: "링크 복사",
    copied: "복사됨",
    copyError: "복사하지 못했습니다. 링크를 선택해 직접 복사하세요.",
    members: "멤버",
    remove: "멤버 제거",
    removeConfirm: "이 멤버의 프로젝트 접근 권한을 제거할까요?",
    history: "초대 이력",
    pending: "대기",
    accepted: "수락",
    expired: "만료",
    revoked: "회수",
    filter: "초대 상태",
    allStatus: "모든 상태",
    refresh: "새로고침",
    created: "발급 시각",
    acceptedAt: "수락 시각",
    acceptedBy: "수락한 계정",
    revokedAt: "회수 시각",
    none: "조건에 맞는 초대 이력이 없습니다.",
    revoke: "초대 회수",
    expires: "만료",
    acceptTitle: "프로젝트 초대",
    accept: "초대 수락",
    decline: "나중에",
    invalid: "만료·회수·사용된 초대입니다. 소유자에게 새 링크를 요청하세요.",
    joined: "프로젝트에 참여했습니다.",
  },
  en: {
    title: "Project sharing",
    owner: "Owner",
    viewer: "Viewer",
    editor: "Editor",
    role: "Invitation role",
    create: "Create invitation link",
    busy: "Working...",
    close: "Close",
    load: "Loading...",
    retry: "Retry",
    error:
      "Could not complete the request. Check your access and connection, then retry.",
    hint: "One account can accept this link. It expires in 7 days. Share it only with the intended person.",
    permission:
      "Viewers read experiments and results. Editors manage experiments, flags and the public SDK key. Only owners manage invitations, members and project settings.",
    link: "Invitation link",
    copy: "Copy link",
    copied: "Copied",
    copyError: "Could not copy. Select the link and copy it manually.",
    members: "Members",
    remove: "Remove member",
    removeConfirm: "Remove this member’s project access?",
    history: "Invitation history",
    pending: "Pending",
    accepted: "Accepted",
    expired: "Expired",
    revoked: "Revoked",
    filter: "Invitation status",
    allStatus: "All statuses",
    refresh: "Refresh",
    created: "Created",
    acceptedAt: "Accepted at",
    acceptedBy: "Accepted by",
    revokedAt: "Revoked at",
    none: "No invitations match this filter.",
    revoke: "Revoke invitation",
    expires: "Expires",
    acceptTitle: "Project invitation",
    accept: "Accept invitation",
    decline: "Later",
    invalid:
      "This invitation has expired, been revoked or been used. Ask the owner for a new link.",
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
  onClose: () => void;
}) {
  const t = copy[lang];
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [invites, setInvites] = useState<ProjectInvitation[]>([]);
  const [statusFilter, setStatusFilter] = useState<
    ProjectInvitation["status"] | "all"
  >("all");
  const visibleInvites = invites.filter(
    (i) => statusFilter === "all" || i.status === statusFilter,
  );
  const formatTime = (seconds: number) =>
    new Date(seconds * 1000).toLocaleString(lang === "ko" ? "ko-KR" : "en-US");
  const [role, setRole] = useState<ProjectRole>("viewer");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [link, setLink] = useState("");
  const [linkId, setLinkId] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
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
  const create = () =>
    change(async () => {
      const invitation = await api.invite(project.id, role);
      // Fragment is not sent to the web server or in Referer headers.
      setLink(`${window.location.origin}/projects#invite=${invitation.token}`);
      setLinkId(invitation.id);
      setCopyState("idle");
    });
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="min-w-0">
          <CardTitle className="text-lg">{t.title}</CardTitle>
          <p className="mt-1 break-words text-sm text-muted-foreground">
            {project.name}
          </p>
        </div>
        <Button variant="ghost" onClick={onClose}>
          {t.close}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="max-w-prose text-sm text-muted-foreground">
          {t.permission}
        </p>
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
            {link && (
              <div className="space-y-2">
                <label htmlFor="invitation-link" className="text-sm">
                  {t.link}
                </label>
                <Input
                  id="invitation-link"
                  value={link}
                  readOnly
                  onFocus={(e) => e.target.select()}
                />
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(link);
                      setCopyState("copied");
                    } catch {
                      setCopyState("failed");
                    }
                  }}
                >
                  {copyState === "copied" ? t.copied : t.copy}
                </Button>
                <p role="status" className="text-sm text-muted-foreground">
                  {copyState === "failed" ? t.copyError : ""}
                </p>
              </div>
            )}
            <section className="space-y-3">
              <h3 className="font-semibold">{t.members}</h3>
              <ul className="divide-y divide-border">
                {members.map((m) => (
                  <li
                    key={m.account_id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <span className="min-w-0 break-all font-mono text-xs">
                      {m.account_id}
                    </span>
                    {m.role === "owner" ? (
                      <span className="text-sm">{t.owner}</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <select
                          aria-label={`${t.role}: ${m.account_id}`}
                          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                          value={m.role}
                          disabled={busy}
                          onChange={(e) =>
                            void change(() =>
                              api.update(
                                project.id,
                                m.account_id,
                                e.target.value as ProjectRole,
                              ),
                            )
                          }
                        >
                          <option value="viewer">{t.viewer}</option>
                          <option value="editor">{t.editor}</option>
                        </select>
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
            <section className="space-y-3" aria-label={t.history}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold">{t.history}</h3>
                <Button
                  variant="outline"
                  disabled={busy || loading}
                  onClick={load}
                >
                  {t.refresh}
                </Button>
              </div>
              <label htmlFor="invitation-status" className="block text-sm">
                {t.filter}
              </label>
              <select
                id="invitation-status"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as typeof statusFilter)
                }
              >
                <option value="all">{t.allStatus}</option>
                {(["pending", "accepted", "expired", "revoked"] as const).map(
                  (status) => (
                    <option key={status} value={status}>
                      {t[status]}
                    </option>
                  ),
                )}
              </select>
              {visibleInvites.length === 0 && (
                <p className="text-sm text-muted-foreground">{t.none}</p>
              )}
              <ul className="divide-y divide-border">
                {visibleInvites.map((i) => (
                  <li key={i.id} className="space-y-3 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm font-medium">
                        {t[i.role]} ·{" "}
                        <span className="rounded bg-muted px-2 py-1 text-foreground">
                          {t[i.status]}
                        </span>
                      </span>
                      {i.status === "pending" && (
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            void change(async () => {
                              await api.revoke(project.id, i.id);
                              if (i.id === linkId) setLink("");
                            })
                          }
                        >
                          {t.revoke}
                        </Button>
                      )}
                    </div>
                    <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground">{t.created}</dt>
                        <dd>{formatTime(i.created_at)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{t.expires}</dt>
                        <dd>{formatTime(i.expires_at)}</dd>
                      </div>
                      {i.accepted_by && (
                        <>
                          <div className="min-w-0">
                            <dt className="text-muted-foreground">
                              {t.acceptedBy}
                            </dt>
                            <dd className="break-all font-mono text-xs">
                              {i.accepted_by}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">
                              {t.acceptedAt}
                            </dt>
                            <dd>
                              {i.accepted_at == null
                                ? "—"
                                : formatTime(i.accepted_at)}
                            </dd>
                          </div>
                        </>
                      )}
                      {i.revoked_at != null && (
                        <div>
                          <dt className="text-muted-foreground">
                            {t.revokedAt}
                          </dt>
                          <dd>{formatTime(i.revoked_at)}</dd>
                        </div>
                      )}
                    </dl>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </CardContent>
    </Card>
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
                    setError(
                      e instanceof Error && e.message === "410"
                        ? t.invalid
                        : t.error,
                    );
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
                {t.decline}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

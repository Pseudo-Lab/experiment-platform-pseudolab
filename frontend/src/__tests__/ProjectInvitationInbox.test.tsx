import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProjectInvitationInbox } from '@/features/dashboard/components/ProjectInvitationInbox';
import { projectSharingApi as api, type PendingProjectInvitation } from '@/services/api';
import { useProject } from '@/contexts/ProjectContext';
vi.mock('@/services/api', () => ({ projectSharingApi: { pending: vi.fn(), acceptPending: vi.fn(), decline: vi.fn() } }));
vi.mock('@/contexts/ProjectContext', () => ({ useProject: vi.fn() }));
const invitation: PendingProjectInvitation = { id: 'invitation-id', project_id: 'shared', project_name: 'Causal Hub', role: 'editor', inviter_name: '초대한 사람', created_at: 100, expires_at: 9999999999 };
const reload = vi.fn(), select = vi.fn();
function show(lang: 'ko' | 'en' = 'en') {
 return render(<MemoryRouter initialEntries={['/projects']}><ProjectInvitationInbox lang={lang} /><Routes><Route path="/projects" element={<p>Project page</p>} /><Route path="/experiments" element={<p>Experiment destination</p>} /></Routes></MemoryRouter>);
}
beforeEach(() => { vi.resetAllMocks(); vi.mocked(useProject).mockReturnValue({ reloadProjects: reload, setCurrentProjectId: select } as any); vi.mocked(api.pending).mockResolvedValue([invitation]); });
afterEach(cleanup);
it.each(['ko', 'en'] as const)('discovers invitations without a URL token and explicitly accepts in %s', async lang => {
 vi.mocked(api.acceptPending).mockResolvedValue({ id: 'shared' } as any);
 show(lang);
 expect(await screen.findByText('Causal Hub')).toBeVisible();
 expect(screen.getByText(lang === 'ko' ? '초대한 사람: 초대한 사람 · 편집자' : 'Invited by: 초대한 사람 · Editor')).toBeVisible();
 expect(api.acceptPending).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button', { name: lang === 'ko' ? '수락' : 'Accept' }));
 expect(await screen.findByText('Experiment destination')).toBeVisible();
 expect(api.acceptPending).toHaveBeenCalledWith('invitation-id');expect(reload).toHaveBeenCalled();expect(select).toHaveBeenCalledWith('shared');
});
it.each(['ko', 'en'] as const)('declines without joining or changing project scope in %s', async lang => {
 show(lang);await screen.findByText('Causal Hub');
 fireEvent.click(screen.getByRole('button', { name: lang === 'ko' ? '거절' : 'Decline' }));
 expect(await screen.findByText(lang === 'ko' ? '초대를 거절했습니다.' : 'Invitation declined.')).toBeVisible();
 expect(screen.queryByText('Causal Hub')).not.toBeInTheDocument();expect(api.decline).toHaveBeenCalledWith('invitation-id');expect(select).not.toHaveBeenCalled();expect(reload).not.toHaveBeenCalled();
});
it('renders no permanent panel for an empty inbox', async () => {
 vi.mocked(api.pending).mockResolvedValue([]);show();await waitFor(() => expect(screen.queryByRole('region', { name: 'Project invitations' })).not.toBeInTheDocument());
});
it('retries a failed inbox fetch', async () => {
 vi.mocked(api.pending).mockRejectedValueOnce(new Error('503')).mockResolvedValueOnce([invitation]);show();
 fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));expect(await screen.findByText('Causal Hub')).toBeVisible();
});
it('keeps a failed action available for retry without claiming membership', async () => {
 vi.mocked(api.acceptPending).mockRejectedValue(new Error('503'));show();await screen.findByText('Causal Hub');fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
 expect(await screen.findByRole('alert')).toHaveTextContent('Could not check invitations');expect(screen.getByText('Causal Hub')).toBeVisible();expect(select).not.toHaveBeenCalled();
});
it('explains an expired or revoked race and refreshes stale invitations', async () => {
 vi.mocked(api.acceptPending).mockRejectedValue(new Error('410'));show();await screen.findByText('Causal Hub');fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
 expect(await screen.findByRole('alert')).toHaveTextContent('expired or was revoked');vi.mocked(api.pending).mockResolvedValue([]);fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
 await waitFor(() => expect(screen.queryByText('Causal Hub')).not.toBeInTheDocument());expect(select).not.toHaveBeenCalled();
});
it('prevents double actions while accepting', async () => {
 let finish!: (value: any) => void;vi.mocked(api.acceptPending).mockReturnValue(new Promise(resolve => { finish = resolve; }));show();await screen.findByText('Causal Hub');fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
 expect(screen.getByRole('button', { name: 'Decline' })).toBeDisabled();expect(screen.getByRole('button', { name: 'Working...' })).toBeDisabled();expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
 await act(async () => finish({ id: 'shared' }));
});
it('ignores an old inbox response after a newer focus refresh', async () => {
 let old!: (value: any) => void;vi.mocked(api.pending).mockReturnValueOnce(new Promise(resolve => { old = resolve; })).mockResolvedValueOnce([]);show();
 fireEvent(window, new Event('focus'));await waitFor(() => expect(api.pending).toHaveBeenCalledTimes(2));await act(async () => old([invitation]));expect(screen.queryByText('Causal Hub')).not.toBeInTheDocument();
});
it('ignores an action response after an account component is unmounted', async () => {
 let finish!: (value: any) => void;vi.mocked(api.acceptPending).mockReturnValue(new Promise(resolve => { finish = resolve; }));const view=show();await screen.findByText('Causal Hub');fireEvent.click(screen.getByRole('button', { name: 'Accept' }));view.unmount();await act(async () => finish({ id: 'shared' }));expect(select).not.toHaveBeenCalled();expect(reload).not.toHaveBeenCalled();
});

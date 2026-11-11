import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProjectSharing, AcceptProjectInvitation } from '@/features/dashboard/components/ProjectSharing';
import { projectSharingApi as api } from '@/services/api';
import { useProject } from '@/contexts/ProjectContext';

vi.mock('@/services/api', () => ({ projectSharingApi: { members: vi.fn(), invitations: vi.fn(), invite: vi.fn(), revoke: vi.fn(), update: vi.fn(), remove: vi.fn(), preview: vi.fn(), accept: vi.fn() } }));
vi.mock('@/contexts/ProjectContext', () => ({ useProject: vi.fn() }));
const project = { id: 'shared', name: 'Hub', project_type: 'ab_test' as const, created_at: '2026-11-12' };
const reload = vi.fn(), select = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useProject).mockReturnValue({ reloadProjects: reload, setCurrentProjectId: select } as any);
  vi.mocked(api.members).mockResolvedValue([{ account_id: 'owner', role: 'owner' }, { account_id: 'member', role: 'viewer' }]);
  vi.mocked(api.invitations).mockResolvedValue([]);
});
afterEach(cleanup);

it.each(['ko', 'en'] as const)('creates a viewer link without exposing a token in the request URL in %s', async lang => {
  vi.mocked(api.invite).mockResolvedValue({ id: 'invite', token: 'synthetic-token' } as any);
  render(<ProjectSharing project={project} lang={lang} onClose={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: lang === 'ko' ? '초대 링크 만들기' : 'Create invitation link' }));
  await waitFor(() => expect(api.invite).toHaveBeenCalledWith('shared', 'viewer'));
  const input = await screen.findByLabelText(lang === 'ko' ? '초대 링크' : 'Invitation link');
  expect((input as HTMLInputElement).value).toBe(`${window.location.origin}/projects#invite=synthetic-token`);
});

it('changes and removes members, while the owner has no role control', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<ProjectSharing project={project} lang="en" onClose={vi.fn()} />);
  fireEvent.change(await screen.findByLabelText('Invitation role: member'), { target: { value: 'editor' } });
  await waitFor(() => expect(api.update).toHaveBeenCalledWith('shared', 'member', 'editor'));
  expect(screen.queryByLabelText('Invitation role: owner')).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Remove member' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Remove member' }));
  await waitFor(() => expect(api.remove).toHaveBeenCalledWith('shared', 'member'));
});

it('preserves the invitation link after a clipboard failure', async () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error()) } });
  vi.mocked(api.invite).mockResolvedValue({ id: 'invite', token: 'synthetic-token' } as any);
  render(<ProjectSharing project={project} lang="en" onClose={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Create invitation link' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create invitation link' })).toBeEnabled());
  fireEvent.click(await screen.findByRole('button', { name: 'Copy link' }));
  expect(await screen.findByText('Could not copy. Select the link and copy it manually.')).toBeVisible();
  expect((screen.getByLabelText('Invitation link') as HTMLInputElement).value).toContain('#invite=');
});

it('shows a loading error and can retry', async () => {
  vi.mocked(api.members).mockRejectedValueOnce(new Error());
  render(<ProjectSharing project={project} lang="en" onClose={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  expect(await screen.findByRole('button', { name: 'Create invitation link' })).toBeVisible();
});

it.each(['ko', 'en'] as const)('previews and explicitly accepts an invitation in %s', async lang => {
  vi.mocked(api.preview).mockResolvedValue({ name: 'Hub', role: 'viewer', expires_at: 123 });
  vi.mocked(api.accept).mockResolvedValue(project);
  render(<MemoryRouter initialEntries={['/projects#invite=synthetic-token']}><Routes><Route path="/projects" element={<AcceptProjectInvitation lang={lang} />} /><Route path="/experiments" element={<p>Joined destination</p>} /></Routes></MemoryRouter>);
  expect(await screen.findByText('Hub')).toBeVisible();
  expect(api.accept).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: lang === 'ko' ? '초대 수락' : 'Accept invitation' }));
  expect(await screen.findByText('Joined destination')).toBeVisible();
  expect(api.accept).toHaveBeenCalledWith('synthetic-token');
  expect(reload).toHaveBeenCalled(); expect(select).toHaveBeenCalledWith('shared');
});

it('cannot accept an expired or revoked invitation', async () => {
  vi.mocked(api.preview).mockRejectedValue(new Error('410'));
  render(<MemoryRouter initialEntries={['/projects#invite=expired']}><AcceptProjectInvitation lang="en" /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('expired');
  expect(screen.getByRole('button', { name: 'Accept invitation' })).toBeDisabled();
  expect(api.accept).not.toHaveBeenCalled();
});

it.each(['ko', 'en'] as const)('shows and filters all invitation states with recipient details in %s', async lang => {
  const now = Math.floor(Date.now() / 1000);
  vi.mocked(api.invitations).mockResolvedValue(['pending', 'accepted', 'expired', 'revoked'].map(status => ({
    id: status, project_id: 'shared', role: 'viewer', status,
    created_at: now - 604800, expires_at: status === 'pending' ? now + 500 : now - 1,
    accepted_by: status === 'accepted' ? 'recipient-account' : null,
    accepted_at: status === 'accepted' ? now - 100 : null,
    revoked_at: status === 'revoked' ? now - 200 : null,
  })) as any);
  render(<ProjectSharing project={project} lang={lang} onClose={vi.fn()} />);
  const region = await screen.findByRole('region', { name: lang === 'ko' ? '초대 이력' : 'Invitation history' });
  expect(within(region).getAllByRole('listitem')).toHaveLength(4);
  expect(within(region).getByText('recipient-account')).toBeVisible();
  expect(within(region).getByText(lang === 'ko' ? '수락 시각' : 'Accepted at')).toBeVisible();
  expect(within(region).getAllByText(lang === 'ko' ? '발급 시각' : 'Created')).toHaveLength(4);
  expect(within(region).getAllByRole('button', { name: lang === 'ko' ? '초대 회수' : 'Revoke invitation' })).toHaveLength(1);
  fireEvent.change(within(region).getByLabelText(lang === 'ko' ? '초대 상태' : 'Invitation status'), { target: { value: 'accepted' } });
  expect(within(region).getAllByRole('listitem')).toHaveLength(1);
  expect(within(region).getByText('recipient-account')).toBeVisible();
  expect(within(region).queryByRole('button', { name: lang === 'ko' ? '초대 회수' : 'Revoke invitation' })).not.toBeInTheDocument();
  fireEvent.change(within(region).getByLabelText(lang === 'ko' ? '초대 상태' : 'Invitation status'), { target: { value: 'revoked' } });
  expect(within(region).getAllByRole('listitem')).toHaveLength(1);
  expect(within(region).getByText(lang === 'ko' ? '회수 시각' : 'Revoked at')).toBeVisible();
});

it('refreshes history and keeps the selected state filter', async () => {
  vi.mocked(api.invitations).mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'accepted', role: 'editor', status: 'accepted', created_at: 100, expires_at: 604900, accepted_by: 'recipient', accepted_at: 200 }] as any);
  render(<ProjectSharing project={project} lang="en" onClose={vi.fn()} />);
  fireEvent.change(await screen.findByLabelText('Invitation status'), { target: { value: 'accepted' } });
  expect(screen.getByText('No invitations match this filter.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(await screen.findByText('recipient')).toBeVisible();
  expect(screen.getByLabelText('Invitation status')).toHaveValue('accepted');
});

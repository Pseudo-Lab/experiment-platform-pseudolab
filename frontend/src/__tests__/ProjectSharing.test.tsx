import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

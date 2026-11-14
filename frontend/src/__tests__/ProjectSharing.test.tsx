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

it.each(['ko', 'en'] as const)('creates an email invitation without a link in %s', async lang => {
  vi.mocked(api.invite).mockResolvedValue({ id: 'invite', token: 'synthetic-token' } as any);
  render(<ProjectSharing project={project} lang={lang} onClose={vi.fn()} />);
  fireEvent.change(await screen.findByLabelText(lang === 'ko' ? '초대할 Google 계정 이메일' : 'Google account email to invite'), { target: { value: 'Member@Gmail.com' } });
  fireEvent.click(await screen.findByRole('button', { name: lang === 'ko' ? '이메일로 초대' : 'Invite by email' }));
  await waitFor(() => expect(api.invite).toHaveBeenCalledWith('shared', 'viewer', 'member@gmail.com'));
  expect(await screen.findByText(lang === 'ko' ? '초대를 등록했습니다. 상대가 해당 이메일로 로그인하면 확인할 수 있습니다.' : 'Invitation created. They can find it after signing in with this email.')).toBeVisible();
  expect(screen.queryByLabelText(lang === 'ko' ? '초대 링크' : 'Invitation link')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: lang === 'ko' ? '링크 복사' : 'Copy link' })).not.toBeInTheDocument();
});

it('changes and removes members, while the owner has no role control', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<ProjectSharing project={project} lang="en" onClose={vi.fn()} />);
  fireEvent.keyDown(await screen.findByRole('button', { name: 'Change role: member' }), { key: 'Enter' });
  fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Editor' }));
  await waitFor(() => expect(api.update).toHaveBeenCalledWith('shared', 'member', 'editor'));
  expect(screen.queryByRole('button', { name: 'Change role: owner' })).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Remove member' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Remove member' }));
  await waitFor(() => expect(api.remove).toHaveBeenCalledWith('shared', 'member'));
});

it('keeps the email when invitation creation fails and can retry', async () => {
  vi.mocked(api.invite).mockRejectedValueOnce(new Error('503')).mockResolvedValueOnce({ id: 'invite' } as any);
  render(<ProjectSharing project={project} lang="en" onClose={vi.fn()} />);
  fireEvent.change(await screen.findByLabelText('Google account email to invite'), { target: { value: 'member@gmail.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Invite by email' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not complete');
  expect(screen.getByLabelText('Google account email to invite')).toHaveValue('member@gmail.com');
  fireEvent.click(screen.getByRole('button', { name: 'Invite by email' }));
  expect(await screen.findByText('Invitation created. They can find it after signing in with this email.')).toBeVisible();
  expect(screen.getByLabelText('Google account email to invite')).toHaveValue('');
});

it('shows a loading error and can retry', async () => {
  vi.mocked(api.members).mockRejectedValueOnce(new Error());
  render(<ProjectSharing project={project} lang="en" onClose={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  expect(await screen.findByRole('button', { name: 'Invite by email' })).toBeVisible();
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
  vi.mocked(api.invitations).mockResolvedValue(['pending', 'accepted', 'expired', 'revoked', 'declined'].map(status => ({
    id: status, project_id: 'shared', role: 'viewer', status,
    created_at: now - 604800, expires_at: status === 'pending' ? now + 500 : now - 1,
    accepted_by: status === 'accepted' ? 'recipient-account' : null,
    accepted_at: status === 'accepted' ? now - 100 : null,
    revoked_at: status === 'revoked' ? now - 200 : null,
  })) as any);
  render(<ProjectSharing project={project} lang={lang} onClose={vi.fn()} />);
  const region = await screen.findByRole('region', { name: lang === 'ko' ? '초대 이력' : 'Invitation history' });
  expect(within(region).getAllByRole('row')).toHaveLength(6);
  expect(within(region).getByText('recipient-account')).toBeVisible();
  expect(within(region).getByText(lang === 'ko' ? '처리 시각' : 'Processed at')).toBeVisible();
  expect(within(region).getAllByText(lang === 'ko' ? '발급 시각' : 'Created')).toHaveLength(1);
  expect(within(region).getAllByRole('button', { name: lang === 'ko' ? '초대 회수' : 'Revoke invitation' })).toHaveLength(1);
  fireEvent.click(within(within(region).getByRole('group', { name: lang === 'ko' ? '초대 상태' : 'Invitation status' })).getByRole('button', { name: lang === 'ko' ? '수락' : 'Accepted' }));
  expect(within(region).getAllByRole('row')).toHaveLength(2);
  expect(within(region).getByText('recipient-account')).toBeVisible();
  expect(within(region).queryByRole('button', { name: lang === 'ko' ? '초대 회수' : 'Revoke invitation' })).not.toBeInTheDocument();
  fireEvent.click(within(within(region).getByRole('group', { name: lang === 'ko' ? '초대 상태' : 'Invitation status' })).getByRole('button', { name: lang === 'ko' ? '회수' : 'Revoked' }));
  expect(within(region).getAllByRole('row')).toHaveLength(2);
  expect(within(region).getByText(lang === 'ko' ? '처리 시각' : 'Processed at')).toBeVisible();
});

it('refreshes history and keeps the selected state filter', async () => {
  vi.mocked(api.invitations).mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'accepted', role: 'editor', status: 'accepted', created_at: 100, expires_at: 604900, accepted_by: 'recipient', accepted_at: 200 }] as any);
  render(<ProjectSharing project={project} lang="en" onClose={vi.fn()} />);
  fireEvent.click(within(await screen.findByRole('group', { name: 'Invitation status' })).getByRole('button', { name: 'Accepted' }));
  expect(screen.getByText('No invitations match this filter.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(await screen.findByText('recipient')).toBeVisible();
  expect(within(screen.getByRole('group', { name: 'Invitation status' })).getByRole('button', { name: 'Accepted' })).toHaveAttribute('aria-pressed', 'true');
});

it.each(['ko', 'en'] as const)('shows Google names, emails and invitation recipients in %s', async lang => {
  vi.mocked(api.members).mockResolvedValue([
    { account_id: 'owner', role: 'owner', display_name: '프로젝트 소유자', email: 'owner@gmail.com' },
    { account_id: 'member', role: 'viewer', display_name: '동명이인', email: 'member@gmail.com' },
  ]);
  vi.mocked(api.invitations).mockResolvedValue([{
    id: 'accepted', project_id: 'shared', role: 'viewer', status: 'accepted', created_at: 100, expires_at: 604900,
    accepted_at: 200, accepted_by: 'removed-member', revoked_at: null, recipient_email: 'former@gmail.com',
    accepted_display_name: '이전 멤버', accepted_email: 'former@gmail.com',
  }]);
  render(<ProjectSharing project={project} lang={lang} onClose={vi.fn()} />);
  expect(await screen.findByText('동명이인')).toBeVisible();
  expect(screen.getByText('member@gmail.com')).toBeVisible();
  const memberRow = screen.getByText('동명이인').closest('li')!;
  expect(within(memberRow).getByText(lang === 'ko' ? '조회자' : 'Viewer')).toBeVisible();
  expect(within(screen.getByText('프로젝트 소유자').closest('li')!).getByText(lang === 'ko' ? '소유자' : 'Owner')).toBeVisible();
  fireEvent.keyDown(screen.getByRole('button', { name: `${lang === 'ko' ? '권한 변경' : 'Change role'}: 동명이인` }), { key: 'Enter' });
  expect(await screen.findByRole('menuitemradio', { name: lang === 'ko' ? '조회자' : 'Viewer' })).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(screen.getByRole('menuitemradio', { name: lang === 'ko' ? '편집자' : 'Editor' }));
  await waitFor(() => expect(api.update).toHaveBeenCalledWith('shared', 'member', 'editor'));
  const history = screen.getByRole('region', { name: lang === 'ko' ? '초대 이력' : 'Invitation history' });
  expect(within(history).getByText('이전 멤버')).toBeVisible();
  expect(within(history).getByText('former@gmail.com')).toBeVisible();
  expect(within(history).getByText('이전 멤버')).toHaveAttribute('title', 'former@gmail.com');
  expect(within(history).queryByText('removed-member')).not.toBeInTheDocument();
});

it('uses email once when a Google display name is missing', async () => {
  vi.mocked(api.members).mockResolvedValue([{ account_id: 'member', role: 'viewer', display_name: null, email: 'member@gmail.com' }]);
  render(<ProjectSharing project={project} lang="en" onClose={vi.fn()} />);
  expect(await screen.findByText('member@gmail.com')).toBeVisible();
  expect(screen.getAllByText('member@gmail.com')).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Change role: member@gmail.com' })).toBeVisible();
});

it('keeps the current role when dismissed or when an update fails', async () => {
  vi.mocked(api.update).mockRejectedValue(new Error('503'));
  render(<ProjectSharing project={project} lang="en" onClose={vi.fn()} />);
  const button = await screen.findByRole('button', { name: 'Change role: member' });
  fireEvent.keyDown(button, { key: 'Enter' });
  fireEvent.keyDown(await screen.findByRole('menuitemradio', { name: 'Viewer' }), { key: 'Escape' });
  expect(api.update).not.toHaveBeenCalled();
  fireEvent.keyDown(button, { key: 'Enter' });
  fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Editor' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not complete');
  expect(within(screen.getByText('member').closest('li')!).getByText('Viewer')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Change role: member' })).toBeEnabled();
});

it('validates the recipient before creating an invitation', async () => {
  render(<ProjectSharing project={project} lang="en" onClose={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Invite by email' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
  expect(api.invite).not.toHaveBeenCalled();
});

it.each(['ko', 'en'] as const)('explains a recipient-account mismatch in %s', async lang => {
  vi.mocked(api.preview).mockResolvedValue({ name: 'Hub', role: 'viewer', expires_at: 123 });
  vi.mocked(api.accept).mockRejectedValue(new Error('403'));
  render(<MemoryRouter initialEntries={['/projects#invite=synthetic-token']}><AcceptProjectInvitation lang={lang} /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: lang === 'ko' ? '초대 수락' : 'Accept invitation' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(lang === 'ko' ? '초대받은 이메일의 Google 계정' : 'invited Google email account');
  expect(reload).not.toHaveBeenCalled();
  expect(select).not.toHaveBeenCalled();
});


it.each(['ko', 'en'] as const)('separates history from member management and exposes all single-choice filters in %s', async lang => {
  render(<ProjectSharing project={project} lang={lang} onClose={vi.fn()} />);
  await screen.findByRole('button', { name: lang === 'ko' ? '이메일로 초대' : 'Invite by email' });
  const management = screen.getByRole('region', { name: lang === 'ko' ? '프로젝트 공유' : 'Project sharing' });
  const history = screen.getByRole('region', { name: lang === 'ko' ? '초대 이력' : 'Invitation history' });
  expect(management).not.toContainElement(history);
  expect(within(history).queryByText('member')).not.toBeInTheDocument();
  const filters = within(history).getByRole('group', { name: lang === 'ko' ? '초대 상태' : 'Invitation status' });
  expect(within(filters).getAllByRole('button')).toHaveLength(6);
  expect(within(filters).getAllByRole('button', { pressed: true })).toHaveLength(1);
  fireEvent.click(within(filters).getByRole('button', { name: lang === 'ko' ? '거절' : 'Declined' }));
  expect(within(filters).getAllByRole('button', { pressed: true })).toHaveLength(1);
  expect(within(filters).getByRole('button', { name: lang === 'ko' ? '거절' : 'Declined' })).toHaveAttribute('aria-pressed', 'true');
  expect(within(history).getByText(lang === 'ko' ? '조건에 맞는 초대 이력이 없습니다.' : 'No invitations match this filter.')).toBeVisible();
});


it('limits history to ten rows and returns to page one when the status changes', async () => {
  vi.mocked(api.invitations).mockResolvedValue(Array.from({ length: 23 }, (_, n) => ({
    id: String(n), project_id: 'shared', role: 'viewer', status: n < 12 ? 'accepted' : 'declined',
    recipient_email: `person${n}@gmail.com`, created_at: 100, expires_at: 604900,
    revoked_at: null, accepted_at: n < 12 ? 200 : null, accepted_by: n < 12 ? `person${n}` : null,
  })) as any);
  render(<ProjectSharing project={project} lang="en" onClose={vi.fn()} />);
  const history = screen.getByRole('region', { name: 'Invitation history' });
  await within(history).findByText('person0@gmail.com');
  expect(within(history).getAllByRole('row')).toHaveLength(11);
  expect(within(history).getByRole('button', { name: 'Previous' })).toBeDisabled();
  fireEvent.click(within(history).getByRole('button', { name: 'Next' }));
  expect(within(history).getByText('person10@gmail.com')).toBeVisible();
  expect(within(history).queryByText('person0@gmail.com')).not.toBeInTheDocument();
  fireEvent.click(within(history).getByRole('button', { name: 'Next' }));
  expect(within(history).getAllByRole('row')).toHaveLength(4);
  expect(within(history).getByRole('button', { name: 'Next' })).toBeDisabled();
  fireEvent.click(within(within(history).getByRole('group', { name: 'Invitation status' })).getByRole('button', { name: 'Accepted' }));
  expect(within(history).getByText('person0@gmail.com')).toBeVisible();
  expect(within(history).getByRole('status')).toHaveTextContent('1–10 / 12');
});

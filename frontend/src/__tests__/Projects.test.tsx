import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Projects } from '@/features/dashboard/components/Projects';
import { projectApi } from '@/services/api';

vi.mock('@/services/api', () => ({ projectApi: { create: vi.fn(), sdkStatus: vi.fn() } }));
vi.mock('@/contexts/ProjectContext', () => {
  const context = { projects: [], loading: false, reloadProjects: vi.fn(), setCurrentProjectId: vi.fn() };
  return { useProject: () => context };
});
function RouteLocation() { return <output data-testid="location">{useLocation().search}</output>; }
function show(path: string, lang: 'ko' | 'en' = 'ko') {
  render(<MemoryRouter initialEntries={[path]}><Projects lang={lang} /><RouteLocation /></MemoryRouter>);
}
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('opens the existing create form directly and removes only its query on cancel', () => {
  show('/projects?create=1&keep=yes');
  expect(screen.getByLabelText('프로젝트 ID')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '취소' }));
  expect(screen.queryByLabelText('프로젝트 ID')).not.toBeInTheDocument();
  expect(screen.getByTestId('location')).toHaveTextContent('?keep=yes');
});

it('opens management without the form and allows adding a project in English', () => {
  show('/projects', 'en');
  expect(screen.getByRole('heading', { name: 'Project management' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Project ID')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add Project' }));
  expect(screen.getByLabelText('Project ID')).toBeInTheDocument();
});

it('keeps the form on failure and closes it after a successful retry', async () => {
  vi.mocked(projectApi.create).mockRejectedValueOnce(new Error('Create failed')).mockResolvedValueOnce({} as any);
  show('/projects?create=1');
  fireEvent.change(screen.getByLabelText('프로젝트 ID'), { target: { value: 'new-app' } });
  fireEvent.change(screen.getByLabelText('프로젝트 이름'), { target: { value: 'New App' } });
  fireEvent.click(screen.getByRole('button', { name: '생성' }));
  expect(await screen.findByText('Create failed')).toBeInTheDocument();
  expect(screen.getByLabelText('프로젝트 ID')).toHaveValue('new-app');
  fireEvent.click(screen.getByRole('button', { name: '생성' }));
  await waitFor(() => expect(screen.queryByLabelText('프로젝트 ID')).not.toBeInTheDocument());
  expect(screen.getByTestId('location')).toBeEmptyDOMElement();
});

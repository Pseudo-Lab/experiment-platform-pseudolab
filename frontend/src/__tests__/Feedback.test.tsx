import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { BugReport } from '@/features/dashboard/components/BugReport';
import { BugReportDetail } from '@/features/dashboard/components/BugReportDetail';
import { bugReportApi } from '@/services/api';
vi.mock('@/services/api', () => ({ bugReportApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), addComment: vi.fn(), update: vi.fn(), uploadAttachment: vi.fn(), delete: vi.fn() } }));
const report = { id:'one', title:'Broken button', description:'Steps', category:'functional', severity:'minor', status:'reported', attachments:[], comments:[], created_at:'2026-11-05T01:00:00Z', updated_at:'2026-11-05T01:00:00Z' } as any;
function show(lang: 'ko'|'en'='ko', detail=false, admin=false) {
  render(<MemoryRouter initialEntries={[detail ? '/bug-report/one' : '/bug-report']}><Routes>
    <Route path="/bug-report" element={<BugReport lang={lang} />} />
    <Route path="/bug-report/:id" element={<BugReportDetail lang={lang} isAdmin={admin} />} />
  </Routes></MemoryRouter>);
}
beforeEach(() => { vi.mocked(bugReportApi.list).mockResolvedValue([]); vi.mocked(bugReportApi.get).mockResolvedValue(report); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it('shows Korean empty state and labelled form with sharing guidance', async () => {
  show(); await screen.findByText('등록된 버그·건의가 없습니다.'); fireEvent.click(screen.getByRole('button',{name:'등록하기'}));
  expect(screen.getByLabelText('제목')).toBeInTheDocument(); expect(screen.getByLabelText('내용')).toBeInTheDocument();
  expect(screen.getByText(/비밀번호·SDK 비밀 키/)).toBeInTheDocument(); expect(screen.getByRole('button',{name:'등록'})).toBeDisabled();
});
it('keeps failed submission and retries successfully to detail', async () => {
  vi.mocked(bugReportApi.create).mockRejectedValueOnce(new Error('internal')).mockResolvedValueOnce(report);
  show(); await screen.findByText('등록된 버그·건의가 없습니다.'); fireEvent.click(screen.getByRole('button',{name:'등록하기'}));
  fireEvent.change(screen.getByLabelText('제목'),{target:{value:'Suggestion'}}); fireEvent.change(screen.getByLabelText('유형'),{target:{value:'suggestion'}});
  fireEvent.change(screen.getByLabelText('내용'),{target:{value:'Improve this'}}); fireEvent.click(screen.getByRole('button',{name:'등록'}));
  await screen.findByRole('alert'); expect(screen.getByLabelText('제목')).toHaveValue('Suggestion'); fireEvent.click(screen.getByRole('button',{name:'등록'}));
  await screen.findByRole('heading',{name:report.title}); expect(bugReportApi.create).toHaveBeenLastCalledWith(expect.objectContaining({category:'feature_request',description:'Improve this'}));
});
it('filters English type and status with real links', async () => {
  vi.mocked(bugReportApi.list).mockResolvedValue([report,{...report,id:'two',title:'New idea',category:'feature_request',status:'resolved'}]);
  show('en'); await screen.findByRole('link',{name:/New idea/}); fireEvent.change(screen.getByLabelText('Type'),{target:{value:'suggestion'}});
  expect(screen.queryByRole('link',{name:/Broken button/})).not.toBeInTheDocument(); expect(screen.getByRole('link',{name:/New idea/})).toHaveAttribute('href','/bug-report/two');
  fireEvent.change(screen.getByLabelText('Status'),{target:{value:'reported'}}); expect(screen.getByText('No feedback yet.')).toBeInTheDocument();
});
it('retries failed list without server error disclosure', async () => {
  vi.mocked(bugReportApi.list).mockRejectedValueOnce(new Error('secret')).mockResolvedValueOnce([report]); show('en');
  expect(await screen.findByRole('alert')).not.toHaveTextContent('secret'); fireEvent.click(screen.getByRole('button',{name:'Retry'})); await screen.findByRole('link',{name:/Broken button/});
});
it('rejects unsupported attachments before upload', async () => {
  show(); await screen.findByText('등록된 버그·건의가 없습니다.'); fireEvent.click(screen.getByRole('button',{name:'등록하기'}));
  fireEvent.change(screen.getByLabelText('스크린샷 (선택)'),{target:{files:[new File(['<svg>'],'bad.svg',{type:'image/svg+xml'})]}});
  expect(screen.getByRole('alert')).toHaveTextContent('900 KiB'); expect(bugReportApi.uploadAttachment).not.toHaveBeenCalled();
});
it('shows upload failure and permits retry', async () => {
  vi.mocked(bugReportApi.uploadAttachment).mockRejectedValue(new Error('upload')); show('en'); await screen.findByText('No feedback yet.');
  fireEvent.click(screen.getByRole('button',{name:'New feedback'})); fireEvent.change(screen.getByLabelText('Screenshots (optional)'),{target:{files:[new File(['png'],'ok.png',{type:'image/png'})]}});
  await screen.findByRole('alert'); await waitFor(() => expect(screen.getByLabelText('Screenshots (optional)')).not.toBeDisabled());
});
it('members comment without author spoof or status edit controls', async () => {
  vi.mocked(bugReportApi.addComment).mockResolvedValue({...report,comments:[{id:'c',author:'Member',content:'Thank you',created_at:report.created_at}]} as any);
  show('en',true); await screen.findByRole('heading',{name:report.title}); expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Comment'),{target:{value:'Thank you'}}); fireEvent.click(screen.getByRole('button',{name:'Post comment'}));
  await screen.findByText('Thank you'); expect(bugReportApi.addComment).toHaveBeenCalledWith('one','Thank you');
});
it('retains failed comment draft', async () => {
  vi.mocked(bugReportApi.addComment).mockRejectedValue(new Error('secret')); show('en',true); await screen.findByRole('heading',{name:report.title});
  fireEvent.change(screen.getByLabelText('Comment'),{target:{value:'My comment'}}); fireEvent.click(screen.getByRole('button',{name:'Post comment'}));
  await screen.findByRole('alert'); expect(screen.getByLabelText('Comment')).toHaveValue('My comment');
});
it('administrator updates status', async () => {
  vi.mocked(bugReportApi.update).mockResolvedValue({...report,status:'in_progress'}); show('ko',true,true); await screen.findByRole('heading',{name:report.title});
  fireEvent.change(screen.getByLabelText('처리 상태'),{target:{value:'in_progress'}}); await waitFor(() => expect(screen.getByLabelText('처리 상태')).toHaveValue('in_progress'));
  expect(bugReportApi.update).toHaveBeenCalledWith('one',{status:'in_progress'});
});
it('escapes report text and protects screenshot links', async () => {
  vi.mocked(bugReportApi.get).mockResolvedValue({...report,title:'<script>alert(1)</script>',attachments:[{key:'image',name:'Screenshot',type:'image/png',url:'/api/v1/bug-reports/attachments/x.png'}]} as any);
  show('en',true); await screen.findByRole('heading',{name:'<script>alert(1)</script>'}); expect(document.querySelector('script')).toBeNull();
  expect(screen.getByRole('link',{name:'Screenshot Screenshot'})).toHaveAttribute('rel','noopener noreferrer');
});

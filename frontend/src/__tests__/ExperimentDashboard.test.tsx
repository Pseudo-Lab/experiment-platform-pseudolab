import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ExperimentDashboard } from '@/features/dashboard/components/ExperimentDashboard';
import {
  experimentAnalyticsApi,
  experimentResultApi,
  availableEventsApi,
  decisionApi,
  type Experiment,
} from '@/services/api';

vi.mock('@/services/api', () => ({
  experimentAnalyticsApi: { get: vi.fn() },
  experimentResultApi: { getResult: vi.fn() },
  availableEventsApi: { get: vi.fn() },
  decisionApi: { list: vi.fn(), createForExperiment: vi.fn() },
}));
const experiment = { id: 'test', primary_metric: 'signup' } as Experiment;
const emptyAnalytics = {
  impressions: { total: 0, by_variant: {}, by_url: {}, time_series: [] },
  conversions: { total: 0, by_variant: {}, rate: {} },
  statistical_significance: { p_value: null },
};
const emptyEvents = {
  total_events: 0,
  event_types: [],
  conversion_events: [],
  has_impressions: false,
  has_conversions: false,
};
const setup = (
  view: 'health' | 'results' | 'decisions' = 'health',
  lang: 'en' | 'ko' = 'en',
) =>
  render(
    <MemoryRouter>
      <ExperimentDashboard
        experimentId="test"
        experiment={experiment}
        lang={lang}
        view={view}
      />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(experimentAnalyticsApi.get).mockResolvedValue(
    emptyAnalytics as any,
  );
  vi.mocked(availableEventsApi.get).mockResolvedValue(emptyEvents);
  vi.mocked(experimentResultApi.getResult).mockResolvedValue({
    sample_size: 0,
  } as any);
  vi.mocked(decisionApi.list).mockResolvedValue([]);
});
afterEach(cleanup);

it('distinguishes a failed collection request from no events and retries successfully', async () => {
  vi.mocked(availableEventsApi.get).mockRejectedValueOnce(new Error('503'));
  setup();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Collection status is unknown',
  );
  expect(
    screen.queryByText('No events have been collected yet.'),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(
    await screen.findByText('No events have been collected yet.'),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Check SDK integration' }),
  ).toHaveAttribute('href', '/api-key');
  expect(
    screen.queryByText('No allocation warning in the current aggregate.'),
  ).not.toBeInTheDocument();
});

it('does not report a healthy allocation when analytics fail', async () => {
  vi.mocked(experimentAnalyticsApi.get).mockRejectedValue(new Error('503'));
  vi.mocked(availableEventsApi.get).mockResolvedValue({
    ...emptyEvents,
    total_events: 12,
    event_types: ['signup'],
  });
  setup('health', 'ko');
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '수집 여부를 확인할 수 없습니다',
  );
  expect(screen.getByText('signup')).toBeInTheDocument();
  expect(
    screen.queryByText('현재 집계에서 배정 비율 경고가 없습니다.'),
  ).not.toBeInTheDocument();
});

it('shows a result failure instead of insufficient data', async () => {
  vi.mocked(experimentResultApi.getResult).mockRejectedValue(new Error('503'));
  setup('results');
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not load analysis results',
  );
  expect(
    screen.queryByText('Not enough exposure data to calculate results.'),
  ).not.toBeInTheDocument();
});

it('renders actual result values and both languages without a simulated sample target', async () => {
  vi.mocked(experimentResultApi.getResult).mockResolvedValue({
    sample_size: 200,
    denominator_source: 'exposure',
    uplift: 0.03,
    probability_treatment_wins: 0.78,
    judgment: 'need_more_data',
    confidence_interval: [-0.01, 0.07],
    control: {
      variant_name: 'control',
      users: 100,
      conversions: 10,
      rate: 0.1,
    },
    treatment: {
      variant_name: 'treatment',
      users: 100,
      conversions: 13,
      rate: 0.13,
    },
  } as any);
  setup('results', 'ko');
  expect(await screen.findByText('3.00 pp')).toBeInTheDocument();
  expect(screen.getByText('78.00%')).toBeInTheDocument();
  expect(
    screen.getByText('노출 이벤트를 기록한 사용자 기준'),
  ).toBeInTheDocument();
  expect(screen.getByText('13.00%')).toBeInTheDocument();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
});

it('preserves the reason on save failure and creates a decision log on retry', async () => {
  vi.mocked(decisionApi.createForExperiment)
    .mockRejectedValueOnce(new Error('503'))
    .mockResolvedValueOnce({
      id: 'decision-1',
      experiment_id: 'test',
      decision: 'HOLD',
      reason: 'Wait for more observations',
      decided_by: 'reviewer',
      decided_at: '2026-10-21T00:00:00Z',
    });
  setup('decisions');
  const field = await screen.findByLabelText('Decision reason');
  fireEvent.change(field, { target: { value: 'Wait for more observations' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save decision' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Your input has been kept',
  );
  expect(field).toHaveValue('Wait for more observations');
  fireEvent.click(screen.getByRole('button', { name: 'Save decision' }));
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Decision recorded',
  );
  expect(decisionApi.createForExperiment).toHaveBeenLastCalledWith('test', {
    decision: 'HOLD',
    reason: 'Wait for more observations',
  });
  expect(field).toHaveValue('');
  expect(screen.getByText('Wait for more observations')).toBeInTheDocument();
});

it('keeps a failed decision history distinct from an empty history', async () => {
  vi.mocked(decisionApi.list).mockRejectedValue(new Error('503'));
  setup('decisions');
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not load decision history',
  );
  expect(
    screen.queryByText('No decisions recorded yet.'),
  ).not.toBeInTheDocument();
});

it('shows member project event results without calling administrator result or decisions APIs', async () => {
  vi.mocked(experimentAnalyticsApi.get).mockResolvedValue({
    ...emptyAnalytics, impressions: { ...emptyAnalytics.impressions, total: 12 },
    conversions: { total: 3, by_variant: {}, rate: { control: 0.25 } },
  } as any);
  render(<MemoryRouter><ExperimentDashboard experimentId="test" experiment={experiment} lang="en" view="results" isAdmin={false} /></MemoryRouter>);
  expect(await screen.findByText('12')).toBeInTheDocument();
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(within(screen.getByRole('figure', { name: 'Conversion rates by group' })).getByText('No group breakdown is available. Refer to the totals.')).toBeInTheDocument();
  expect(screen.queryByText('No impressions or conversions have been counted yet.')).not.toBeInTheDocument();
  expect(experimentResultApi.getResult).not.toHaveBeenCalled();
  expect(decisionApi.list).not.toHaveBeenCalled();
});

it.each(['ko', 'en'] as const)('shows pending and finalized states for empty results in %s', async lang => {
  vi.mocked(experimentResultApi.getResult).mockResolvedValue({ sample_size: 0, readout_state: 'observing', finalizes_at: '2026-11-20T12:00:00Z' } as any);
  const first = setup('results', lang);
  await screen.findByText(lang === 'ko' ? '관찰 중' : 'Observing');
  expect(screen.getByRole('status')).toHaveTextContent(lang === 'ko' ? '관찰 중' : 'Observing');
  expect(screen.getByRole('status')).toHaveTextContent(lang === 'ko' ? '확정 가능 시각' : 'Finalization available after');
  first.unmount();
  vi.mocked(experimentResultApi.getResult).mockResolvedValue({ sample_size: 0, readout_state: 'finalized', finalizes_at: '2026-11-20T12:00:00Z' } as any);
  setup('results', lang);
  await screen.findByText(lang === 'ko' ? '결과 확정' : 'Results finalized');
  expect(screen.getByRole('status')).toHaveTextContent(lang === 'ko' ? '결과 확정' : 'Results finalized');
  expect(screen.getByRole('status')).toHaveTextContent(lang === 'ko' ? '이후 도착한 이벤트를 합산하지 않습니다' : 'Events arriving later are excluded');
  expect(screen.queryByText(/Finalization available after|확정 가능 시각/)).not.toBeInTheDocument();
});

it('uses scoped analytics metadata for member readout status and preserves the administrator API boundary', async () => {
  vi.mocked(experimentAnalyticsApi.get).mockResolvedValue({ ...emptyAnalytics, readout_state: 'observing', finalizes_at: '2026-11-20T12:00:00Z' } as any);
  render(<MemoryRouter><ExperimentDashboard experimentId="test" experiment={experiment} lang="en" view="results" isAdmin={false} /></MemoryRouter>);
  await screen.findByText('Observing');
  expect(screen.getByRole('status')).toHaveTextContent('Observing');
  expect(experimentResultApi.getResult).not.toHaveBeenCalled();
  expect(decisionApi.list).not.toHaveBeenCalled();
});

it('lets members retry a failed finalization or analytics request without showing a false finalized state', async () => {
  vi.mocked(experimentAnalyticsApi.get).mockRejectedValueOnce(new Error('503'));
  render(<MemoryRouter><ExperimentDashboard experimentId="test" experiment={experiment} lang="en" view="results" isAdmin={false} /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Collection status is unknown');
  expect(screen.queryByText('Results finalized')).not.toBeInTheDocument();
  vi.mocked(experimentAnalyticsApi.get).mockResolvedValue({ ...emptyAnalytics, readout_state: 'finalized' } as any);
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('Results finalized');
  expect(screen.getByRole('status')).toHaveTextContent('Results finalized');
  expect(experimentResultApi.getResult).not.toHaveBeenCalled();
});


it.each(['ko', 'en'] as const)('compares member event counts on one scale and keeps API rates and admin boundaries in %s', async (lang) => {
  vi.mocked(experimentAnalyticsApi.get).mockResolvedValue({
    ...emptyAnalytics,
    impressions: { ...emptyAnalytics.impressions, total: 1000, by_variant: { control: 600, treatment: 400 } },
    conversions: { total: 140, by_variant: { control: 60, treatment: 80 }, rate: { control: 0.25, treatment: 0.2 } },
  } as any);
  render(<MemoryRouter><ExperimentDashboard experimentId="test" experiment={{ ...experiment, event_model: 'sdk_v1' }} lang={lang} view="results" isAdmin={false} /></MemoryRouter>);
  const figure = await countFigure(lang);
  const rows = within(figure).getAllByRole('listitem');
  expect(rows).toHaveLength(2);
  expect(within(rows[0]).getByText('control')).toBeInTheDocument();
  expect(within(rows[0]).getByText('25.00%')).toBeInTheDocument();
  expect(within(rows[0]).getByText('600')).toBeInTheDocument();
  expect(within(rows[0]).getByText('60')).toBeInTheDocument();
  expect(within(rows[1]).getByText('400')).toBeInTheDocument();
  const bars = rows.map(row => [...row.querySelectorAll<HTMLElement>('[style]')].map(bar => Number.parseFloat(bar.style.width)));
  expect(bars[0]).toEqual([100, 10]);
  expect(bars[1][0]).toBeCloseTo(400 / 600 * 100);
  expect(bars[1][1]).toBeCloseTo(80 / 600 * 100);
  expect(screen.getByText('1,000')).toBeInTheDocument();
  expect(screen.getByText('140')).toBeInTheDocument();
  expect(screen.queryByText(lang === 'ko' ? '이벤트 집계 기준 전환율' : 'Event aggregate conversion rates')).not.toBeInTheDocument();
  expect(screen.getByText(lang === 'ko'
    ? '노출 횟수와 목표 행동이 연결된 노출 횟수입니다. 같은 노출에서 반복된 목표 행동은 한 번으로 집계합니다.'
    : 'Counts exposures and exposures linked to the goal action. Repeated goal actions on the same exposure count once.')).toBeInTheDocument();
  expect(experimentResultApi.getResult).not.toHaveBeenCalled();
  expect(decisionApi.list).not.toHaveBeenCalled();
});

it('shows counted exposures with zero conversions as 0% rather than no data', async () => {
  vi.mocked(experimentAnalyticsApi.get).mockResolvedValue({
    ...emptyAnalytics,
    impressions: { ...emptyAnalytics.impressions, total: 12, by_variant: { control: 12 } },
    conversions: { total: 0, by_variant: {}, rate: { control: 0 } },
  } as any);
  render(<MemoryRouter><ExperimentDashboard experimentId="test" experiment={experiment} lang="en" view="results" isAdmin={false} /></MemoryRouter>);
  const figure = await countFigure();
  expect(within(figure).getByText('0.00%')).toBeInTheDocument();
  expect(within(figure).queryByText('No impressions or conversions have been counted yet.')).not.toBeInTheDocument();
  expect([...figure.querySelectorAll<HTMLElement>('[style]')].map(bar => bar.style.width)).toEqual(['100%', '0%']);
});

it.each(['ko', 'en'] as const)('shows an honest empty count state without a fake rate or bars in %s', async (lang) => {
  render(<MemoryRouter><ExperimentDashboard experimentId="test" experiment={experiment} lang={lang} view="results" isAdmin={false} /></MemoryRouter>);
  const figure = await screen.findByRole('figure', { name: lang === 'ko' ? '그룹별 전환율 비교' : 'Conversion rates by group' });
  expect(within(figure).getByText(lang === 'ko' ? '아직 집계된 노출·전환이 없습니다.' : 'No impressions or conversions have been counted yet.')).toBeInTheDocument();
  expect(within(figure).queryByRole('listitem')).not.toBeInTheDocument();
  expect(within(figure).queryByText('0.00%')).not.toBeInTheDocument();
});

it('keeps conversion-only custom groups and safely handles object prototype names without inventing a denominator', async () => {
  vi.mocked(experimentAnalyticsApi.get).mockResolvedValue({
    ...emptyAnalytics,
    conversions: { total: 3, by_variant: JSON.parse('{"constructor":2,"__proto__":1}'), rate: {} },
  } as any);
  render(<MemoryRouter><ExperimentDashboard experimentId="test" experiment={experiment} lang="en" view="results" isAdmin={false} /></MemoryRouter>);
  const figure = await countFigure();
  expect(within(figure).getByText('constructor')).toBeInTheDocument();
  expect(within(figure).getByText('__proto__')).toBeInTheDocument();
  expect(within(figure).getAllByText('—')).toHaveLength(2);
  expect(figure.textContent).not.toMatch(/NaN|Infinity|0.00%/);
  expect([...figure.querySelectorAll<HTMLElement>('[style]')].map(bar => bar.style.width)).toEqual(['0%', '50%', '0%', '100%']);
});


async function countFigure(lang: 'ko' | 'en' = 'en') {
  fireEvent.click(await screen.findByText(lang === 'ko' ? '노출·전환 건수 자세히 보기' : 'View impression and conversion counts'));
  return screen.getByRole('figure', { name: lang === 'ko' ? '그룹별 노출·전환' : 'Impressions and conversions by group' });
}

it.each(['ko', 'en'] as const)('prioritizes rates over traffic volume and keeps each denominator visible in %s', async (lang) => {
  vi.mocked(experimentAnalyticsApi.get).mockResolvedValue({
    ...emptyAnalytics,
    impressions: { ...emptyAnalytics.impressions, total: 1500, by_variant: { control: 1000, treatment: 500 } },
    conversions: { total: 175, by_variant: { control: 100, treatment: 75 }, rate: { control: .1, treatment: .15 } },
  } as any);
  render(<MemoryRouter><ExperimentDashboard experimentId="test" experiment={experiment} lang={lang} view="results" isAdmin={false} /></MemoryRouter>);
  const figure = await screen.findByRole('figure', { name: lang === 'ko' ? '그룹별 전환율 비교' : 'Conversion rates by group' });
  const table = within(figure).getByRole('table', { name: lang === 'ko' ? '그룹별 전환율 비교' : 'Conversion rates by group' });
  expect(within(table).getAllByRole('columnheader').map(header => header.textContent)).toEqual(
    lang === 'ko' ? ['그룹', '전환율', '전환 / 노출'] : ['Group', 'Conversion rate', 'Conversions / Impressions'],
  );
  const rows = within(table).getAllByRole('row').slice(1);
  expect(within(rows[0]).getByRole('rowheader', { name: 'control' })).toHaveAttribute('scope', 'row');
  expect(within(rows[0]).getByText('10.00%')).toBeInTheDocument();
  expect(within(rows[1]).getByText('15.00%')).toBeInTheDocument();
  expect(within(rows[0]).getByRole('cell', { name: '100 / 1,000' })).toBeInTheDocument();
  expect(within(rows[1]).getByRole('cell', { name: '75 / 500' })).toBeInTheDocument();
  const widths = [...figure.querySelectorAll<HTMLElement>('[style]')].map(e => Number.parseFloat(e.style.width));
  expect(widths[0]).toBeCloseTo(50);
  expect(widths[1]).toBeCloseTo(75);
  expect(screen.getByText(lang === 'ko' ? '노출·전환 건수 자세히 보기' : 'View impression and conversion counts').closest('details')).not.toHaveAttribute('open');
  expect(experimentResultApi.getResult).not.toHaveBeenCalled();
  expect(decisionApi.list).not.toHaveBeenCalled();
});

it('displays legacy event rates above 100% without clipping their values or bars', async () => {
  vi.mocked(experimentAnalyticsApi.get).mockResolvedValue({
    ...emptyAnalytics, impressions: { ...emptyAnalytics.impressions, total: 4, by_variant: { control: 4 } },
    conversions: { total: 5, by_variant: { control: 5 }, rate: { control: 1.25 } },
  } as any);
  render(<MemoryRouter><ExperimentDashboard experimentId="test" experiment={experiment} lang="en" view="results" isAdmin={false} /></MemoryRouter>);
  const f = await screen.findByRole('figure', { name: 'Conversion rates by group' });
  expect(within(f).getByText('125.00%')).toBeInTheDocument();
  expect(within(f).getByText('Shared conversion-rate scale · 0–200%')).toBeInTheDocument();
  expect(f.querySelector<HTMLElement>('[style]')?.style.width).toBe('62.5%');
});

it('does not replace missing rates with zero even when exposure counts exist', async () => {
  vi.mocked(experimentAnalyticsApi.get).mockResolvedValue({
    ...emptyAnalytics, impressions: { ...emptyAnalytics.impressions, total: 10, by_variant: { control: 10 } },
    conversions: { total: 1, by_variant: { control: 1 }, rate: {} },
  } as any);
  render(<MemoryRouter><ExperimentDashboard experimentId="test" experiment={experiment} lang="en" view="results" isAdmin={false} /></MemoryRouter>);
  const f = await screen.findByRole('figure', { name: 'Conversion rates by group' });
  expect(within(f).getByText('—')).toBeInTheDocument();
  expect(within(f).getByText('Not enough information to compare this rate.')).toBeVisible();
  expect(within(f).queryByText('0.00%')).not.toBeInTheDocument();
  expect(f.querySelector('[style]')).toBeNull();
});


it('makes low observed rates comparable without rounding a positive rate to zero', async () => {
  vi.mocked(experimentAnalyticsApi.get).mockResolvedValue({
    ...emptyAnalytics, impressions: { ...emptyAnalytics.impressions, total: 2000000, by_variant: { control: 1000000, treatment: 1000000 } },
    conversions: { total: 3, by_variant: { control: 1, treatment: 2 }, rate: { control: .000001, treatment: .000002 } },
  } as any);
  render(<MemoryRouter><ExperimentDashboard experimentId="test" experiment={experiment} lang="en" view="results" isAdmin={false} /></MemoryRouter>);
  const f = await screen.findByRole('figure', { name: 'Conversion rates by group' });
  expect(within(f).getAllByText('<0.01%')).toHaveLength(2);
  expect(within(f).getByText('Shared conversion-rate scale · 0–0.0002%')).toBeInTheDocument();
  expect([...f.querySelectorAll<HTMLElement>('[style]')].map(e => e.style.width)).toEqual(['50%', '100%']);
  expect(within(f).queryByText('0.00%')).not.toBeInTheDocument();
});

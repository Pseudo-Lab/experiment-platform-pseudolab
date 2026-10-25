import { render, screen, fireEvent, cleanup } from '@testing-library/react';
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
  impressions: { total: 0, by_variant: {}, time_series: [] },
  conversions: { rate: {} },
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

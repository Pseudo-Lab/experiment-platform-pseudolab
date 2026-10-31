import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ExampleApp } from '@/features/example/ExampleApp'

const okJson = (data: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  } as Response)

function mockExampleApi() {
  global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/sdk/demo-config')) return okJson({ api_key: 'pk_sdk_fixture_demo' })

    // SDK unified decide endpoint (POST /decide)
    if (url.includes('/decide') && init?.method === 'POST') {
      const body = JSON.parse(String(init?.body ?? '{}'))
      const variant = body.key === 'sponsor_slot_v1' ? 'inline' : 'grid'
      return okJson({ key: body.key, type: 'flag', show: true, variant, payload: null })
    }

    if (url.includes('/feature-flags/?include_archived=true')) {
      return okJson([
        {
          flag_key: 'home_layout_v1',
          description: null,
          rollout_pct: 50,
          enabled: true,
          archived_at: null,
          created_at: '2026-05-18T00:00:00Z',
          updated_at: '2026-05-18T00:00:00Z',
        },
        {
          flag_key: 'sponsor_slot_v1',
          description: null,
          rollout_pct: 50,
          enabled: true,
          archived_at: null,
          created_at: '2026-05-18T00:00:00Z',
          updated_at: '2026-05-18T00:00:00Z',
        },
      ])
    }

    if (url.endsWith('/experiments/')) {
      return okJson([
        {
          id: 'exp-home',
          flag_key: 'home_layout_v1',
          name: 'home_layout_exp_v1',
          status: 'running',
          primary_metric: 'study_card_clicked',
        },
        {
          id: 'exp-sponsor',
          flag_key: 'sponsor_slot_v1',
          name: 'sponsor_slot_exp_v1',
          status: 'running',
          primary_metric: 'sponsor_clicked',
        },
      ])
    }

    if (url.includes('/assign/')) {
      return okJson({ variant_name: 'control' })
    }

    return okJson({})
  }) as typeof fetch
}

describe('ExampleApp', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.stubGlobal('crypto', { randomUUID: () => 'test-user-id' })
    mockExampleApi()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('preserves legacy SDK events through the real provider, bridge and action hook', async () => {
    render(<MemoryRouter initialEntries={['/example/experiments']}>
      <Routes><Route path="/example/*" element={<ExampleApp lang="en" />} /></Routes>
    </MemoryRouter>)
    const requests = () => vi.mocked(fetch).mock.calls
      .filter(([, init]) => init?.method === 'POST')
      .map(([url, init]) => ({ url: String(url), body: JSON.parse(String(init?.body)) }))
    await waitFor(() => {
      expect(requests().some(r => r.url.endsWith('/events') && r.body.type === 'impression')).toBe(true)
      expect(requests().some(r => r.url.endsWith('/capture') && r.body.event_name === 'exp_exposure')).toBe(true)
    })
    for (const request of requests().filter(r => r.url.endsWith('/decide'))) {
      expect(request.body.event_model).toBeUndefined()
      expect(request.body.track).toBeUndefined()
    }
    fireEvent.click((await screen.findAllByRole('button', { name: 'Send test event' }))[0])
    await waitFor(() => {
      expect(requests().some(r => r.url.endsWith('/capture') && r.body.event_name === 'showcase_cta_clicked')).toBe(true)
      expect(requests().some(r => r.url.endsWith('/events') && r.body.type === 'conversion'
        && r.body.key === 'home_layout_v1')).toBe(true)
    })
  })

  it('renders the home example route with English copy', async () => {
    render(
      <MemoryRouter initialEntries={['/example']}>
        <Routes>
          <Route path="/example/*" element={<ExampleApp lang="en" />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Active studies' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Example App' })).toHaveAttribute('href', '/example')
    expect(screen.getByText(/home_layout_v1 =/)).toBeInTheDocument()
  })

  it('renders the studies example route with Korean copy', async () => {
    render(
      <MemoryRouter initialEntries={['/example/studies']}>
        <Routes>
          <Route path="/example/*" element={<ExampleApp lang="ko" />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: '전체 스터디' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '스터디 목록' })).toHaveAttribute(
      'href',
      '/example/studies',
    )
    expect(screen.getByText(/sponsor_slot_v1 =/)).toBeInTheDocument()
  })
})


it.each(['ko', 'en'] as const)('fails closed when %s demo config is unavailable', async (lang) => {
  global.fetch = vi.fn().mockRejectedValue(new Error('offline'))
  render(<MemoryRouter><ExampleApp lang={lang} /></MemoryRouter>)
  expect(screen.getByRole('status')).toBeInTheDocument()
  expect(await screen.findByRole('alert')).toHaveTextContent(lang === 'ko' ? '예제 설정을 불러오지 못했습니다' : 'Unable to load demo settings')
  expect(global.fetch).toHaveBeenCalledTimes(1)
  cleanup()
})

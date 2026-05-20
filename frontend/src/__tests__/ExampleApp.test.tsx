import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ExampleApp } from '@/features/example/ExampleApp'

const okJson = (data: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  } as Response)

function mockExampleApi() {
  global.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)

    if (url.includes('/feature-flags/decide')) {
      const variant = url.includes('sponsor_slot_v1') ? 'inline' : 'grid'
      return okJson({ data: { variant } })
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
          name: 'home_layout_exp_v1',
          status: 'running',
          primary_metric: 'study_card_clicked',
        },
        {
          id: 'exp-sponsor',
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

import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { IterglowSDK } from '../dist/core.js'

const originalFetch = globalThis.fetch
const originalWindow = globalThis.window
const originalWarn = console.warn
afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalWindow === undefined) delete globalThis.window
  else globalThis.window = originalWindow
  console.warn = originalWarn
})

function setup(eventTransport, config = {}) {
  const requests = []
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    requests.push({ url, body })
    assert.ok(url.endsWith('/decide'), 'external telemetry must never reach Iterglow ingestion')
    return { ok: true, json: async () => ({
      key: body.key, type: 'flag', show: false, variant: 'control', payload: null,
      tracking_context: {
        experiment_id: body.experiment_id ?? 'exp-checkout', key: body.key,
        variant: 'control', project_id: 'project-demo', source: 'sdk_v1',
        assignment_id: 'assignment-demo', user_id: body.user_id,
      },
    }) }
  }
  const sdk = new IterglowSDK({ apiKey: 'public-sdk-fixture', baseUrl: 'https://platform.invalid/api/v1',
    userId: 'anonymous-demo', eventTransport, ...config })
  return { sdk, requests }
}

test('external collector receives actual exposure and attributed actions, with no built-in writes', async () => {
  const events = []
  const { sdk, requests } = setup(async event => { events.push(event) })
  const decision = await sdk.decide('checkout', { experimentId: 'exp-checkout', userId: 'original-user' })
  assert.equal(events.length, 0) // prefetch/evaluation is not visibility
  assert.equal(requests[0].body.user_id, 'original-user') // remote decide still receives identity
  assert.equal(requests[0].body.track, false)
  const exposure = await sdk.expose(decision) // control UI can be visible even with show=false
  sdk.identify('logged-in-later')
  await sdk.track('checkout_clicked', { variant: 'ignored-metadata' }, { tracking_context: exposure, type: 'click' })
  await sdk.track('purchase_completed', { value: 42 }, { tracking_context: exposure, eventId: 'order-event' })
  assert.deepEqual(events.map(e => e.sdk_event_type), ['exposure', 'click', 'conversion'])
  for (const event of events) {
    assert.equal(event.user_id, 'original-user')
    assert.equal(event.experiment_id, 'exp-checkout')
    assert.equal(event.variant, 'control')
    assert.deepEqual(event.tracking_context, exposure)
    assert.equal(event.tracking_context.project_id, 'project-demo')
    assert.equal(event.tracking_context.assignment_id, 'assignment-demo')
    assert.ok(event.timestamp)
    assert.ok(event.session_id)
    assert.equal(JSON.stringify(event).includes('public-sdk-fixture'), false)
  }
  assert.equal(events[0].event_id, exposure.impression_id)
  assert.equal(events[0].timestamp, exposure.exposed_at)
  assert.equal(new Set(events.map(e => e.event_id)).size, 3)
  assert.equal(requests.length, 1)
})

test('delivery rejection propagates, exposure retry preserves ID/time, and no failure falls back', async () => {
  const events = []
  let fail = true
  const { sdk, requests } = setup(async event => {
    events.push(structuredClone(event))
    if (fail) throw new Error('customer collector unavailable')
  })
  const decision = await sdk.decide('checkout')
  await assert.rejects(sdk.expose(decision), /collector unavailable/)
  fail = false
  const exposure = await sdk.expose(decision)
  assert.deepEqual(events[0], events[1])
  fail = true
  await assert.rejects(sdk.track('purchase', {}, { tracking_context: exposure, eventId: 'stable-action' }), /collector unavailable/)
  await assert.rejects(sdk.track('unattributed-event'), /collector unavailable/)
  fail = false
  await sdk.track('purchase', {}, { tracking_context: exposure, eventId: 'stable-action' })
  assert.equal(events[2].event_id, events[4].event_id)
  assert.equal(events.length, 5) // one callback attempt per caller invocation; no automatic retry
  assert.equal(requests.length, 1)
})

test('collector owns idempotency for repeated/concurrent exposures; a new view gets a new key', async () => {
  const attempts = [], stored = new Map()
  const { sdk, requests } = setup(event => {
    attempts.push(event)
    stored.set(event.event_id, event)
    // Adapter mutation cannot change the cached context or the returned exposure.
    event.tracking_context.user_id = 'adapter-mutation'
  })
  const decision = await sdk.decide('checkout')
  const [first, repeated] = await Promise.all([sdk.expose(decision), sdk.expose(decision)])
  assert.equal(stored.size, 1)
  assert.equal(attempts.length, 2)
  assert.equal(first.user_id, 'anonymous-demo')
  assert.deepEqual(first, repeated)
  await sdk.expose(decision, { impressionId: 'another-visible-instance' })
  assert.equal(stored.size, 2)
  assert.equal(requests.length, 1)
})

test('external transport refuses legacy/automatic exposure paths before any event or request', async () => {
  const events = []
  assert.throws(() => setup(event => { events.push(event) }, { eventModel: 'legacy' }), /eventTransport requires/)
  assert.throws(() => setup(event => { events.push(event) }, { autoExpose: true }), /eventTransport requires/)
  const { sdk, requests } = setup(event => { events.push(event) })
  await assert.rejects(sdk.trackExposure('exp-checkout', 'control'), /expose\(decision\)/)
  assert.equal(events.length, 0)
  assert.equal(requests.length, 0)
})

test('autocaptured pageviews go only to external transport, warn on failure and clean up', async () => {
  const listeners = new Map(), events = [], warnings = []
  globalThis.window = {
    location: { pathname: '/checkout' },
    addEventListener: (type, callback) => listeners.set(type, callback),
    removeEventListener: (type, callback) => { if (listeners.get(type) === callback) listeners.delete(type) },
  }
  console.warn = (...args) => { warnings.push(args) }
  const { sdk, requests } = setup(event => { events.push(event); throw new Error('offline') })
  const stop = sdk.startAutocapture()
  await new Promise(resolve => setTimeout(resolve, 0))
  listeners.get('popstate')()
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(events.map(e => e.event_name), ['$pageview', '$pageview'])
  assert.equal(new Set(events.map(e => e.event_id)).size, 2)
  assert.ok(events.every(e => e.timestamp && e.tracking_context === undefined))
  assert.equal(warnings.length, 2)
  assert.equal(requests.length, 0)
  stop()
  assert.equal(listeners.size, 0)
})

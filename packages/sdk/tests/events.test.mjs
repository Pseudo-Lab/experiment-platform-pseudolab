import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { ExperibaseSDK } from '../dist/core.js'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
const context = { experiment_id: 'exp', key: 'flag', variant: 'control', project_id: 'p',
  source: 'sdk_v1', assignment_id: 'assignment', user_id: 'override' }
function setup(config = {}) {
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ ...JSON.parse(init.body), url })
    return { ok: true, json: async () => ({ key: 'flag', type: 'flag', show: false,
      variant: 'control', payload: null, tracking_context: context }) }
  }
  return { sdk: new ExperibaseSDK({ apiKey: 'public', baseUrl: 'https://stub/api/v1', userId: 'original', ...config }), calls }
}

test('prefetch has no exposure; rendered control and its actions share the original identity', async () => {
  const { sdk, calls } = setup()
  const decision = await sdk.decide('flag', { userId: 'override', experimentId: 'exp' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].track, false)
  assert.equal(calls[0].experiment_id, 'exp')
  const exposure = await sdk.expose(decision)
  sdk.identify('logged-in-later')
  await sdk.track('clicked', { variant: 'forged', experiment_id: 'other' }, { tracking_context: exposure, type: 'click' })
  await sdk.track('purchase', {}, { tracking_context: exposure })
  assert.equal(calls.length, 4)
  for (const call of calls.slice(1)) {
    assert.ok(call.url.endsWith('/capture'))
    assert.equal(call.user_id, 'override')
    assert.equal(call.variant, 'control')
    assert.equal(call.experiment_id, 'exp')
    assert.deepEqual(call.tracking_context, exposure)
  }
  assert.deepEqual(calls.slice(1).map(c => c.sdk_event_type), ['exposure', 'click', 'conversion'])
  assert.equal(new Set(calls.slice(1).map(c => c.event_id)).size, 3)
})

test('same decision retries the same exposure; separate visible instances use separate IDs', async () => {
  const { sdk, calls } = setup()
  const d = await sdk.decide('flag')
  const first = await sdk.expose(d)
  assert.deepEqual(await sdk.expose(d), first)
  const second = await sdk.expose(d, { impressionId: 'next-visible-instance' })
  assert.notEqual(first.impression_id, second.impression_id)
  assert.equal(first.session_id, second.session_id)
  assert.equal(calls[1].event_id, calls[2].event_id)
})

test('failed exposure can be retried without changing its ID; failures are observable', async () => {
  const { sdk } = setup()
  const d = await sdk.decide('flag')
  const ids = []
  globalThis.fetch = async (_, init) => { ids.push(JSON.parse(init.body).event_id); return { ok: ids.length > 1, status: 502 } }
  await assert.rejects(sdk.expose(d), /502/)
  await sdk.expose(d)
  assert.equal(ids[0], ids[1])
})

test('auto exposure is explicitly opt-in; unattributed pageviews never become conversions', async () => {
  const { sdk, calls } = setup({ autoExpose: true })
  await sdk.decide('flag')
  await sdk.track('$pageview')
  assert.equal(calls.length, 3)
  assert.equal(calls[1].sdk_event_type, 'exposure')
  assert.equal(calls[2].event_name, '$pageview')
  assert.equal(calls[2].tracking_context, undefined)
  assert.ok(calls.every(c => !c.url.endsWith('/events')))
})

test('hidden placement and fallback without context cannot fabricate an exposure', async () => {
  const { sdk, calls } = setup()
  await assert.rejects(sdk.expose({ key: 'flag', type: 'flag', show: true, variant: 'control', payload: null }))
  await assert.rejects(sdk.expose({ key: 'slot', type: 'placement', show: false, variant: 'control', tracking_context: context }))
  assert.equal(calls.length, 0)
})

test('explicit legacy mode preserves bundled example decide/exposure/action requests', async () => {
  const { sdk, calls } = setup({ eventModel: 'legacy' })
  const decision = await sdk.decide('flag')
  await sdk.trackExposure('exp', decision.variant, { flag_key: 'flag' })
  await sdk.track('purchase', { experiment_id: 'exp', key: 'flag', variant: decision.variant })
  assert.deepEqual(calls.map(c => new URL(c.url).pathname),
    ['/api/v1/decide', '/api/v1/events', '/api/v1/capture', '/api/v1/capture', '/api/v1/events'])
  assert.equal(calls[0].event_model, undefined)
  assert.equal(calls[0].track, undefined)
  assert.equal(calls[1].type, 'impression')
  assert.equal(calls[2].event_name, 'exp_exposure')
  assert.equal(calls[4].type, 'conversion')
  assert.equal(calls[4].key, 'flag')
  await assert.rejects(sdk.expose(decision), /sdk_v1/)
  await assert.rejects(sdk.track('purchase', {}, { tracking_context: context }), /sdk_v1/)
  assert.throws(() => setup({ eventModel: 'legacy', autoExpose: true }), /v1 option/)
})

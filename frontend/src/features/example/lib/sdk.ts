import { getUserId } from './userId'
import { devLog } from './devLog'
import { API_BASE_URL } from './apiBase'

export async function decideFlag(flagKey: string, apiKey?: string): Promise<string> {
  const uid = getUserId()
  const logId = devLog.add('decide', flagKey, { user_id: uid })
  try {
    const headers: Record<string, string> = {}
    if (apiKey) headers['x-api-key'] = apiKey
    const res = await fetch(
      `${API_BASE_URL}/feature-flags/decide?flag_key=${encodeURIComponent(flagKey)}&user_id=${encodeURIComponent(uid)}`,
      { headers },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const variant = json?.data?.variant as string
    devLog.update(logId, { status: 'ok', response: variant })
    return variant
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    devLog.update(logId, { status: 'error', error: msg })
    throw e
  }
}

export async function track(
  eventName: string,
  properties?: Record<string, unknown>,
  apiKey?: string,
): Promise<void> {
  const logId = devLog.add('track', eventName, properties)
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['x-api-key'] = apiKey
    const res = await fetch(`${API_BASE_URL}/capture`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: getUserId(),
        event_name: eventName,
        properties,
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    devLog.update(logId, { status: 'ok', response: res.status })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    devLog.update(logId, { status: 'error', error: msg })
  }
}

export async function assignExperiment(
  experimentId: string,
  experimentName: string,
): Promise<string> {
  const uid = getUserId()
  const logId = devLog.add('assign', experimentName, { experiment_id: experimentId, user_id: uid })
  try {
    const res = await fetch(
      `${API_BASE_URL}/experiments/${encodeURIComponent(experimentId)}/assign/${encodeURIComponent(uid)}`,
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const variantName = json?.variant_name as string
    devLog.update(logId, { status: 'ok', response: variantName })
    return variantName
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    devLog.update(logId, { status: 'error', error: msg })
    throw e
  }
}

export async function identify(meta: {
  cohort_id?: string
  cohort_name?: string
  team_name?: string
  role?: string
}): Promise<void> {
  const logId = devLog.add('identify', 'identify', meta)
  try {
    const res = await fetch(`${API_BASE_URL}/identify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: getUserId(), ...meta }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    devLog.update(logId, { status: 'ok', response: res.status })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    devLog.update(logId, { status: 'error', error: msg })
  }
}

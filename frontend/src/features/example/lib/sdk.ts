import { getUserId } from './userId'
import { devLog } from './devLog'
import { API_BASE_URL } from './apiBase'
import { isEditorMode } from './visualEditor'

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

export async function applyVisualChanges(projectId: string, apiKey?: string): Promise<void> {
  if (isEditorMode()) return;
  try {
    const headers: Record<string, string> = {}
    if (apiKey) headers['x-api-key'] = apiKey
    const res = await fetch(`${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/visual-changes`, { headers })
    if (!res.ok) return
    const changes: Array<{
      selector: string; property: string; value: string; variant: string; flag_key?: string | null
    }> = await res.json()

    const flagKeys = [...new Set(changes.filter((c) => c.flag_key).map((c) => c.flag_key!))]
    const variantMap: Record<string, string> = {}
    await Promise.all(flagKeys.map(async (key) => {
      try { variantMap[key] = await decideFlag(key, apiKey) } catch { variantMap[key] = 'control' }
    }))

    for (const change of changes) {
      if (change.flag_key && variantMap[change.flag_key] !== change.variant) continue
      applyDomChange(change.selector, change.property, change.value)
    }
  } catch { /* best-effort */ }
}

function applyDomChange(selector: string, property: string, value: string): void {
  let el: Element | null = null
  try { el = document.querySelector(selector) } catch { return }
  if (!el) return
  if (property === 'text') {
    (el as HTMLElement).textContent = value
  } else if (property === 'display') {
    (el as HTMLElement).style.display = value
  } else {
    (el as HTMLElement).style.setProperty(property, value)
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

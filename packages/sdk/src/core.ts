import type { DecideResult, PlacementDecideResult, PlacementOptions, SDKConfig } from './types'

const UID_KEY = 'experibase_uid'

export class ExperibaseSDK {
  readonly apiKey: string
  readonly baseUrl: string
  private _userId: string

  constructor(config: SDKConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this._userId = config.userId ?? ExperibaseSDK.resolveUserId()
  }

  private static resolveUserId(): string {
    if (typeof localStorage !== 'undefined') {
      let id = localStorage.getItem(UID_KEY)
      if (!id) {
        id = crypto.randomUUID()
        localStorage.setItem(UID_KEY, id)
      }
      return id
    }
    return crypto.randomUUID()
  }

  get userId(): string {
    return this._userId
  }

  identify(userId: string): void {
    this._userId = userId
  }

  private async _sendEvent(payload: {
    type: string
    key: string
    variant: string
    url?: string | null
    user_id: string
    experiment_id?: string
    properties?: Record<string, unknown>
  }): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        console.warn(`[ExperibaseSDK] Event not saved (HTTP ${res.status})`, payload)
      }
    } catch (err) {
      console.warn('[ExperibaseSDK] Failed to send event:', err)
    }
  }

  async decide(key: string, options?: { userId?: string }): Promise<DecideResult> {
    const uid = options?.userId ?? this._userId
    const res = await fetch(`${this.baseUrl}/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify({ key, user_id: uid }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const result = await res.json() as DecideResult
    this._sendEvent({
      type: 'impression',
      key,
      variant: result.variant ?? 'unknown',
      url: typeof window !== 'undefined' ? window.location.pathname : null,
      user_id: uid,
    })
    return result
  }

  /**
   * Placement(준실험) 노출 여부를 결정한다.
   *
   * GET /placements/{key}/decide?user_id=...&role=...&cohort=...
   *
   * - fail-closed: API 오류 시 { show: false, completed: false } 반환
   * - 운영에서는 scenario를 전달하지 않는다
   *
   * @example
   * const { show, completed } = await sdk.placement('reflection-cta')
   */
  async placement(key: string, options?: PlacementOptions): Promise<PlacementDecideResult> {
    const uid = options?.userId ?? this._userId
    const searchParams = new URLSearchParams({ user_id: uid })
    if (options?.role) searchParams.set('role', options.role)
    if (options?.cohort) searchParams.set('cohort', options.cohort)
    if (options?.scenario) searchParams.set('scenario', options.scenario)
    if (options?.params) {
      for (const [k, v] of Object.entries(options.params)) {
        if (v === null || v === undefined || v === '') continue
        searchParams.set(k, String(v))
      }
    }

    const res = await fetch(
      `${this.baseUrl}/placements/${encodeURIComponent(key)}/decide?${searchParams}`,
      {
        headers: { 'x-api-key': this.apiKey },
        signal: options?.signal,
      },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json() as Promise<PlacementDecideResult>
  }

  startAutocapture(): () => void {
    if (typeof window === 'undefined') return () => {}
    this.track('$pageview', { url: window.location.pathname })
    const onPopstate = () => this.track('$pageview', { url: window.location.pathname })
    window.addEventListener('popstate', onPopstate)
    return () => window.removeEventListener('popstate', onPopstate)
  }

  async track(event: string, properties?: Record<string, unknown>): Promise<void> {
    const res = await fetch(`${this.baseUrl}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify({
        user_id: this._userId,
        event_name: event,
        properties,
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const key = (properties?.placement_key ?? properties?.key ?? event) as string
    const variant = (properties?.variant ?? 'unknown') as string
    this._sendEvent({
      type: 'conversion',
      key,
      variant,
      url: typeof window !== 'undefined' ? window.location.pathname : null,
      user_id: this._userId,
      properties,
    })
  }
}

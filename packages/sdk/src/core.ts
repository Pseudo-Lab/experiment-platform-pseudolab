import type { DecideResult, SDKConfig } from './types'

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
      await fetch(`${this.baseUrl}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch {
      // fire-and-forget: silently swallow network errors
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

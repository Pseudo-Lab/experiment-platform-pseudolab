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
    return res.json() as Promise<DecideResult>
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
  }
}

import type {
  AssignmentOptions,
  AssignmentResult,
  DecideResult,
  ExperimentPlacementDecisionResult,
  ExperimentPlacementOptions,
  PlacementDecideResult,
  PlacementOptions,
  SDKConfig,
} from './types.js'

const UID_KEY     = 'experibase_uid'
const SESSION_KEY = 'experibase_sid'
// exp_exposure 세션당 1회 가드: 'experibase_exp:{experimentId}'
const EXPOSURE_PREFIX = 'experibase_exp:'

// ---------------------------------------------------------------------------
// 내부 유틸
// ---------------------------------------------------------------------------

function resolveUserId(): string {
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

/**
 * 세션 ID: sessionStorage 기반.
 * 탭을 닫으면 초기화, 같은 탭 내에서는 유지.
 */
function resolveSessionId(): string {
  if (typeof sessionStorage !== 'undefined') {
    let sid = sessionStorage.getItem(SESSION_KEY)
    if (!sid) {
      sid = crypto.randomUUID()
      sessionStorage.setItem(SESSION_KEY, sid)
    }
    return sid
  }
  return crypto.randomUUID()
}

/** navigator.userAgent 기반 간이 device 구분. */
function resolveDevice(): string {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (/Mobi|Android/i.test(ua)) return 'mobile'
  if (/Tablet|iPad/i.test(ua)) return 'tablet'
  return 'desktop'
}

// ---------------------------------------------------------------------------
// ExperibaseSDK
// ---------------------------------------------------------------------------

export class ExperibaseSDK {
  readonly apiKey: string
  readonly baseUrl: string
  private _userId: string

  constructor(config: SDKConfig) {
    this.apiKey    = config.apiKey
    this.baseUrl   = config.baseUrl.replace(/\/$/, '')
    this._userId   = config.userId ?? resolveUserId()
  }

  get userId(): string { return this._userId }

  identify(userId: string): void { this._userId = userId }

  // ── 내부: experiment_event 테이블용 이벤트 전송 ──────────────────────────
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
      if (!res.ok) console.warn(`[ExperibaseSDK] Event not saved (HTTP ${res.status})`, payload)
    } catch (err) {
      console.warn('[ExperibaseSDK] Failed to send event:', err)
    }
  }

  // ── 공통 이벤트 프로퍼티 빌더 ───────────────────────────────────────────
  private _commonProps(): Record<string, unknown> {
    return {
      session_id: resolveSessionId(),
      device:     resolveDevice(),
    }
  }

  // ── 배정 (A/B) ──────────────────────────────────────────────────────────

  /**
   * 실험 배정을 조회한다.
   *
   * GET /experiments/assignment?experiment_id=&uid=
   *
   * - kill_switch=on 이면 서버가 'control'을 반환한다.
   * - fail-closed: 오류 시 'control' 반환.
   *
   * @example
   * const { variant_name } = await sdk.getAssignment('sidebar-nav-v1')
   */
  async getAssignment(
    experimentId: string,
    options?: AssignmentOptions,
  ): Promise<AssignmentResult> {
    const uid = options?.userId ?? this._userId
    const FALLBACK: AssignmentResult = {
      experiment_id: experimentId,
      variant_name:  'control',
      user_id:       uid,
      assigned_at:   new Date().toISOString(),
    }
    try {
      const params = new URLSearchParams({ experiment_id: experimentId, uid })
      const res = await fetch(
        `${this.baseUrl}/experiments/assignment?${params}`,
        { signal: options?.signal },
      )
      if (!res.ok) return FALLBACK
      return res.json() as Promise<AssignmentResult>
    } catch {
      return FALLBACK
    }
  }

  /**
   * exp_exposure 이벤트를 전송한다 (세션당 1회 가드).
   *
   * 사이드바가 배정된 variant로 렌더된 직후 호출.
   * sessionStorage에 기록하여 같은 세션에서 중복 발생을 막는다.
   *
   * @param experimentId  실험 ID (e.g. 'sidebar-nav-v1')
   * @param variant       배정된 variant ('control' | 'treatment')
   * @param properties    추가 properties (item_key, position 등)
   */
  async trackExposure(
    experimentId: string,
    variant: string,
    properties?: Record<string, unknown>,
  ): Promise<void> {
    const guardKey = `${EXPOSURE_PREFIX}${experimentId}`
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(guardKey)) return
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(guardKey, '1')

    const payload = {
      user_id:       this._userId,
      event_name:    'exp_exposure',
      session_id:    resolveSessionId(),
      experiment_id: experimentId,
      variant,
      device:        resolveDevice(),
      properties: {
        ...this._commonProps(),
        experiment_id: experimentId,
        variant,
        ...properties,
      },
    }
    try {
      await fetch(`${this.baseUrl}/capture`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey },
        body:    JSON.stringify(payload),
      })
    } catch { /* fire-and-forget */ }
  }

  // ── Feature flag decide ──────────────────────────────────────────────────

  async decide(key: string, options?: { userId?: string }): Promise<DecideResult> {
    const uid = options?.userId ?? this._userId
    const res = await fetch(`${this.baseUrl}/decide`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey },
      body:    JSON.stringify({ key, user_id: uid }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const result = await res.json() as DecideResult
    this._sendEvent({
      type:    'impression',
      key,
      variant: result.variant ?? 'unknown',
      url:     typeof window !== 'undefined' ? window.location.pathname : null,
      user_id: uid,
    })
    return result
  }

  // ── Placement (준실험) ───────────────────────────────────────────────────

  async placement(key: string, options?: PlacementOptions): Promise<PlacementDecideResult> {
    const uid = options?.userId ?? this._userId
    const searchParams = new URLSearchParams({ user_id: uid })
    if (options?.role)     searchParams.set('role',     options.role)
    if (options?.cohort)   searchParams.set('cohort',   options.cohort)
    if (options?.scenario) searchParams.set('scenario', options.scenario)
    if (options?.params) {
      for (const [k, v] of Object.entries(options.params)) {
        if (v === null || v === undefined || v === '') continue
        searchParams.set(k, String(v))
      }
    }
    const res = await fetch(
      `${this.baseUrl}/placements/${encodeURIComponent(key)}/decide?${searchParams}`,
      { headers: { 'x-api-key': this.apiKey }, signal: options?.signal },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json() as Promise<PlacementDecideResult>
  }

  async experimentPlacement(
    experimentId: string,
    placementKey: string,
    options?: ExperimentPlacementOptions,
  ): Promise<ExperimentPlacementDecisionResult> {
    const uid = options?.userId ?? this._userId
    const searchParams = new URLSearchParams({ user_id: uid })
    if (options?.projectId) searchParams.set('project_id', options.projectId)
    if (options?.scenario)  searchParams.set('scenario',   options.scenario)
    const res = await fetch(
      `${this.baseUrl}/experiments/${encodeURIComponent(experimentId)}/placements/${encodeURIComponent(placementKey)}/decide?${searchParams}`,
      { signal: options?.signal },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json() as Promise<ExperimentPlacementDecisionResult>
  }

  // ── 이벤트 트래킹 ────────────────────────────────────────────────────────

  startAutocapture(): () => void {
    if (typeof window === 'undefined') return () => {}
    this.track('$pageview', { url: window.location.pathname })
    const onPopstate = () => this.track('$pageview', { url: window.location.pathname })
    window.addEventListener('popstate', onPopstate)
    return () => window.removeEventListener('popstate', onPopstate)
  }

  /**
   * 일반 이벤트 트래킹. session_id · device 를 자동 첨부한다.
   *
   * @example
   * sdk.track('sidebar_item_clicked', {
   *   experiment_id: 'sidebar-nav-v1',
   *   variant:       'treatment',
   *   item_key:      'projects',
   *   position:      0,
   * })
   */
  async track(event: string, properties?: Record<string, unknown>): Promise<void> {
    const enriched = { ...this._commonProps(), ...properties }
    const body = {
      user_id:       this._userId,
      event_name:    event,
      session_id:    enriched.session_id as string | undefined,
      experiment_id: enriched.experiment_id as string | undefined,
      variant:       enriched.variant as string | undefined,
      device:        enriched.device as string | undefined,
      properties:    enriched,
    }
    try {
      const res = await fetch(`${this.baseUrl}/capture`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey },
        body:    JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      console.warn('[ExperibaseSDK] track failed:', err)
    }
    const key     = (properties?.placement_key ?? properties?.key ?? event) as string
    const variant = (properties?.variant ?? 'unknown') as string
    this._sendEvent({
      type:    'conversion',
      key,
      variant,
      url:     typeof window !== 'undefined' ? window.location.pathname : null,
      user_id: this._userId,
      properties: enriched,
    })
  }
}

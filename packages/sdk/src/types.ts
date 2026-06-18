export interface DecideResult {
  key: string
  type: 'flag' | 'placement'
  show: boolean
  variant: string | null
  payload: Record<string, unknown> | null
}

/** GET /api/v1/placements/{key}/decide 응답 */
export interface PlacementDecideResult {
  key: string
  show: boolean
  completed: boolean
  reason?: string
}

/** sdk.placement() 옵션 */
export interface PlacementOptions {
  userId?: string
  role?: string
  cohort?: string
  /** 시나리오 테스트용 — 운영에서는 전달하지 말 것 */
  scenario?: string
}

export interface SDKConfig {
  apiKey: string
  baseUrl: string
  userId?: string
}

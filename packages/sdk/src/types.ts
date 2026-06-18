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
  /**
   * 추가 쿼리 파라미터 (백엔드가 확장될 경우를 위한 escape hatch).
   * null / undefined / '' 값은 자동으로 제외된다.
   */
  params?: Record<string, string | number | boolean | null | undefined>
  /** fetch AbortSignal — timeout 구현에 사용 */
  signal?: AbortSignal
}

export interface SDKConfig {
  apiKey: string
  baseUrl: string
  userId?: string
}

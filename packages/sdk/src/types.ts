/** Attribution for an evaluation; not proof that the UI was displayed. */
export interface TrackingContext {
  experiment_id: string | null
  key: string
  variant: string
  project_id: string | null
  source: 'sdk_v1'
  /** Stable evaluation identity for project/experiment/key/user/variant; not a session. */
  assignment_id: string
  user_id: string
}

export interface ExposureContext extends TrackingContext {
  /** Original visibility time, preserved when retrying exposure delivery. */
  exposed_at: string
  /** One visible UI instance. Reuse for its click/conversion and retries. */
  impression_id: string
  /** Browser tab visit (sessionStorage); stable per SDK instance outside browsers. */
  session_id: string
}

export interface TrackOptions {
  tracking_context: ExposureContext
  type?: 'click' | 'conversion'
  /** Reuse only when retrying the same action. */
  eventId?: string
}

export interface DecideResult {
  key: string
  type: 'flag' | 'placement'
  show: boolean
  variant: string | null
  tracking_context?: TrackingContext | null
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
  /** Explicit migration boundary. Legacy preserves 0.1.5 evaluation/dual-write behavior. */
  eventModel?: 'sdk_v1' | 'legacy'
  /** Migration only: count evaluations as exposures. Default false. */
  autoExpose?: boolean
  apiKey: string
  baseUrl: string
  userId?: string
}

/** GET /experiments/assignment 응답 */
export interface AssignmentResult {
  experiment_id: string
  variant_name: string
  user_id: string
  assigned_at: string
}

/** sdk.useAssignment / trackExposure 옵션 */
export interface AssignmentOptions {
  userId?: string
  signal?: AbortSignal
}

// ---------------------------------------------------------------------------
// ExperimentPlacement (준실험) 타입
// ---------------------------------------------------------------------------

export interface ExperimentPlacementUI {
  id: string
  type: string
  title: string
  description: string
  target_url: string
}

export interface ExperimentPlacementLoggingContext {
  experiment_id: string
  placement_key: string
  ui_id: string
  ui_type: string
  project_id: string
  project_cohort: string
  user_project_role: string
  source: string
  [key: string]: unknown
}

export interface ExperimentPlacementDecisionResult {
  show: boolean
  reason?: string
  completed: boolean
  experiment_id: string | null
  placement_key: string | null
  ui: ExperimentPlacementUI | null
  logging_context: ExperimentPlacementLoggingContext | null
}

export interface ExperimentPlacementOptions {
  userId?: string
  /** project_id — D1에서 멤버십 조회 시 사용 */
  projectId?: string
  /** 시나리오 테스트용 — 운영에서는 전달하지 말 것 */
  scenario?: string
  /** fetch AbortSignal */
  signal?: AbortSignal
  /**
   * false면 API 요청을 보내지 않고 즉시 show=false를 반환한다.
   * userId나 필수 파라미터가 아직 준비되지 않은 경우에 사용.
   * 기본값: true
   */
  enabled?: boolean
}

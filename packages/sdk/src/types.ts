export interface DecideResult {
  key: string
  type: 'flag' | 'placement'
  show: boolean
  variant: string | null
  payload: Record<string, unknown> | null
}

export interface SDKConfig {
  apiKey: string
  baseUrl: string
  userId?: string
}

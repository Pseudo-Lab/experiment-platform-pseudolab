import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ExperibaseSDK } from './core'
import type { DecideResult } from './types'

export type { DecideResult }
export { ExperibaseSDK }

export interface ExperibaseContextValue {
  sdk: ExperibaseSDK
  variants: Record<string, string>
  isLoading: boolean
  /** 외부에서 variant 캐시를 업데이트할 수 있도록 노출 (Experiment 컴포넌트용) */
  setVariant: (flagKey: string, variant: string) => void
}

const ExperibaseContext = createContext<ExperibaseContextValue | null>(null)

const CACHE_PREFIX = 'experibase:flag:'

export interface ProviderProps {
  apiKey: string
  baseUrl: string
  userId?: string
  /**
   * 앱 마운트 시 미리 fetch할 flag key 목록.
   * 생략하면 <Experiment> 컴포넌트가 개별적으로 lazy 평가한다.
   */
  flagKeys?: readonly string[]
  children: ReactNode
}

export function ExperibaseProvider({
  apiKey,
  baseUrl,
  userId,
  flagKeys = [],
  children,
}: ProviderProps) {
  const sdkRef = useRef<ExperibaseSDK | null>(null)
  if (!sdkRef.current) {
    sdkRef.current = new ExperibaseSDK({ apiKey, baseUrl, userId })
  }
  const sdk = sdkRef.current
  const uid = sdk.userId

  const [variants, setVariants] = useState<Record<string, string>>(() => {
    const seeded: Record<string, string> = {}
    if (typeof sessionStorage !== 'undefined') {
      for (const key of flagKeys) {
        const cached = sessionStorage.getItem(`${CACHE_PREFIX}${key}:${uid}`)
        if (cached) seeded[key] = cached
      }
    }
    return seeded
  })

  const [isLoading, setIsLoading] = useState(() => {
    if (typeof sessionStorage === 'undefined') return flagKeys.length > 0
    return flagKeys.some(k => !sessionStorage.getItem(`${CACHE_PREFIX}${k}:${uid}`))
  })

  const setVariant = useCallback((flagKey: string, variant: string) => {
    setVariants(prev => {
      if (prev[flagKey] === variant) return prev
      return { ...prev, [flagKey]: variant }
    })
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(`${CACHE_PREFIX}${flagKey}:${uid}`, variant)
    }
  }, [uid])

  useEffect(() => {
    const missing = flagKeys.filter(k => {
      if (typeof sessionStorage === 'undefined') return true
      return !sessionStorage.getItem(`${CACHE_PREFIX}${k}:${uid}`)
    })

    if (missing.length === 0) {
      setIsLoading(false)
      return
    }

    Promise.all(
      missing.map(async key => {
        try {
          const result = await sdk.decide(key)
          const variant = result.variant ?? 'control'
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(`${CACHE_PREFIX}${key}:${uid}`, variant)
          }
          return { key, variant }
        } catch {
          return { key, variant: 'control' }
        }
      })
    ).then(results => {
      const map: Record<string, string> = {}
      for (const { key, variant } of results) {
        map[key] = variant
      }
      setVariants(prev => ({ ...prev, ...map }))
      setIsLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // runs once on mount; flagKeys and sdk are stable references

  // Autocapture pageviews on mount and on browser history navigation
  useEffect(() => {
    return sdk.startAutocapture()
  }, [sdk])

  // Allow forced variants from the visual editor to update the in-memory cache
  useEffect(() => {
    const handler = (e: Event) => {
      const { flagKey, variant } = (e as CustomEvent<{ flagKey: string; variant: string }>).detail
      setVariant(flagKey, variant)
    }
    window.addEventListener('exp:variant-forced', handler)
    return () => window.removeEventListener('exp:variant-forced', handler)
  }, [setVariant])

  return (
    <ExperibaseContext.Provider value={{ sdk, variants, isLoading, setVariant }}>
      {children}
    </ExperibaseContext.Provider>
  )
}

export function useExperibase(): ExperibaseContextValue {
  const ctx = useContext(ExperibaseContext)
  if (!ctx) throw new Error('useExperibase must be used within ExperibaseProvider')
  return ctx
}

export function useDecide(key: string): { result: DecideResult | null; loading: boolean } {
  const { sdk } = useExperibase()
  const [result, setResult] = useState<DecideResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    sdk
      .decide(key)
      .then(r => {
        if (!cancelled) {
          setResult(r)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ key, type: 'flag', show: true, variant: 'control', payload: null })
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [key, sdk])

  return { result, loading }
}

/**
 * Provider에 미리 선언된 variant를 읽는다.
 * @param flagKey  feature flag key
 * @param fallback 아직 로딩 중이거나 미등록 flag일 때 반환할 기본값 (기본: 'control')
 */
export function useFlag(flagKey: string, fallback = 'control'): string {
  const { variants } = useExperibase()
  return variants[flagKey] ?? fallback
}

// ---------------------------------------------------------------------------
// 선언형 컴포넌트 API
// ---------------------------------------------------------------------------

/**
 * Binary A/B 실험 컴포넌트.
 *
 * Provider의 flagKeys에 미리 선언하지 않아도 동작한다 (lazy 평가).
 * 미리 선언한 경우에는 추가 API 호출 없이 캐시에서 즉시 읽는다.
 *
 * @example
 * ```tsx
 * <Experiment
 *   flagKey="new-checkout-cta"
 *   control={<Button>구매하기</Button>}
 *   treatment={<Button variant="primary">지금 바로 구매</Button>}
 * />
 * ```
 */
export interface ExperimentProps {
  flagKey: string
  /** control(기본) variant에 보여줄 컴포넌트 */
  control: ReactNode
  /** treatment variant에 보여줄 컴포넌트 */
  treatment: ReactNode
  /**
   * 평가 중(loading)일 때 보여줄 컴포넌트.
   * 생략하면 control을 그대로 렌더한다 (layout shift 최소화).
   */
  loading?: ReactNode
}

export function Experiment({ flagKey, control, treatment, loading }: ExperimentProps) {
  const { sdk, variants, setVariant } = useExperibase()

  // Provider 캐시에 이미 있으면 즉시 사용
  const cached = variants[flagKey]
  const [variant, setVariantState] = useState<string | null>(cached ?? null)
  const [resolving, setResolving] = useState(!cached)

  useEffect(() => {
    // Provider가 이미 resolve한 경우 동기 업데이트
    if (variants[flagKey]) {
      setVariantState(variants[flagKey])
      setResolving(false)
      return
    }
    // lazy 평가: Provider에 없으면 직접 decide()
    let cancelled = false
    sdk.decide(flagKey).then(r => {
      if (cancelled) return
      const v = r.variant ?? 'control'
      setVariantState(v)
      setVariant(flagKey, v) // Provider 캐시에도 저장
      setResolving(false)
    }).catch(() => {
      if (cancelled) return
      setVariantState('control')
      setVariant(flagKey, 'control')
      setResolving(false)
    })
    return () => { cancelled = true }
    // variants[flagKey]가 바뀌면(=visual editor 강제 변경) 재평가
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagKey, variants[flagKey]])

  if (resolving) return <>{loading ?? control}</>
  return <>{variant === 'treatment' ? treatment : control}</>
}

/**
 * 다변량(A/B/C…) 실험 컴포넌트.
 *
 * @example
 * ```tsx
 * <ExperimentSwitch
 *   flagKey="pricing-layout"
 *   variants={{
 *     control:    <PricingV1 />,
 *     treatment:  <PricingV2 />,
 *     treatment_b: <PricingV3 />,
 *   }}
 * />
 * ```
 */
export interface ExperimentSwitchProps {
  flagKey: string
  /** variant 이름 → 렌더할 ReactNode 맵 */
  variants: Record<string, ReactNode>
  /** 평가 중일 때 보여줄 컴포넌트. 생략하면 variants['control']을 사용한다. */
  loading?: ReactNode
}

export function ExperimentSwitch({ flagKey, variants: variantMap, loading }: ExperimentSwitchProps) {
  const { sdk, variants, setVariant } = useExperibase()

  const cached = variants[flagKey]
  const [variant, setVariantState] = useState<string | null>(cached ?? null)
  const [resolving, setResolving] = useState(!cached)

  useEffect(() => {
    if (variants[flagKey]) {
      setVariantState(variants[flagKey])
      setResolving(false)
      return
    }
    let cancelled = false
    sdk.decide(flagKey).then(r => {
      if (cancelled) return
      const v = r.variant ?? 'control'
      setVariantState(v)
      setVariant(flagKey, v)
      setResolving(false)
    }).catch(() => {
      if (cancelled) return
      setVariantState('control')
      setVariant(flagKey, 'control')
      setResolving(false)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagKey, variants[flagKey]])

  const fallback = variantMap['control'] ?? null
  if (resolving) return <>{loading ?? fallback}</>
  return <>{(variant ? variantMap[variant] : null) ?? fallback}</>
}

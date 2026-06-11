import {
  createContext,
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
}

const ExperibaseContext = createContext<ExperibaseContextValue | null>(null)

const CACHE_PREFIX = 'experibase:flag:'

export interface ProviderProps {
  apiKey: string
  baseUrl: string
  userId?: string
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
      setVariants(prev => ({ ...prev, [flagKey]: variant }))
    }
    window.addEventListener('exp:variant-forced', handler)
    return () => window.removeEventListener('exp:variant-forced', handler)
  }, [])

  return (
    <ExperibaseContext.Provider value={{ sdk, variants, isLoading }}>
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

export function useFlag(flagKey: string): string | null {
  const { variants } = useExperibase()
  return variants[flagKey] ?? null
}

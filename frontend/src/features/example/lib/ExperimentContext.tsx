import { createContext, useContext, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { useExperibase } from '@pseudo-lab/experibase-sdk/react'
import { devLog } from './devLog'
import { experimentRegistry } from './experimentRegistry'

// SDK trackExposure()의 세션당 1회 가드 키와 동일 (packages/sdk/src/core.ts)
const SDK_EXPOSURE_PREFIX = 'experibase_exp:'

export interface ExperimentContextValue {
  variants: Record<string, string>
  isLoading: boolean
  apiKey?: string
}

export const ExperimentContext = createContext<ExperimentContextValue>({
  variants: {},
  isLoading: true,
})

/**
 * Bridges SDK context into the demo app's ExperimentContext.
 * Adds devLog integration so DevPanel can display flag assignments.
 * Must be rendered inside ExperibaseProvider.
 */
export function ExperimentContextBridge({ children }: { children: ReactNode }) {
  const { sdk, variants, isLoading } = useExperibase()
  const registry = useSyncExternalStore(
    experimentRegistry.subscribe,
    experimentRegistry.getSnapshot,
    experimentRegistry.getSnapshot,
  )
  // Track which flagKey→variant combos we've already written to devLog
  const loggedVariants = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    experimentRegistry.refresh()
  }, [])

  // Flag에 연결된 running 실험에 exp_exposure 이벤트 전송.
  // 결과 분석(get_result)의 분모가 이 이벤트 기준이라, 없으면 Bayesian 판정이 계산되지 않는다.
  useEffect(() => {
    if (registry.status !== 'ok') return
    for (const [flagKey, variant] of Object.entries(variants)) {
      const linked = registry.experimentsByFlagKey[flagKey] || []
      for (const exp of linked) {
        if (exp.status !== 'running') continue
        // SDK 내부 세션 가드를 미리 확인해 실제 전송될 때만 devLog에 남긴다.
        if (sessionStorage.getItem(`${SDK_EXPOSURE_PREFIX}${exp.id}`)) continue
        const id = devLog.add('track', 'exp_exposure', {
          experiment_id: exp.id,
          flag_key: flagKey,
          variant,
        })
        sdk
          .trackExposure(exp.id, variant, { flag_key: flagKey })
          .then(() => devLog.update(id, { status: 'ok' }))
          .catch((err: unknown) => devLog.update(id, { status: 'error', error: String(err) }))
      }
    }
  }, [registry, variants, sdk])

  // Log SDK-resolved variants to devLog whenever they arrive or change
  useEffect(() => {
    for (const [flagKey, variant] of Object.entries(variants)) {
      if (loggedVariants.current.get(flagKey) !== variant) {
        loggedVariants.current.set(flagKey, variant)
        const id = devLog.add('decide', flagKey, { source: 'sdk' })
        devLog.update(id, { status: 'ok', response: variant })
      }
    }
  }, [variants])

  // Handle visual editor forced variants (fires before variants state updates,
  // so we log immediately here and mark in loggedVariants to avoid a duplicate
  // when the variants effect runs after setVariants propagates).
  useEffect(() => {
    const handler = (e: Event) => {
      const { flagKey, variant } = (e as CustomEvent<{ flagKey: string; variant: string }>).detail
      loggedVariants.current.set(flagKey, variant)
      const id = devLog.add('decide', flagKey, { source: 'editor-forced' })
      devLog.update(id, { status: 'ok', response: variant })
    }
    window.addEventListener('exp:variant-forced', handler)
    return () => window.removeEventListener('exp:variant-forced', handler)
  }, [])

  return (
    <ExperimentContext.Provider value={{ variants, isLoading, apiKey: sdk.apiKey }}>
      {children}
    </ExperimentContext.Provider>
  )
}

export function useExperimentContext(): ExperimentContextValue {
  return useContext(ExperimentContext)
}

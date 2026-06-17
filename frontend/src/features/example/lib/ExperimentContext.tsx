import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { useExperibase } from '@pseudo-lab/experibase-sdk/react'
import { devLog } from './devLog'

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
  // Track which flagKey→variant combos we've already written to devLog
  const loggedVariants = useRef<Map<string, string>>(new Map())

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

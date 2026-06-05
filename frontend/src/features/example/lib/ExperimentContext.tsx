import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useExperibase } from '@experibase/sdk/react'
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
 * Adds devLog integration for the visual editor forced-variant path.
 * Must be rendered inside ExperibaseProvider.
 */
export function ExperimentContextBridge({ children }: { children: ReactNode }) {
  const { sdk, variants, isLoading } = useExperibase()

  useEffect(() => {
    const handler = (e: Event) => {
      const { flagKey, variant } = (e as CustomEvent<{ flagKey: string; variant: string }>).detail
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

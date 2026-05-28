import { useCallback } from 'react'
import { track } from '../lib/sdk'
import { useExperimentContext } from '../lib/ExperimentContext'

export function useTrack() {
  const { variants, apiKey } = useExperimentContext()
  // variants spreads first so caller-supplied properties can override if needed
  return useCallback(
    (eventName: string, properties?: Record<string, unknown>) =>
      track(eventName, { ...variants, ...properties }, apiKey),
    [variants, apiKey],
  )
}

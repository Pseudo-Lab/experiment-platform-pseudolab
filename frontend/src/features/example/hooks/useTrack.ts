import { useCallback } from 'react'
import { useExperibase } from '@pseudo-lab/experibase-sdk/react'

export function useTrack() {
  const { sdk, variants } = useExperibase()
  return useCallback(
    (eventName: string, properties?: Record<string, unknown>) =>
      sdk.track(eventName, { ...variants, ...properties }),
    [sdk, variants],
  )
}

import { useCallback } from 'react'
import { track } from '../lib/sdk'

export function useTrack() {
  return useCallback(
    (eventName: string, properties?: Record<string, unknown>) => track(eventName, properties),
    [],
  )
}

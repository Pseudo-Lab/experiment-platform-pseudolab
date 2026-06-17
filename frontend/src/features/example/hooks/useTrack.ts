import { useCallback } from 'react'
import { useExperibase } from '@pseudo-lab/experibase-sdk/react'
import { devLog } from '../lib/devLog'

export function useTrack() {
  const { sdk, variants } = useExperibase()
  return useCallback(
    (eventName: string, properties?: Record<string, unknown>) => {
      const props = { ...variants, ...properties }
      const id = devLog.add('track', eventName, props)
      sdk
        .track(eventName, props)
        .then(() => devLog.update(id, { status: 'ok' }))
        .catch((err: unknown) =>
          devLog.update(id, { status: 'error', error: String(err) }),
        )
    },
    [sdk, variants],
  )
}

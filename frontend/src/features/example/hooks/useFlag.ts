import { useEffect, useState } from 'react'
import { useExperibase } from '@experibase/sdk/react'
import { isEditorMode, getEditorForcedVariant } from '../lib/visualEditor'

export function useFlag(flagKey: string): string | null {
  const { variants } = useExperibase()

  const [forcedVariant, setForcedVariant] = useState<string | null>(() =>
    isEditorMode() ? (getEditorForcedVariant(flagKey) ?? 'control') : null,
  )

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ flagKey: string; variant: string }>).detail
      if (detail.flagKey === flagKey) setForcedVariant(detail.variant)
    }
    window.addEventListener('exp:variant-forced', handler)
    return () => window.removeEventListener('exp:variant-forced', handler)
  }, [flagKey])

  if (forcedVariant !== null) return forcedVariant
  return variants[flagKey] ?? null
}

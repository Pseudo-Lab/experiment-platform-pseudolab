import { useEffect, useState } from 'react'
import { decideFlag } from '../lib/sdk'
import { applyVisualChanges, isEditorMode, getEditorForcedVariant } from '../lib/visualEditor'
import { getUserId } from '../lib/userId'

export function useFlag(flagKey: string): string | null {
  const [variant, setVariant] = useState<string | null>(() => {
    if (isEditorMode()) return getEditorForcedVariant(flagKey) ?? 'control'
    return null
  })

  useEffect(() => {
    // Always listen for forced-variant updates regardless of editor mode
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ flagKey: string; variant: string }>).detail
      if (detail.flagKey === flagKey) setVariant(detail.variant)
    }
    window.addEventListener('exp:variant-forced', handler)

    if (isEditorMode()) {
      return () => window.removeEventListener('exp:variant-forced', handler)
    }

    const uid = getUserId()
    const cacheKey = `flag:${flagKey}:${uid}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      setVariant(cached)
      return () => window.removeEventListener('exp:variant-forced', handler)
    }
    let cancelled = false
    decideFlag(flagKey)
      .then(({ variant: v, visual_changes }) => {
        if (cancelled) return
        sessionStorage.setItem(cacheKey, v)
        setVariant(v)
        if (visual_changes.length > 0) {
          applyVisualChanges(visual_changes)
        }
      })
      .catch(() => {
        if (cancelled) return
        setVariant('control')
      })
    return () => {
      cancelled = true
      window.removeEventListener('exp:variant-forced', handler)
    }
  }, [flagKey])

  return variant
}

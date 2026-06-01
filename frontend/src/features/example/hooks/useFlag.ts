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
    if (isEditorMode()) {
      const handler = (e: Event) => {
        const detail = (e as CustomEvent<{ flagKey: string; variant: string }>).detail
        if (detail.flagKey === flagKey) setVariant(detail.variant)
      }
      window.addEventListener('exp:variant-forced', handler)
      return () => window.removeEventListener('exp:variant-forced', handler)
    }

    const uid = getUserId()
    const cacheKey = `flag:${flagKey}:${uid}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      setVariant(cached)
      return
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
    }
  }, [flagKey])

  return variant
}

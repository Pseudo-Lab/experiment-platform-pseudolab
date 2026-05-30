import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { decideFlag } from './sdk'
import { applyVisualChanges, type VisualChangePayload } from './visualEditor'
import { getUserId } from './userId'

type Variants = Record<string, string>

export interface ExperimentContextValue {
  variants: Variants
  isLoading: boolean
  apiKey?: string
}

export const ExperimentContext = createContext<ExperimentContextValue>({ variants: {}, isLoading: true })

export function ExperimentProvider({
  flagKeys,
  apiKey,
  projectId: _projectId,
  children,
}: {
  flagKeys: readonly string[]
  apiKey?: string
  projectId?: string
  children: ReactNode
}) {
  const [variants, setVariants] = useState<Variants>(() => {
    const uid = getUserId()
    const seeded: Variants = {}
    for (const key of flagKeys) {
      const cached = sessionStorage.getItem(`flag:${key}:${uid}`)
      if (cached) seeded[key] = cached
    }
    return seeded
  })

  const [isLoading, setIsLoading] = useState(() => {
    const uid = getUserId()
    return flagKeys.some((k) => !sessionStorage.getItem(`flag:${k}:${uid}`))
  })

  useEffect(() => {
    const uid = getUserId()
    const missing = flagKeys.filter((k) => !sessionStorage.getItem(`flag:${k}:${uid}`))
    if (missing.length === 0) return

    const tasks = missing.map(async (key) => {
      try {
        const { variant, visual_changes } = await decideFlag(key, apiKey)
        sessionStorage.setItem(`flag:${key}:${uid}`, variant)
        return { key, variant, visual_changes }
      } catch {
        return { key, variant: 'control', visual_changes: [] as VisualChangePayload[] }
      }
    })

    Promise.all(tasks).then((resolved) => {
      const map: Variants = {}
      const allChanges: VisualChangePayload[] = []
      for (const { key, variant, visual_changes } of resolved) {
        map[key] = variant
        allChanges.push(...visual_changes)
      }
      setVariants((prev) => ({ ...prev, ...map }))
      setIsLoading(false)
      if (allChanges.length > 0) {
        applyVisualChanges(allChanges)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // flagKeys is stable at mount; effect runs once

  return (
    <ExperimentContext.Provider value={{ variants, isLoading, apiKey }}>
      {children}
    </ExperimentContext.Provider>
  )
}

export function useExperimentContext(): ExperimentContextValue {
  return useContext(ExperimentContext)
}

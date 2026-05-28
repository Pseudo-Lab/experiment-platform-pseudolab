import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { decideFlag } from './sdk'
import { getUserId } from './userId'

type Variants = Record<string, string>

export interface ExperimentContextValue {
  variants: Variants
  isLoading: boolean
}

export const ExperimentContext = createContext<ExperimentContextValue>({ variants: {}, isLoading: true })

export function ExperimentProvider({
  flagKeys,
  children,
}: {
  flagKeys: readonly string[]
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
        const variant = await decideFlag(key)
        sessionStorage.setItem(`flag:${key}:${uid}`, variant)
        return { key, variant }
      } catch {
        return { key, variant: 'control' }
      }
    })

    Promise.all(tasks).then((resolved) => {
      const map: Variants = {}
      for (const { key, variant } of resolved) map[key] = variant
      setVariants((prev) => ({ ...prev, ...map }))
      setIsLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // flagKeys is stable at mount; effect runs once

  return (
    <ExperimentContext.Provider value={{ variants, isLoading }}>
      {children}
    </ExperimentContext.Provider>
  )
}

export function useExperimentContext(): ExperimentContextValue {
  return useContext(ExperimentContext)
}

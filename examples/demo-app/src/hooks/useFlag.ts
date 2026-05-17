import { useEffect, useState } from 'react'
import { decideFlag, assignExperiment } from '../lib/sdk'
import { getUserId } from '../lib/userId'
import { FLAG_TO_EXPERIMENT } from '../lib/flagToExperiment'
import { experimentRegistry } from '../lib/experimentRegistry'

export function useFlag(flagKey: string): string | null {
  const [variant, setVariant] = useState<string | null>(null)

  useEffect(() => {
    const uid = getUserId()
    const cacheKey = `flag:${flagKey}:${uid}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      setVariant(cached)
    } else {
      let cancelled = false
      decideFlag(flagKey)
        .then((v) => {
          if (cancelled) return
          sessionStorage.setItem(cacheKey, v)
          setVariant(v)
        })
        .catch(() => {
          if (cancelled) return
          setVariant('control')
        })
      // 정리 핸들러는 마지막 effect에서 통합 반환.
      return () => {
        cancelled = true
      }
    }
  }, [flagKey])

  // decide와는 별개로 동일 사용자를 매핑된 실험에도 배정 (best-effort, fire-and-forget).
  // sessionStorage로 동일 세션에서 중복 호출 방지.
  useEffect(() => {
    const experimentName = FLAG_TO_EXPERIMENT[flagKey]
    if (!experimentName) return

    const uid = getUserId()
    const assignCacheKey = `assign:${experimentName}:${uid}`
    if (sessionStorage.getItem(assignCacheKey)) return

    let cancelled = false
    const run = async () => {
      let snap = experimentRegistry.getSnapshot()
      if (snap.status === 'idle' || snap.status === 'error') {
        await experimentRegistry.refresh()
        snap = experimentRegistry.getSnapshot()
      }
      if (cancelled) return
      const exp = snap.experimentsByName[experimentName]
      if (!exp) return // 실험 미등록 — Dev Panel 진단에서 안내됨
      await assignExperiment(exp.id, experimentName).catch(() => {})
      if (!cancelled) sessionStorage.setItem(assignCacheKey, '1')
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [flagKey])

  return variant
}

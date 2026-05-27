import { useEffect, useState } from 'react'
import { decideFlag } from '../lib/sdk'
import { getUserId } from '../lib/userId'

// 백엔드의 decide()가 노출 기록과 함께 연결된 실험의 assignment까지 동시에 기록.
// 데모 SDK는 decide() 하나만 호출하면 됨.
export function useFlag(flagKey: string): string | null {
  const [variant, setVariant] = useState<string | null>(null)

  useEffect(() => {
    const uid = getUserId()
    const cacheKey = `flag:${flagKey}:${uid}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      setVariant(cached)
      return
    }
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
    return () => {
      cancelled = true
    }
  }, [flagKey])

  return variant
}

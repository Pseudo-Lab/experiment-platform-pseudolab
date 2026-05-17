const API = import.meta.env.VITE_PLATFORM_API as string

export type FlagMeta = {
  flag_key: string
  description: string | null
  rollout_pct: number
  enabled: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
}

type Status = 'idle' | 'loading' | 'ok' | 'error'

type State = {
  status: Status
  flagsByKey: Record<string, FlagMeta>
  error?: string
  loadedAt?: string
}

let state: State = { status: 'idle', flagsByKey: {} }
const listeners = new Set<() => void>()

function setState(next: State) {
  state = next
  listeners.forEach((l) => l())
}

export const flagRegistry = {
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
  getSnapshot(): State {
    return state
  },
  async refresh() {
    setState({ ...state, status: 'loading' })
    try {
      const res = await fetch(`${API}/feature-flags/?include_archived=true`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const flags: FlagMeta[] = await res.json()
      const byKey: Record<string, FlagMeta> = {}
      flags.forEach((f) => {
        byKey[f.flag_key] = f
      })
      setState({
        status: 'ok',
        flagsByKey: byKey,
        loadedAt: new Date().toLocaleTimeString(),
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setState({ ...state, status: 'error', error: msg })
    }
  },
}

export type DiagnosisLevel = 'ok' | 'warn' | 'error'

export type Diagnosis = {
  level: DiagnosisLevel
  label: string
  detail?: string
  remediation?: string
}

export function diagnoseFlag(
  flagKey: string,
  variant: string,
  flag: FlagMeta | undefined,
): Diagnosis {
  if (!flag) {
    return {
      level: 'error',
      label: 'unknown_flag',
      detail:
        'DB에 해당 flag가 없습니다. 백엔드는 조용히 "control"을 반환하고 노출도 기록하지 않습니다.',
      remediation: `관리자 콘솔(http://localhost:8081) → Feature Flags → 새 Flag 생성:
  • flag_key: ${flagKey}
  • rollout_pct: 50
  • enabled: ON`,
    }
  }
  if (flag.archived_at) {
    return {
      level: 'error',
      label: 'archived',
      detail: `이 flag는 ${flag.archived_at}에 아카이브됐습니다.`,
      remediation: `관리자 콘솔 → Feature Flags → 아카이브 목록 → "${flagKey}" 복구.`,
    }
  }
  if (!flag.enabled) {
    return {
      level: 'warn',
      label: 'disabled',
      detail: '비활성 상태라 모든 사용자가 control로 떨어집니다.',
      remediation: `관리자 콘솔 → Feature Flags → "${flagKey}" → enabled 토글 ON.`,
    }
  }
  if (flag.rollout_pct === 0) {
    return {
      level: 'warn',
      label: 'rollout_pct=0',
      detail: 'rollout이 0%라 모든 사용자가 control.',
      remediation: `관리자 콘솔 → "${flagKey}" → rollout_pct를 50 (또는 원하는 값)으로 변경.`,
    }
  }
  return {
    level: 'ok',
    label: 'ok',
    detail: `enabled · rollout ${flag.rollout_pct}% · 현재 ${variant}`,
  }
}

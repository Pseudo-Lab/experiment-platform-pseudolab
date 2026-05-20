import type { Lang } from '../i18n'
import { API_BASE_URL } from './apiBase'

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
      const res = await fetch(`${API_BASE_URL}/feature-flags/?include_archived=true`)
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
  lang: Lang,
): Diagnosis {
  if (!flag) {
    return {
      level: 'error',
      label: 'unknown_flag',
      detail:
        lang === 'ko'
          ? 'DB에 해당 flag가 없습니다. 백엔드는 조용히 "control"을 반환하고 노출도 기록하지 않습니다.'
          : 'This flag does not exist in the DB. The backend quietly returns "control" and skips exposure logging.',
      remediation:
        lang === 'ko'
          ? `관리자 콘솔(http://localhost:8081) -> Feature Flags -> 새 Flag 생성:
  - flag_key: ${flagKey}
  - rollout_pct: 50
  - enabled: ON`
          : `Admin console (http://localhost:8081) -> Feature Flags -> create a new flag:
  - flag_key: ${flagKey}
  - rollout_pct: 50
  - enabled: ON`,
    }
  }
  if (flag.archived_at) {
    return {
      level: 'error',
      label: 'archived',
      detail:
        lang === 'ko'
          ? `이 flag는 ${flag.archived_at}에 아카이브됐습니다.`
          : `This flag was archived at ${flag.archived_at}.`,
      remediation:
        lang === 'ko'
          ? `관리자 콘솔 -> Feature Flags -> 아카이브 목록 -> "${flagKey}" 복구.`
          : `Admin console -> Feature Flags -> archived list -> restore "${flagKey}".`,
    }
  }
  if (!flag.enabled) {
    return {
      level: 'warn',
      label: 'disabled',
      detail:
        lang === 'ko'
          ? '비활성 상태라 모든 사용자가 control로 떨어집니다.'
          : 'The flag is disabled, so every user falls back to control.',
      remediation:
        lang === 'ko'
          ? `관리자 콘솔 -> Feature Flags -> "${flagKey}" -> enabled 토글 ON.`
          : `Admin console -> Feature Flags -> "${flagKey}" -> turn enabled ON.`,
    }
  }
  if (flag.rollout_pct === 0) {
    return {
      level: 'warn',
      label: 'rollout_pct=0',
      detail:
        lang === 'ko'
          ? 'rollout이 0%라 모든 사용자가 control.'
          : 'Rollout is 0%, so every user receives control.',
      remediation:
        lang === 'ko'
          ? `관리자 콘솔 -> "${flagKey}" -> rollout_pct를 50 또는 원하는 값으로 변경.`
          : `Admin console -> "${flagKey}" -> change rollout_pct to 50 or another target value.`,
    }
  }
  return {
    level: 'ok',
    label: 'ok',
    detail:
      lang === 'ko'
        ? `enabled · rollout ${flag.rollout_pct}% · 현재 ${variant}`
        : `enabled · rollout ${flag.rollout_pct}% · current ${variant}`,
  }
}

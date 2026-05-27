import type { Lang } from '../i18n'
import { API_BASE_URL } from './apiBase'

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'archived'

export type ExperimentMeta = {
  id: string
  name: string
  status: ExperimentStatus
  primary_metric: string | null
  flag_key: string | null
}

type Status = 'idle' | 'loading' | 'ok' | 'error'

type State = {
  status: Status
  experimentsByName: Record<string, ExperimentMeta>
  experimentsByFlagKey: Record<string, ExperimentMeta[]>
  error?: string
  loadedAt?: string
}

let state: State = { status: 'idle', experimentsByName: {}, experimentsByFlagKey: {} }
const listeners = new Set<() => void>()

function setState(next: State) {
  state = next
  listeners.forEach((l) => l())
}

export const experimentRegistry = {
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
      const res = await fetch(`${API_BASE_URL}/experiments/`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const items: Array<ExperimentMeta & { flag_key?: string | null }> = await res.json()
      const byName: Record<string, ExperimentMeta> = {}
      const byFlagKey: Record<string, ExperimentMeta[]> = {}
      items.forEach((e) => {
        const meta: ExperimentMeta = {
          id: e.id,
          name: e.name,
          status: e.status,
          primary_metric: e.primary_metric ?? null,
          flag_key: e.flag_key ?? null,
        }
        byName[e.name] = meta
        if (meta.flag_key) {
          ;(byFlagKey[meta.flag_key] ||= []).push(meta)
        }
      })
      setState({
        status: 'ok',
        experimentsByName: byName,
        experimentsByFlagKey: byFlagKey,
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

export function diagnoseExperiment(
  experimentName: string,
  exp: ExperimentMeta | undefined,
  lang: Lang,
): Diagnosis {
  if (!exp) {
    return {
      level: 'error',
      label: 'unknown_experiment',
      detail:
        lang === 'ko'
          ? '실험이 등록돼 있지 않습니다. assign 호출이 404로 실패합니다.'
          : 'The experiment is not registered. Assign calls fail with 404.',
      remediation:
        lang === 'ko'
          ? `관리자 콘솔 -> 실험 관리에서 "${experimentName}" 생성 후 running 상태로 전환.`
          : `Create "${experimentName}" in Admin console -> Experiments, then switch it to running.`,
    }
  }
  if (exp.status === 'running') {
    return {
      level: 'ok',
      label: 'running',
      detail: exp.primary_metric
        ? `primary_metric: ${exp.primary_metric}`
        : lang === 'ko'
          ? 'primary_metric 미설정'
          : 'primary_metric is not set',
    }
  }
  if (exp.status === 'draft') {
    return {
      level: 'warn',
      label: 'draft',
      detail:
        lang === 'ko'
          ? '아직 분석 대상이 아닙니다. assign은 동작하지만 통계 계산은 안 됩니다.'
          : 'This is not ready for analysis yet. Assign works, but statistics are not calculated.',
      remediation:
        lang === 'ko'
          ? '관리자 콘솔 -> 실험 관리에서 status를 running으로 전환.'
          : 'Switch status to running in Admin console -> Experiments.',
    }
  }
  if (exp.status === 'paused') {
    return {
      level: 'warn',
      label: 'paused',
      detail: lang === 'ko' ? '일시정지 상태입니다.' : 'The experiment is paused.',
      remediation:
        lang === 'ko'
          ? `관리자 콘솔 -> 실험 관리 -> "${experimentName}" -> 재개.`
          : `Admin console -> Experiments -> "${experimentName}" -> resume.`,
    }
  }
  return {
    level: 'error',
    label: exp.status,
    detail:
      lang === 'ko'
        ? '종결 상태(completed/archived)라 신규 데이터가 누적되지 않습니다.'
        : 'This is a terminal state (completed/archived), so no new data accumulates.',
  }
}

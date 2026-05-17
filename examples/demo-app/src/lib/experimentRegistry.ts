const API = import.meta.env.VITE_PLATFORM_API as string

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'archived'

export type ExperimentMeta = {
  id: string
  name: string
  status: ExperimentStatus
  primary_metric: string | null
}

type Status = 'idle' | 'loading' | 'ok' | 'error'

type State = {
  status: Status
  experimentsByName: Record<string, ExperimentMeta>
  error?: string
  loadedAt?: string
}

let state: State = { status: 'idle', experimentsByName: {} }
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
      const res = await fetch(`${API}/experiments/`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const items: ExperimentMeta[] = await res.json()
      const byName: Record<string, ExperimentMeta> = {}
      items.forEach((e) => {
        byName[e.name] = {
          id: e.id,
          name: e.name,
          status: e.status,
          primary_metric: e.primary_metric ?? null,
        }
      })
      setState({
        status: 'ok',
        experimentsByName: byName,
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
): Diagnosis {
  if (!exp) {
    return {
      level: 'error',
      label: 'unknown_experiment',
      detail: '실험이 등록돼 있지 않습니다. assign 호출이 404로 실패합니다.',
      remediation: `bash examples/demo-app/scripts/seed.sh  실행 (실험 "${experimentName}" 생성)`,
    }
  }
  if (exp.status === 'running') {
    return {
      level: 'ok',
      label: 'running',
      detail: exp.primary_metric
        ? `primary_metric: ${exp.primary_metric}`
        : 'primary_metric 미설정',
    }
  }
  if (exp.status === 'draft') {
    return {
      level: 'warn',
      label: 'draft',
      detail: '아직 분석 대상이 아닙니다. assign은 동작하지만 통계 계산은 안 됩니다.',
      remediation: `bash examples/demo-app/scripts/seed.sh 재실행 (status를 running으로 전환).`,
    }
  }
  if (exp.status === 'paused') {
    return {
      level: 'warn',
      label: 'paused',
      detail: '일시정지 상태입니다.',
      remediation: `관리자 콘솔 → 실험 관리 → "${experimentName}" → 재개.`,
    }
  }
  return {
    level: 'error',
    label: exp.status,
    detail: '종결 상태(completed/archived)라 신규 데이터가 누적되지 않습니다.',
  }
}

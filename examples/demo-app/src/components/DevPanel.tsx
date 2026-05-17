import { useSyncExternalStore, useState, useMemo, useEffect } from 'react'
import { devLog, type LogEntry } from '../lib/devLog'
import { flagRegistry, diagnoseFlag, type Diagnosis as FlagDiagnosis } from '../lib/flagRegistry'
import {
  experimentRegistry,
  diagnoseExperiment,
  type Diagnosis as ExpDiagnosis,
} from '../lib/experimentRegistry'
import { FLAG_TO_EXPERIMENT } from '../lib/flagToExperiment'
import { getUserId } from '../lib/userId'

function useEntries(): ReadonlyArray<LogEntry> {
  return useSyncExternalStore(devLog.subscribe, devLog.getSnapshot, devLog.getSnapshot)
}
function useFlagRegistry() {
  return useSyncExternalStore(
    flagRegistry.subscribe,
    flagRegistry.getSnapshot,
    flagRegistry.getSnapshot,
  )
}
function useExperimentRegistry() {
  return useSyncExternalStore(
    experimentRegistry.subscribe,
    experimentRegistry.getSnapshot,
    experimentRegistry.getSnapshot,
  )
}

const KIND_COLOR: Record<LogEntry['kind'], string> = {
  decide: 'bg-indigo-100 text-indigo-800',
  track: 'bg-emerald-100 text-emerald-800',
  identify: 'bg-amber-100 text-amber-800',
  assign: 'bg-purple-100 text-purple-800',
}

const STATUS_COLOR: Record<LogEntry['status'], string> = {
  pending: 'text-slate-400',
  ok: 'text-emerald-600',
  error: 'text-red-600',
}

type AnyDiagnosis = FlagDiagnosis | ExpDiagnosis

const LEVEL_BADGE: Record<AnyDiagnosis['level'], string> = {
  ok: 'bg-emerald-100 text-emerald-800',
  warn: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-800',
}
const LEVEL_BLOCK: Record<AnyDiagnosis['level'], string> = {
  ok: 'border-emerald-200 bg-emerald-50',
  warn: 'border-amber-300 bg-amber-50',
  error: 'border-red-300 bg-red-50',
}
const LEVEL_ICON: Record<AnyDiagnosis['level'], string> = {
  ok: '✓',
  warn: '⚠️',
  error: '⛔',
}

type Tab = 'flags' | 'experiments' | 'events'

export function DevPanel() {
  const entries = useEntries()
  const [open, setOpen] = useState(true)
  const [tab, setTab] = useState<Tab>('flags')
  const uid = getUserId()

  useEffect(() => {
    flagRegistry.refresh()
    experimentRegistry.refresh()
  }, [])

  const flagState = useMemo(() => {
    const map: Record<string, { variant: string; time: string }> = {}
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i]
      if (e.kind === 'decide' && e.status === 'ok') {
        map[e.label] = { variant: String(e.response ?? '?'), time: e.time }
      }
    }
    return map
  }, [entries])

  const assignState = useMemo(() => {
    const map: Record<string, { variant: string; time: string }> = {}
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i]
      if (e.kind === 'assign' && e.status === 'ok') {
        map[e.label] = { variant: String(e.response ?? '?'), time: e.time }
      }
    }
    return map
  }, [entries])

  const mappedExperiments = useMemo(() => {
    const set = new Set<string>()
    Object.keys(flagState).forEach((flagKey) => {
      const expName = FLAG_TO_EXPERIMENT[flagKey]
      if (expName) set.add(expName)
    })
    Object.keys(assignState).forEach((n) => set.add(n))
    return set
  }, [flagState, assignState])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 bg-slate-900 text-white text-xs px-3 py-2 rounded-full shadow-lg hover:bg-slate-800"
      >
        🔬 Dev Panel
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[440px] max-h-[80vh] bg-white border shadow-2xl rounded-lg flex flex-col text-sm">
      <header className="flex items-center justify-between px-3 py-2 border-b bg-slate-50 rounded-t-lg">
        <div className="font-semibold text-slate-800">🔬 Dev Panel</div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => devLog.clear()}
            className="text-xs px-2 py-0.5 text-slate-500 hover:text-slate-800"
            title="로그 비우기"
          >
            clear
          </button>
          <button
            onClick={() => setOpen(false)}
            className="text-xs px-2 py-0.5 text-slate-500 hover:text-slate-800"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="px-3 py-2 border-b text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className="font-medium">user_id:</span>
          <code className="font-mono text-[11px] text-slate-800">{uid}</code>
        </div>
      </div>

      <nav className="flex border-b text-xs">
        <TabBtn label={`Flags (${Object.keys(flagState).length})`} active={tab === 'flags'} onClick={() => setTab('flags')} />
        <TabBtn label={`Experiments (${mappedExperiments.size})`} active={tab === 'experiments'} onClick={() => setTab('experiments')} />
        <TabBtn label={`API (${entries.length})`} active={tab === 'events'} onClick={() => setTab('events')} />
      </nav>

      <div className="flex-1 overflow-auto">
        {tab === 'flags' && <FlagsTab flagState={flagState} />}
        {tab === 'experiments' && (
          <ExperimentsTab assignState={assignState} mappedExperiments={mappedExperiments} />
        )}
        {tab === 'events' && <EventsTab entries={entries} />}
      </div>

      <footer className="px-3 py-2 border-t text-[11px] text-slate-500 bg-slate-50 rounded-b-lg">
        헤더의 <strong>새 사용자</strong> 버튼으로 다른 variant를 받아볼 수 있어요.
      </footer>
    </div>
  )
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 ${active ? 'bg-white font-semibold border-b-2 border-slate-900' : 'bg-slate-50 text-slate-500'}`}
    >
      {label}
    </button>
  )
}

function FlagsTab({ flagState }: { flagState: Record<string, { variant: string; time: string }> }) {
  const registry = useFlagRegistry()
  const decidedKeys = Object.keys(flagState)

  return (
    <div>
      <RegistryStatus
        kind="Flag"
        status={registry.status}
        error={registry.error}
        loadedAt={registry.loadedAt}
        count={Object.keys(registry.flagsByKey).length}
        onRefresh={() => flagRegistry.refresh()}
      />
      {decidedKeys.length === 0 ? (
        <div className="p-4 text-xs text-slate-500">
          아직 decide 호출이 없습니다. 페이지를 새로고침 하거나 헤더의 <strong>새 사용자</strong>를 눌러보세요.
        </div>
      ) : (
        <ul className="divide-y">
          {decidedKeys.map((flagKey) => {
            const { variant, time } = flagState[flagKey]
            const flag = registry.flagsByKey[flagKey]
            const dx = diagnoseFlag(flagKey, variant, flag)
            return (
              <li key={flagKey} className="px-3 py-3 space-y-2">
                <Header label={flagKey} value={variant} time={time} />
                <DiagnosisBlock dx={dx} />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function ExperimentsTab({
  assignState,
  mappedExperiments,
}: {
  assignState: Record<string, { variant: string; time: string }>
  mappedExperiments: Set<string>
}) {
  const registry = useExperimentRegistry()

  return (
    <div>
      <RegistryStatus
        kind="Experiment"
        status={registry.status}
        error={registry.error}
        loadedAt={registry.loadedAt}
        count={Object.keys(registry.experimentsByName).length}
        onRefresh={() => experimentRegistry.refresh()}
      />
      {mappedExperiments.size === 0 ? (
        <div className="p-4 text-xs text-slate-500">
          매핑된 실험이 없습니다. <code>src/lib/flagToExperiment.ts</code> 매핑을 확인하세요.
        </div>
      ) : (
        <ul className="divide-y">
          {Array.from(mappedExperiments).map((expName) => {
            const assign = assignState[expName]
            const exp = registry.experimentsByName[expName]
            const dx = diagnoseExperiment(expName, exp)
            return (
              <li key={expName} className="px-3 py-3 space-y-2">
                <Header
                  label={expName}
                  value={assign?.variant ?? '—'}
                  time={assign?.time ?? '미배정'}
                />
                <DiagnosisBlock dx={dx} />
                {assign && exp && (
                  <div className="text-[10.5px] text-slate-500">
                    실험 ID: <code className="font-mono">{exp.id.slice(0, 8)}…</code>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Header({ label, value, time }: { label: string; value: string; time: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="font-medium text-slate-800">{label}</div>
        <div className="text-[11px] text-slate-400">{time}</div>
      </div>
      <span className="font-mono text-xs px-2 py-1 bg-slate-900 text-white rounded">{value}</span>
    </div>
  )
}

function DiagnosisBlock({ dx }: { dx: AnyDiagnosis }) {
  return (
    <div className={`border rounded px-2 py-2 text-[11px] ${LEVEL_BLOCK[dx.level]}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`px-1.5 py-0.5 rounded font-semibold ${LEVEL_BADGE[dx.level]}`}>
          {LEVEL_ICON[dx.level]} {dx.label}
        </span>
      </div>
      {dx.detail && <div className="text-slate-700 mb-1">{dx.detail}</div>}
      {dx.remediation && (
        <div className="mt-1">
          <div className="font-semibold text-slate-700 mb-0.5">조치 방법</div>
          <pre className="whitespace-pre-wrap font-mono text-[10.5px] text-slate-700 leading-snug">
            {dx.remediation}
          </pre>
        </div>
      )}
    </div>
  )
}

function RegistryStatus({
  kind,
  status,
  error,
  loadedAt,
  count,
  onRefresh,
}: {
  kind: string
  status: 'idle' | 'loading' | 'ok' | 'error'
  error?: string
  loadedAt?: string
  count: number
  onRefresh: () => void
}) {
  if (status === 'loading' || status === 'idle') {
    return (
      <div className="px-3 py-2 border-b text-[11px] text-slate-500 bg-slate-50">
        {kind} 카탈로그 불러오는 중…
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="px-3 py-2 border-b text-[11px] bg-red-50 border-red-200 text-red-800 flex items-center justify-between gap-2">
        <div className="flex-1">
          <div className="font-semibold">⛔ {kind} 카탈로그 로드 실패</div>
          <div className="text-[10.5px] mt-0.5">{error}</div>
          <div className="text-[10.5px] mt-1 text-red-700">
            백엔드(http://localhost:8000)·CORS·D1 설정을 확인하세요.
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="text-xs px-2 py-1 bg-white border border-red-300 rounded hover:bg-red-100"
        >
          재시도
        </button>
      </div>
    )
  }
  return (
    <div className="px-3 py-2 border-b text-[11px] text-slate-600 bg-slate-50 flex items-center justify-between">
      <span>
        {kind} 카탈로그: <strong>{count}개</strong> · {loadedAt} 갱신
      </span>
      <button
        onClick={onRefresh}
        className="text-xs px-2 py-0.5 text-slate-500 hover:text-slate-800"
        title="카탈로그 다시 가져오기"
      >
        ↻
      </button>
    </div>
  )
}

function EventsTab({ entries }: { entries: ReadonlyArray<LogEntry> }) {
  if (entries.length === 0) {
    return (
      <div className="p-4 text-xs text-slate-500">
        아직 호출이 없습니다. 카드나 배너를 클릭해보세요.
      </div>
    )
  }
  return (
    <ul className="divide-y">
      {entries.map((e) => (
        <li key={e.id} className="px-3 py-2">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${KIND_COLOR[e.kind]}`}>
              {e.kind}
            </span>
            <span className="font-medium text-slate-800 text-xs">{e.label}</span>
            <span className={`text-[10px] ml-auto font-medium ${STATUS_COLOR[e.status]}`}>
              {e.status === 'pending' ? '…' : e.status === 'ok' ? '✓' : '✗'}
              {e.status === 'ok' && (e.kind === 'decide' || e.kind === 'assign') && (
                <span className="ml-1 font-mono">{String(e.response)}</span>
              )}
            </span>
          </div>
          {e.detail && (
            <pre className="text-[10px] text-slate-500 font-mono whitespace-pre-wrap break-all bg-slate-50 px-2 py-1 rounded mt-1">
              {JSON.stringify(e.detail, null, 0)}
            </pre>
          )}
          {e.error && <div className="text-[10px] text-red-600 mt-1">error: {e.error}</div>}
          <div className="text-[10px] text-slate-400 mt-0.5">{e.time}</div>
        </li>
      ))}
    </ul>
  )
}

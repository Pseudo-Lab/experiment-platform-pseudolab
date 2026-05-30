import { useSyncExternalStore, useState, useMemo, useEffect } from 'react'
import { devLog, type LogEntry } from '../lib/devLog'
import { flagRegistry, diagnoseFlag, type Diagnosis as FlagDiagnosis } from '../lib/flagRegistry'
import {
  experimentRegistry,
  type ExperimentMeta,
  type ExperimentStatus,
} from '../lib/experimentRegistry'
import { getUserId } from '../lib/userId'
import { Button } from '@/components/ui/button'
import { exampleCopy, type Lang } from '../i18n'

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

const LEVEL_BADGE: Record<FlagDiagnosis['level'], string> = {
  ok: 'bg-emerald-100 text-emerald-800',
  warn: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-800',
}
const LEVEL_BLOCK: Record<FlagDiagnosis['level'], string> = {
  ok: 'border-emerald-200 bg-emerald-50',
  warn: 'border-amber-300 bg-amber-50',
  error: 'border-red-300 bg-red-50',
}
const LEVEL_ICON: Record<FlagDiagnosis['level'], string> = {
  ok: '✓',
  warn: '⚠️',
  error: '⛔',
}

const EXP_STATUS_ICON: Record<ExperimentStatus, string> = {
  running: '🟢',
  paused: '🟡',
  draft: '⚪',
  completed: '⚫',
  archived: '🔴',
}

type Tab = 'flags' | 'events'

export function DevPanel({ lang }: { lang: Lang }) {
  const entries = useEntries()
  const expRegistry = useExperimentRegistry()
  const [open, setOpen] = useState(true)
  const [tab, setTab] = useState<Tab>('flags')
  const uid = getUserId()
  const t = exampleCopy

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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 rounded-full bg-slate-900 px-3 py-2 text-xs text-white shadow-lg hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
      >
        {t.devPanel[lang]}
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-h-[80vh] w-[calc(100vw-2rem)] flex-col rounded-lg border bg-white text-sm shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:w-[440px]">
      <header className="flex items-center justify-between rounded-t-lg border-b bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
        <div className="font-semibold text-slate-800 dark:text-slate-100">{t.devPanel[lang]}</div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => devLog.clear()}
            className="px-2 py-0.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            title={t.clearLogs[lang]}
          >
            {t.clear[lang]}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="px-2 py-0.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            aria-label="Close dev panel"
          >
            x
          </button>
        </div>
      </header>

      <div className="border-b px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
        <div className="flex items-center gap-2">
          <span className="font-medium">user_id:</span>
          <code className="font-mono text-[11px] text-slate-800 dark:text-slate-100">{uid}</code>
        </div>
      </div>

      <nav className="flex border-b text-xs dark:border-slate-800">
        <TabBtn
          label={`Flags (${Object.keys(flagState).length})`}
          active={tab === 'flags'}
          onClick={() => setTab('flags')}
        />
        <TabBtn
          label={`API (${entries.length})`}
          active={tab === 'events'}
          onClick={() => setTab('events')}
        />
      </nav>

      <div className="flex-1 overflow-auto">
        {tab === 'flags' && (
          <FlagsTab
            flagState={flagState}
            expsByFlagKey={expRegistry.experimentsByFlagKey}
            lang={lang}
          />
        )}
        {tab === 'events' && <EventsTab entries={entries} lang={lang} />}
      </div>

      <footer className="rounded-b-lg border-t bg-slate-50 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
        {t.useNewUser[lang]}
      </footer>
    </div>
  )
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 ${active ? 'border-b-2 border-slate-900 bg-white font-semibold dark:border-slate-100 dark:bg-slate-900 dark:text-slate-100' : 'bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400'}`}
    >
      {label}
    </button>
  )
}

function FlagsTab({
  flagState,
  expsByFlagKey,
  lang,
}: {
  flagState: Record<string, { variant: string; time: string }>
  expsByFlagKey: Record<string, ExperimentMeta[]>
  lang: Lang
}) {
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
        lang={lang}
      />
      {decidedKeys.length === 0 ? (
        <div className="p-4 text-xs text-slate-500 dark:text-slate-400">
          {exampleCopy.noDecisions[lang]}
        </div>
      ) : (
        <ul className="divide-y dark:divide-slate-800">
          {decidedKeys.map((flagKey) => {
            const { variant, time } = flagState[flagKey]
            const flag = registry.flagsByKey[flagKey]
            const dx = diagnoseFlag(flagKey, variant, flag, lang)
            const linkedExps = expsByFlagKey[flagKey] || []
            return (
              <li key={flagKey} className="px-3 py-3 space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{flagKey}</span>
                  <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs text-white dark:bg-slate-100 dark:text-slate-900">
                    {variant}
                  </span>
                  {linkedExps.map((exp) => (
                    <ExpInlineBadge key={exp.id} exp={exp} />
                  ))}
                </div>
                <div className="text-[10.5px] text-slate-400">{time}</div>
                <DiagnosisBlock dx={dx} lang={lang} />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function ExpInlineBadge({ exp }: { exp: ExperimentMeta }) {
  const icon = EXP_STATUS_ICON[exp.status] ?? '⚫'
  return (
    <span className="text-[11px] text-slate-500 dark:text-slate-400">
      {icon} {exp.status}
      {exp.primary_metric && <> · {exp.primary_metric}</>}
    </span>
  )
}

function DiagnosisBlock({ dx, lang }: { dx: FlagDiagnosis; lang: Lang }) {
  return (
    <div className={`border rounded px-2 py-2 text-[11px] ${LEVEL_BLOCK[dx.level]}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`px-1.5 py-0.5 rounded font-semibold ${LEVEL_BADGE[dx.level]}`}>
          {LEVEL_ICON[dx.level]} {dx.label}
        </span>
      </div>
      {dx.detail && <div className="mb-1 text-slate-700">{dx.detail}</div>}
      {dx.remediation && (
        <div className="mt-1">
          <div className="mb-0.5 font-semibold text-slate-700">{exampleCopy.action[lang]}</div>
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
  lang,
}: {
  kind: string
  status: 'idle' | 'loading' | 'ok' | 'error'
  error?: string
  loadedAt?: string
  count: number
  onRefresh: () => void
  lang: Lang
}) {
  if (status === 'loading' || status === 'idle') {
    return (
      <div className="border-b bg-slate-50 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
        {exampleCopy.loadingCatalog[lang](kind)}
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="flex items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800">
        <div className="flex-1">
          <div className="font-semibold">{exampleCopy.catalogLoadFailed[lang](kind)}</div>
          <div className="text-[10.5px] mt-0.5">{error}</div>
          <div className="text-[10.5px] mt-1 text-red-700">
            {exampleCopy.backendCheck[lang]}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="border-red-300 bg-white text-red-800 hover:bg-red-100"
        >
          {exampleCopy.retry[lang]}
        </Button>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between border-b bg-slate-50 px-3 py-2 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
      <span>{exampleCopy.catalogSummary[lang](kind, count, loadedAt)}</span>
      <button
        onClick={onRefresh}
        className="px-2 py-0.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        title={exampleCopy.refreshCatalog[lang]}
      >
        refresh
      </button>
    </div>
  )
}

function EventsTab({ entries, lang }: { entries: ReadonlyArray<LogEntry>; lang: Lang }) {
  if (entries.length === 0) {
    return (
      <div className="p-4 text-xs text-slate-500 dark:text-slate-400">
        {exampleCopy.noCalls[lang]}
      </div>
    )
  }
  return (
    <ul className="divide-y dark:divide-slate-800">
      {entries.map((e) => (
        <li key={e.id} className="px-3 py-2">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${KIND_COLOR[e.kind]}`}>
              {e.kind}
            </span>
            <span className="text-xs font-medium text-slate-800 dark:text-slate-100">{e.label}</span>
            <span className={`text-[10px] ml-auto font-medium ${STATUS_COLOR[e.status]}`}>
              {e.status === 'pending' ? '...' : e.status === 'ok' ? 'ok' : 'error'}
              {e.status === 'ok' && (e.kind === 'decide' || e.kind === 'assign') && (
                <span className="ml-1 font-mono">{String(e.response)}</span>
              )}
            </span>
          </div>
          {e.detail && (
            <pre className="mt-1 whitespace-pre-wrap break-all rounded bg-slate-50 px-2 py-1 font-mono text-[10px] text-slate-500 dark:bg-slate-950 dark:text-slate-400">
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

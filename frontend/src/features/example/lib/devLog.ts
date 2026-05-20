export type LogKind = 'decide' | 'track' | 'identify' | 'assign'

export type LogEntry = {
  id: number
  time: string
  kind: LogKind
  label: string // 예: flag_key 또는 event_name
  detail?: Record<string, unknown>
  status: 'pending' | 'ok' | 'error'
  response?: unknown
  error?: string
}

type Listener = () => void

let entries: ReadonlyArray<LogEntry> = []
const listeners = new Set<Listener>()
let nextId = 1

function notify() {
  listeners.forEach((l) => l())
}

export const devLog = {
  add(kind: LogKind, label: string, detail?: Record<string, unknown>): number {
    const id = nextId++
    const entry: LogEntry = {
      id,
      time: new Date().toLocaleTimeString(),
      kind,
      label,
      detail,
      status: 'pending',
    }
    entries = [entry, ...entries].slice(0, 30)
    notify()
    return id
  },
  update(id: number, patch: Partial<LogEntry>) {
    entries = entries.map((e) => (e.id === id ? { ...e, ...patch } : e))
    notify()
  },
  subscribe(l: Listener) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
  getSnapshot(): ReadonlyArray<LogEntry> {
    return entries
  },
  clear() {
    entries = []
    notify()
  },
}

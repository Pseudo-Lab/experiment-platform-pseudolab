import { Link, NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import { getUserId, resetUserId } from '../lib/userId'
import { useState } from 'react'
import { DevPanel } from './DevPanel'

export function Layout({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState(getUserId())

  const handleReset = () => {
    sessionStorage.clear()
    setUid(resetUserId())
    window.location.reload()
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 rounded-md text-sm font-medium ${
      isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
    }`

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-slate-900">
            Demo App
          </Link>
          <nav className="flex items-center gap-2">
            <NavLink to="/" className={linkClass} end>
              홈
            </NavLink>
            <NavLink to="/studies" className={linkClass}>
              스터디 목록
            </NavLink>
          </nav>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span title={uid}>uid: {uid.slice(0, 8)}…</span>
            <button
              onClick={handleReset}
              className="px-2 py-1 rounded border text-slate-600 hover:bg-slate-100"
              title="새 user_id를 발급해 다른 variant로 재배정합니다"
            >
              새 사용자
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      <DevPanel />
    </div>
  )
}

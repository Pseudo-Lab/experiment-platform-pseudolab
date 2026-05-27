import { Link, NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import { getUserId, resetUserId } from '../lib/userId'
import { useState } from 'react'
import { DevPanel } from './DevPanel'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { exampleCopy, type Lang } from '../i18n'

export function Layout({ children, lang }: { children: ReactNode; lang: Lang }) {
  const [uid, setUid] = useState(getUserId())
  const t = exampleCopy

  const handleReset = () => {
    sessionStorage.clear()
    setUid(resetUserId())
    window.location.reload()
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      buttonVariants({ variant: isActive ? 'default' : 'ghost', size: 'sm' }),
      'rounded-lg',
    )

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <Link to="/example" className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {t.appTitle[lang]}
          </Link>
          <nav className="flex flex-wrap items-center gap-2">
            <NavLink to="/example" className={linkClass} end>
              {t.home[lang]}
            </NavLink>
            <NavLink to="/example/studies" className={linkClass}>
              {t.studies[lang]}
            </NavLink>
          </nav>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span title={uid}>
              {t.uid[lang]}: {uid.slice(0, 8)}...
            </span>
            <Button
              type="button"
              onClick={handleReset}
              variant="outline"
              size="sm"
              title={t.newUserTitle[lang]}
            >
              {t.newUser[lang]}
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">{children}</main>
      <DevPanel lang={lang} />
    </div>
  )
}

import { useState } from 'react'
import { useFeatureFlag } from '../hooks/useFeatureFlag'
import { useTrack } from '../hooks/useTrack'
import { Button } from '@/components/ui/button'
import type { Lang } from '../i18n'
import { exampleCopy } from '../i18n'

interface ExperimentCardProps {
  flagKey: string
  label: string
  description: string
  variants: {
    name: string
    label: string
    preview: React.ReactNode
  }[]
  eventName: string
  lang: Lang
}

function VariantBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
      {/* you */}
      ✓ yours
    </span>
  ) : null
}

function ExperimentCard({ flagKey, label, description, variants, eventName, lang }: ExperimentCardProps) {
  const { variant, isLoading } = useFeatureFlag(flagKey)
  const track = useTrack()
  const [sent, setSent] = useState(false)

  const handleSend = () => {
    track(eventName, { flag_key: flagKey, variant })
    setSent(true)
    setTimeout(() => setSent(false), 2000)
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{label}</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <code className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {flagKey}
        </code>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        {variants.map((v) => {
          const isActive = !isLoading && variant === v.name
          return (
            <div
              key={v.name}
              className={`rounded-xl border-2 p-4 transition-colors ${
                isActive
                  ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950/30'
                  : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50'
              }`}
            >
              <div className="mb-3 flex items-center gap-2">
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-300 text-slate-600 dark:bg-slate-600 dark:text-slate-300'
                  }`}
                >
                  {v.name}
                </span>
                {isLoading ? (
                  <span className="h-4 w-14 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                ) : (
                  <VariantBadge active={isActive} />
                )}
                <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">{v.label}</span>
              </div>
              <div className="overflow-hidden rounded-lg">{v.preview}</div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          onClick={handleSend}
          disabled={isLoading}
          className="rounded-lg"
        >
          {sent
            ? exampleCopy.eventSent[lang]
            : exampleCopy.sendTestEvent[lang]}
        </Button>
        {!isLoading && (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            → <code className="font-mono">{eventName}</code>{' '}
            <span className="text-slate-500">variant=</span>
            <code className="font-mono text-indigo-600 dark:text-indigo-400">{variant}</code>
          </span>
        )}
      </div>
    </div>
  )
}

// ── mini previews ────────────────────────────────────────────────────────────

function GridPreview() {
  return (
    <div className="grid grid-cols-3 gap-1.5 p-2">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-12 rounded bg-slate-200 dark:bg-slate-600"
        />
      ))}
    </div>
  )
}

function ListPreview() {
  return (
    <div className="flex flex-col gap-1.5 p-2">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded bg-slate-200 px-3 py-2 dark:bg-slate-600"
        >
          <div className="h-3 w-3 rounded-full bg-slate-400 dark:bg-slate-400 shrink-0" />
          <div className="h-2 flex-1 rounded bg-slate-300 dark:bg-slate-500" />
        </div>
      ))}
    </div>
  )
}

function InlinePreview() {
  return (
    <div className="flex flex-col gap-1 p-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-7 rounded bg-slate-200 dark:bg-slate-600" />
      ))}
      <div className="h-7 rounded border-2 border-dashed border-amber-400 bg-amber-50 dark:bg-amber-900/20" />
      {[3, 4, 5].map((i) => (
        <div key={i} className="h-7 rounded bg-slate-200 dark:bg-slate-600" />
      ))}
    </div>
  )
}

function SidebarPreview() {
  return (
    <div className="flex gap-2 p-2">
      <div className="flex flex-1 flex-col gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-6 rounded bg-slate-200 dark:bg-slate-600" />
        ))}
      </div>
      <div className="w-14 rounded border-2 border-dashed border-amber-400 bg-amber-50 dark:bg-amber-900/20" />
    </div>
  )
}

// ── page ─────────────────────────────────────────────────────────────────────

export function ExperimentShowcase({ lang }: { lang: Lang }) {
  const t = exampleCopy

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {t.experimentShowcaseTitle[lang]}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t.experimentShowcaseDescription[lang]}
        </p>
      </div>

      <ExperimentCard
        flagKey="home_layout_v1"
        label={lang === 'ko' ? '홈 레이아웃 실험' : 'Home layout experiment'}
        description={
          lang === 'ko'
            ? '스터디 목록을 그리드(control)로 보여줄지 리스트(treatment)로 보여줄지 테스트합니다.'
            : 'Tests whether showing studies in a grid (control) or list (treatment) drives more clicks.'
        }
        variants={[
          {
            name: 'control',
            label: lang === 'ko' ? '그리드' : 'Grid',
            preview: <GridPreview />,
          },
          {
            name: 'list',
            label: lang === 'ko' ? '리스트' : 'List',
            preview: <ListPreview />,
          },
        ]}
        eventName="showcase_cta_clicked"
        lang={lang}
      />

      <ExperimentCard
        flagKey="sponsor_slot_v1"
        label={lang === 'ko' ? '스폰서 슬롯 실험' : 'Sponsor slot experiment'}
        description={
          lang === 'ko'
            ? '스폰서 배너를 인라인(control)으로 삽입할지 사이드바(treatment)에 배치할지 테스트합니다.'
            : 'Tests whether inline sponsor insertion (control) or a sidebar placement (treatment) gets more clicks.'
        }
        variants={[
          {
            name: 'control',
            label: lang === 'ko' ? '인라인' : 'Inline',
            preview: <InlinePreview />,
          },
          {
            name: 'sidebar',
            label: lang === 'ko' ? '사이드바' : 'Sidebar',
            preview: <SidebarPreview />,
          },
        ]}
        eventName="showcase_cta_clicked"
        lang={lang}
      />
    </section>
  )
}

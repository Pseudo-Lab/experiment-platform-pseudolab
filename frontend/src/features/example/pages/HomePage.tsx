import { useFlag } from '../hooks/useFlag'
import { track } from '../lib/sdk'
import { mockStudies, type Study } from '../data/mockStudies'
import { StudyGrid } from '../components/StudyGrid'
import { StudyList } from '../components/StudyList'
import { exampleCopy, type Lang } from '../i18n'

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
    </div>
  )
}

export function HomePage({ lang }: { lang: Lang }) {
  const variant = useFlag('home_layout_v1')
  if (!variant) return <Skeleton />

  const onCardClick = (study: Study) => {
    track('study_card_clicked', {
      variant,
      study_id: study.id,
      flag_key: 'home_layout_v1',
    })
  }

  return (
    <section>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {exampleCopy.activeStudies[lang]}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {exampleCopy.activeStudiesDescription[lang]}
          </p>
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          home_layout_v1 = <code className="font-mono">{variant}</code>
        </span>
      </div>
      {variant === 'list' ? (
        <StudyList studies={mockStudies} lang={lang} onClick={onCardClick} />
      ) : (
        <StudyGrid studies={mockStudies} lang={lang} onClick={onCardClick} />
      )}
    </section>
  )
}

import { useFlag } from '../hooks/useFlag'
import { track } from '../lib/sdk'
import { mockStudies, type Study } from '../data/mockStudies'
import { StudyGrid } from '../components/StudyGrid'
import { StudyList } from '../components/StudyList'

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-40 bg-slate-200 rounded animate-pulse" />
        ))}
      </div>
    </div>
  )
}

export function HomePage() {
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
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">진행 중인 스터디</h1>
          <p className="text-sm text-slate-600 mt-1">
            관심 있는 스터디를 클릭해보세요.
          </p>
        </div>
        <span className="text-xs text-slate-400">
          home_layout_v1 = <code className="font-mono">{variant}</code>
        </span>
      </div>
      {variant === 'list' ? (
        <StudyList studies={mockStudies} onClick={onCardClick} />
      ) : (
        <StudyGrid studies={mockStudies} onClick={onCardClick} />
      )}
    </section>
  )
}

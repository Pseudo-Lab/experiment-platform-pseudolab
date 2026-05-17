import type { Study } from '../data/mockStudies'

type Props = {
  study: Study
  layout: 'grid' | 'list'
  onClick: () => void
}

export function StudyCard({ study, layout, onClick }: Props) {
  if (layout === 'list') {
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center gap-4 p-4 bg-white border rounded-lg hover:shadow-md transition text-left"
      >
        <span className="text-3xl">{study.emoji}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-slate-900">{study.title}</h3>
            <span className="text-xs text-slate-500">멤버 {study.members}명</span>
          </div>
          <p className="text-sm text-slate-600 mb-2">{study.description}</p>
          <div className="flex gap-1.5">
            {study.tags.map((t) => (
              <span key={t} className="text-xs px-2 py-0.5 bg-slate-100 rounded">
                {t}
              </span>
            ))}
          </div>
        </div>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="flex flex-col p-5 bg-white border rounded-lg hover:shadow-md transition text-left h-full"
    >
      <div className="text-4xl mb-3">{study.emoji}</div>
      <h3 className="font-semibold text-slate-900 mb-1">{study.title}</h3>
      <p className="text-sm text-slate-600 mb-3 flex-1">{study.description}</p>
      <div className="flex gap-1.5 mb-2 flex-wrap">
        {study.tags.map((t) => (
          <span key={t} className="text-xs px-2 py-0.5 bg-slate-100 rounded">
            {t}
          </span>
        ))}
      </div>
      <div className="text-xs text-slate-500">멤버 {study.members}명</div>
    </button>
  )
}

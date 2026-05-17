import type { Study } from '../data/mockStudies'
import { StudyCard } from './StudyCard'

type Props = {
  studies: Study[]
  onClick: (study: Study) => void
}

export function StudyGrid({ studies, onClick }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {studies.map((s) => (
        <StudyCard key={s.id} study={s} layout="grid" onClick={() => onClick(s)} />
      ))}
    </div>
  )
}

import type { Study } from '../data/mockStudies'
import { StudyCard } from './StudyCard'

type Props = {
  studies: Study[]
  onClick: (study: Study) => void
}

export function StudyList({ studies, onClick }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {studies.map((s) => (
        <StudyCard key={s.id} study={s} layout="list" onClick={() => onClick(s)} />
      ))}
    </div>
  )
}

import type { Study } from '../data/mockStudies'
import { StudyCard } from './StudyCard'
import type { Lang } from '../i18n'

type Props = {
  studies: Study[]
  onClick: (study: Study) => void
  lang: Lang
}

export function StudyGrid({ studies, onClick, lang }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {studies.map((s) => (
        <StudyCard key={s.id} study={s} layout="grid" lang={lang} onClick={() => onClick(s)} />
      ))}
    </div>
  )
}

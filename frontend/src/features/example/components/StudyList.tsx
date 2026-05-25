import type { Study } from '../data/mockStudies'
import { StudyCard } from './StudyCard'
import type { Lang } from '../i18n'

type Props = {
  studies: Study[]
  onClick: (study: Study) => void
  lang: Lang
}

export function StudyList({ studies, onClick, lang }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {studies.map((s) => (
        <StudyCard key={s.id} study={s} layout="list" lang={lang} onClick={() => onClick(s)} />
      ))}
    </div>
  )
}

import type { Study } from '../data/mockStudies'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { exampleCopy, text, type Lang } from '../i18n'

type Props = {
  study: Study
  layout: 'grid' | 'list'
  onClick: () => void
  lang: Lang
}

export function StudyCard({ study, layout, onClick, lang }: Props) {
  const title = text(study.title, lang)
  const description = text(study.description, lang)
  const tags = study.tags[lang]
  const memberLabel = exampleCopy.memberCount[lang](study.members)

  if (layout === 'list') {
    return (
      <Card className="shadow-sm transition hover:shadow-md">
        <button
          type="button"
          onClick={onClick}
          className="flex w-full items-center gap-4 p-4 text-left"
        >
          <span className="text-3xl" aria-hidden="true">
            {study.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">{memberLabel}</span>
            </div>
            <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">{description}</p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="font-medium">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </button>
      </Card>
    )
  }

  return (
    <Card className="h-full shadow-sm transition hover:shadow-md">
      <button type="button" onClick={onClick} className="flex h-full w-full flex-col p-5 text-left">
        <div className="mb-3 text-4xl" aria-hidden="true">
          {study.emoji}
        </div>
        <h3 className="mb-1 font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <p className="mb-3 flex-1 text-sm text-slate-600 dark:text-slate-300">{description}</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="font-medium">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{memberLabel}</div>
      </button>
    </Card>
  )
}

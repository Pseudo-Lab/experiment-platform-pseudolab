import type { Sponsor } from '../data/mockSponsors'
import { Button } from '@/components/ui/button'
import { exampleCopy, text, type Lang } from '../i18n'

type Props = {
  sponsor: Sponsor
  placement: 'sidebar' | 'inline'
  onClick: () => void
  lang: Lang
}

export function SponsorBanner({ sponsor, placement, onClick, lang }: Props) {
  const headline = text(sponsor.headline, lang)
  const body = text(sponsor.body, lang)
  const cta = text(sponsor.cta, lang)

  if (placement === 'sidebar') {
    return (
      <aside className={`sticky top-6 rounded-lg border p-5 ${sponsor.accent}`}>
        <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">
          {exampleCopy.sponsored[lang]} / {sponsor.brand}
        </div>
        <h4 className="mb-2 font-semibold text-slate-900">{headline}</h4>
        <p className="mb-4 text-sm text-slate-700">{body}</p>
        <Button
          type="button"
          onClick={onClick}
          className="w-full"
        >
          {cta}
        </Button>
      </aside>
    )
  }

  return (
    <div className={`flex flex-col gap-4 rounded-lg border p-5 sm:flex-row sm:items-center ${sponsor.accent}`}>
      <div className="flex-1">
        <div className="mb-1 text-xs uppercase tracking-wider text-slate-500">
          {exampleCopy.sponsored[lang]} / {sponsor.brand}
        </div>
        <h4 className="mb-1 font-semibold text-slate-900">{headline}</h4>
        <p className="text-sm text-slate-700">{body}</p>
      </div>
      <Button
        type="button"
        onClick={onClick}
        className="w-full whitespace-nowrap sm:w-auto"
      >
        {cta}
      </Button>
    </div>
  )
}

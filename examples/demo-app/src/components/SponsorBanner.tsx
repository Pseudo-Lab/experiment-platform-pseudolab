import type { Sponsor } from '../data/mockSponsors'

type Props = {
  sponsor: Sponsor
  placement: 'sidebar' | 'inline'
  onClick: () => void
}

export function SponsorBanner({ sponsor, placement, onClick }: Props) {
  if (placement === 'sidebar') {
    return (
      <aside className={`border rounded-lg p-5 ${sponsor.accent} sticky top-6`}>
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
          Sponsored · {sponsor.brand}
        </div>
        <h4 className="font-semibold text-slate-900 mb-2">{sponsor.headline}</h4>
        <p className="text-sm text-slate-700 mb-4">{sponsor.body}</p>
        <button
          onClick={onClick}
          className="w-full px-3 py-2 bg-slate-900 text-white rounded text-sm font-medium hover:bg-slate-800"
        >
          {sponsor.cta}
        </button>
      </aside>
    )
  }

  return (
    <div className={`border rounded-lg p-5 ${sponsor.accent} flex items-center gap-4`}>
      <div className="flex-1">
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">
          Sponsored · {sponsor.brand}
        </div>
        <h4 className="font-semibold text-slate-900 mb-1">{sponsor.headline}</h4>
        <p className="text-sm text-slate-700">{sponsor.body}</p>
      </div>
      <button
        onClick={onClick}
        className="px-4 py-2 bg-slate-900 text-white rounded text-sm font-medium hover:bg-slate-800 whitespace-nowrap"
      >
        {sponsor.cta}
      </button>
    </div>
  )
}

import { useFlag } from '../hooks/useFlag'
import { track } from '../lib/sdk'
import { mockStudies } from '../data/mockStudies'
import { mockSponsors, type Sponsor } from '../data/mockSponsors'
import { StudyCard } from '../components/StudyCard'
import { SponsorBanner } from '../components/SponsorBanner'
import { exampleCopy, type Lang } from '../i18n'

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
    </div>
  )
}

export function StudyListPage({ lang }: { lang: Lang }) {
  const variant = useFlag('sponsor_slot_v1')
  if (!variant) return <Skeleton />

  const onSponsorClick = (sponsor: Sponsor) => {
    track('sponsor_clicked', {
      variant,
      sponsor_id: sponsor.id,
      flag_key: 'sponsor_slot_v1',
    })
  }

  const onStudyClick = (id: string) => {
    track('study_card_clicked', {
      variant: 'n/a',
      study_id: id,
      page: 'studies',
    })
  }

  const primarySponsor = mockSponsors[0]
  const inlineSponsors = mockSponsors

  if (variant === 'sidebar') {
    return (
      <section>
        <Header variant={variant} lang={lang} />
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1 space-y-3">
            {mockStudies.map((s) => (
              <StudyCard
                key={s.id}
                study={s}
                layout="list"
                lang={lang}
                onClick={() => onStudyClick(s.id)}
              />
            ))}
          </div>
          <div className="w-full shrink-0 lg:w-72">
            <SponsorBanner
              sponsor={primarySponsor}
              placement="sidebar"
              lang={lang}
              onClick={() => onSponsorClick(primarySponsor)}
            />
          </div>
        </div>
      </section>
    )
  }

  // inline variant: 스터디 3개마다 스폰서 배너 삽입
  const items: Array<{ type: 'study'; id: string } | { type: 'sponsor'; sponsor: Sponsor }> = []
  let sponsorIdx = 0
  mockStudies.forEach((s, i) => {
    items.push({ type: 'study', id: s.id })
    if ((i + 1) % 3 === 0 && sponsorIdx < inlineSponsors.length) {
      items.push({ type: 'sponsor', sponsor: inlineSponsors[sponsorIdx] })
      sponsorIdx += 1
    }
  })

  return (
    <section>
      <Header variant={variant} lang={lang} />
      <div className="space-y-3">
        {items.map((item, i) =>
          item.type === 'study' ? (
            <StudyCard
              key={`s-${item.id}`}
              study={mockStudies.find((s) => s.id === item.id)!}
              layout="list"
              lang={lang}
              onClick={() => onStudyClick(item.id)}
            />
          ) : (
            <SponsorBanner
              key={`ad-${i}`}
              sponsor={item.sponsor}
              placement="inline"
              lang={lang}
              onClick={() => onSponsorClick(item.sponsor)}
            />
          ),
        )}
      </div>
    </section>
  )
}

function Header({ variant, lang }: { variant: string; lang: Lang }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {exampleCopy.allStudies[lang]}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {exampleCopy.allStudiesDescription[lang]}
        </p>
      </div>
      <span className="text-xs text-slate-400 dark:text-slate-500">
        sponsor_slot_v1 = <code className="font-mono">{variant}</code>
      </span>
    </div>
  )
}

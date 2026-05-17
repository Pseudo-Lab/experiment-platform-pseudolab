import { useFlag } from '../hooks/useFlag'
import { track } from '../lib/sdk'
import { mockStudies } from '../data/mockStudies'
import { mockSponsors, type Sponsor } from '../data/mockSponsors'
import { StudyCard } from '../components/StudyCard'
import { SponsorBanner } from '../components/SponsorBanner'

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-slate-200 rounded animate-pulse" />
        ))}
      </div>
    </div>
  )
}

export function StudyListPage() {
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
        <Header variant={variant} />
        <div className="flex gap-6">
          <div className="flex-1 space-y-3">
            {mockStudies.map((s) => (
              <StudyCard
                key={s.id}
                study={s}
                layout="list"
                onClick={() => onStudyClick(s.id)}
              />
            ))}
          </div>
          <div className="w-72 shrink-0">
            <SponsorBanner
              sponsor={primarySponsor}
              placement="sidebar"
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
      <Header variant={variant} />
      <div className="space-y-3">
        {items.map((item, i) =>
          item.type === 'study' ? (
            <StudyCard
              key={`s-${item.id}`}
              study={mockStudies.find((s) => s.id === item.id)!}
              layout="list"
              onClick={() => onStudyClick(item.id)}
            />
          ) : (
            <SponsorBanner
              key={`ad-${i}`}
              sponsor={item.sponsor}
              placement="inline"
              onClick={() => onSponsorClick(item.sponsor)}
            />
          ),
        )}
      </div>
    </section>
  )
}

function Header({ variant }: { variant: string }) {
  return (
    <div className="mb-6 flex items-end justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">전체 스터디</h1>
        <p className="text-sm text-slate-600 mt-1">
          스터디 목록과 스폰서 안내를 함께 보여드립니다.
        </p>
      </div>
      <span className="text-xs text-slate-400">
        sponsor_slot_v1 = <code className="font-mono">{variant}</code>
      </span>
    </div>
  )
}

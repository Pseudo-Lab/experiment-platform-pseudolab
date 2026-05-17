export type Sponsor = {
  id: string
  brand: string
  headline: string
  body: string
  cta: string
  accent: string // tailwind bg class
}

export const mockSponsors: Sponsor[] = [
  {
    id: 'sponsor-001',
    brand: 'CloudCompute',
    headline: '학생·연구자 무료 GPU 크레딧',
    body: 'A100 / H100 GPU를 월 100시간 무료로. 가짜연구소 멤버 전용 혜택.',
    cta: '크레딧 받기 →',
    accent: 'bg-blue-50 border-blue-200',
  },
  {
    id: 'sponsor-002',
    brand: 'DataLake',
    headline: 'AI 엔지니어 채용 중',
    body: '시니어/주니어 ML 엔지니어 상시 채용. 가짜연구소 출신 우대.',
    cta: '채용 페이지 보기 →',
    accent: 'bg-emerald-50 border-emerald-200',
  },
  {
    id: 'sponsor-003',
    brand: 'BookHaus',
    headline: 'AI 도서 30% 할인',
    body: '딥러닝·LLM·MLOps 신간 30% 할인 쿠폰을 이번 주에만.',
    cta: '쿠폰 받기 →',
    accent: 'bg-amber-50 border-amber-200',
  },
]

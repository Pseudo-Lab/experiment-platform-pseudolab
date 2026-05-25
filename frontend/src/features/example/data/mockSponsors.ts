import type { LocalizedText } from '../i18n'

export type Sponsor = {
  id: string
  brand: string
  headline: LocalizedText
  body: LocalizedText
  cta: LocalizedText
  accent: string // tailwind bg class
}

export const mockSponsors: Sponsor[] = [
  {
    id: 'sponsor-001',
    brand: 'CloudCompute',
    headline: {
      en: 'Free GPU credits for students and researchers',
      ko: '학생·연구자 무료 GPU 크레딧',
    },
    body: {
      en: 'A100 / H100 GPU access for 100 hours per month, reserved for PseudoLab members.',
      ko: 'A100 / H100 GPU를 월 100시간 무료로. 가짜연구소 멤버 전용 혜택.',
    },
    cta: {
      en: 'Claim credits',
      ko: '크레딧 받기',
    },
    accent: 'bg-blue-50 border-blue-200',
  },
  {
    id: 'sponsor-002',
    brand: 'DataLake',
    headline: {
      en: 'Hiring AI engineers',
      ko: 'AI 엔지니어 채용 중',
    },
    body: {
      en: 'Open roles for senior and junior ML engineers, with preferred review for PseudoLab alumni.',
      ko: '시니어/주니어 ML 엔지니어 상시 채용. 가짜연구소 출신 우대.',
    },
    cta: {
      en: 'View openings',
      ko: '채용 페이지 보기',
    },
    accent: 'bg-emerald-50 border-emerald-200',
  },
  {
    id: 'sponsor-003',
    brand: 'BookHaus',
    headline: {
      en: '30% off AI books',
      ko: 'AI 도서 30% 할인',
    },
    body: {
      en: 'This week only: 30% coupons for new deep learning, LLM, and MLOps titles.',
      ko: '딥러닝·LLM·MLOps 신간 30% 할인 쿠폰을 이번 주에만.',
    },
    cta: {
      en: 'Get coupon',
      ko: '쿠폰 받기',
    },
    accent: 'bg-amber-50 border-amber-200',
  },
]

import type { LocalizedText, Lang } from '../i18n'

export type Study = {
  id: string
  title: LocalizedText
  description: LocalizedText
  tags: Record<Lang, string[]>
  members: number
  emoji: string
}

export const mockStudies: Study[] = [
  {
    id: 'study-001',
    title: {
      en: 'Hands-on LLM Fine-tuning',
      ko: 'LLM 파인튜닝 실전 스터디',
    },
    description: {
      en: 'Fine-tune open source LLMs and apply them to real product scenarios.',
      ko: '오픈소스 LLM을 직접 파인튜닝하며 실제 서비스에 적용해봅니다.',
    },
    tags: {
      en: ['LLM', 'Fine-tuning', 'PyTorch'],
      ko: ['LLM', 'Fine-tuning', 'PyTorch'],
    },
    members: 24,
    emoji: '🤖',
  },
  {
    id: 'study-002',
    title: {
      en: 'Data Visualization with D3.js',
      ko: '데이터 시각화 with D3.js',
    },
    description: {
      en: 'Build interactive charts with D3.js and practice data storytelling.',
      ko: 'D3.js로 인터랙티브 차트를 만들고 데이터 스토리텔링을 배웁니다.',
    },
    tags: {
      en: ['D3', 'Visualization', 'Frontend'],
      ko: ['D3', '시각화', 'Frontend'],
    },
    members: 18,
    emoji: '📊',
  },
  {
    id: 'study-003',
    title: {
      en: 'Mastering Reinforcement Learning',
      ko: '강화학습 알고리즘 정복',
    },
    description: {
      en: 'Implement PPO, SAC, DQN, and other modern RL algorithms in code.',
      ko: 'PPO, SAC, DQN 등 최신 강화학습 알고리즘을 코드로 구현합니다.',
    },
    tags: {
      en: ['RL', 'PyTorch', 'Papers'],
      ko: ['RL', 'PyTorch', '논문'],
    },
    members: 15,
    emoji: '🎮',
  },
  {
    id: 'study-004',
    title: {
      en: 'Practical MLOps Project',
      ko: 'MLOps 실무 프로젝트',
    },
    description: {
      en: 'Build a model serving pipeline on Kubernetes from the ground up.',
      ko: 'Kubernetes 위에서 모델 서빙 파이프라인을 직접 구축합니다.',
    },
    tags: {
      en: ['MLOps', 'K8s', 'CI/CD'],
      ko: ['MLOps', 'K8s', 'CI/CD'],
    },
    members: 21,
    emoji: '⚙️',
  },
  {
    id: 'study-005',
    title: {
      en: 'Vision Paper Reading Club',
      ko: '논문 리딩 클럽 - Vision',
    },
    description: {
      en: 'Read and discuss key computer vision papers together every week.',
      ko: '매주 컴퓨터 비전 주요 논문을 함께 읽고 토론합니다.',
    },
    tags: {
      en: ['Vision', 'Papers', 'Talks'],
      ko: ['Vision', '논문', '발표'],
    },
    members: 32,
    emoji: '👁️',
  },
  {
    id: 'study-006',
    title: {
      en: 'Systems Programming with Rust',
      ko: 'Rust로 배우는 시스템 프로그래밍',
    },
    description: {
      en: 'Move from Rust fundamentals to memory-safe systems programming.',
      ko: 'Rust 기초부터 메모리 안전 시스템 코드 작성까지.',
    },
    tags: {
      en: ['Rust', 'Systems'],
      ko: ['Rust', 'Systems'],
    },
    members: 12,
    emoji: '🦀',
  },
  {
    id: 'study-007',
    title: {
      en: 'Hands-on Recommender Systems',
      ko: 'Recommender Systems 핸즈온',
    },
    description: {
      en: 'Implement everything from collaborative filtering to deep learning recommenders.',
      ko: '협업 필터링부터 딥러닝 기반 추천까지 직접 구현해봅니다.',
    },
    tags: {
      en: ['Recommendations', 'PyTorch', 'Production'],
      ko: ['추천', 'PyTorch', 'Production'],
    },
    members: 19,
    emoji: '🎯',
  },
  {
    id: 'study-008',
    title: {
      en: 'TypeScript Master Class',
      ko: 'TypeScript 마스터 클래스',
    },
    description: {
      en: 'Dive into advanced type systems, generics, and utility types.',
      ko: '고급 타입 시스템, 제네릭, 유틸리티 타입을 깊이 다룹니다.',
    },
    tags: {
      en: ['TypeScript', 'Frontend'],
      ko: ['TypeScript', 'Frontend'],
    },
    members: 27,
    emoji: '🔷',
  },
]

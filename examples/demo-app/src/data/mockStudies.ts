export type Study = {
  id: string
  title: string
  description: string
  tags: string[]
  members: number
  emoji: string
}

export const mockStudies: Study[] = [
  {
    id: 'study-001',
    title: 'LLM 파인튜닝 실전 스터디',
    description: '오픈소스 LLM을 직접 파인튜닝하며 실제 서비스에 적용해봅니다.',
    tags: ['LLM', 'Fine-tuning', 'PyTorch'],
    members: 24,
    emoji: '🤖',
  },
  {
    id: 'study-002',
    title: '데이터 시각화 with D3.js',
    description: 'D3.js로 인터랙티브 차트를 만들고 데이터 스토리텔링을 배웁니다.',
    tags: ['D3', '시각화', 'Frontend'],
    members: 18,
    emoji: '📊',
  },
  {
    id: 'study-003',
    title: '강화학습 알고리즘 정복',
    description: 'PPO, SAC, DQN 등 최신 강화학습 알고리즘을 코드로 구현합니다.',
    tags: ['RL', 'PyTorch', '논문'],
    members: 15,
    emoji: '🎮',
  },
  {
    id: 'study-004',
    title: 'MLOps 실무 프로젝트',
    description: 'Kubernetes 위에서 모델 서빙 파이프라인을 직접 구축합니다.',
    tags: ['MLOps', 'K8s', 'CI/CD'],
    members: 21,
    emoji: '⚙️',
  },
  {
    id: 'study-005',
    title: '논문 리딩 클럽 — Vision',
    description: '매주 컴퓨터 비전 주요 논문을 함께 읽고 토론합니다.',
    tags: ['Vision', '논문', '발표'],
    members: 32,
    emoji: '👁️',
  },
  {
    id: 'study-006',
    title: 'Rust로 배우는 시스템 프로그래밍',
    description: 'Rust 기초부터 메모리 안전 시스템 코드 작성까지.',
    tags: ['Rust', 'Systems'],
    members: 12,
    emoji: '🦀',
  },
  {
    id: 'study-007',
    title: 'Recommender Systems 핸즈온',
    description: '협업 필터링부터 딥러닝 기반 추천까지 직접 구현해봅니다.',
    tags: ['추천', 'PyTorch', 'Production'],
    members: 19,
    emoji: '🎯',
  },
  {
    id: 'study-008',
    title: 'TypeScript 마스터 클래스',
    description: '고급 타입 시스템, 제네릭, 유틸리티 타입을 깊이 다룹니다.',
    tags: ['TypeScript', 'Frontend'],
    members: 27,
    emoji: '🔷',
  },
]

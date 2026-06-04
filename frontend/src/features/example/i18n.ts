export type Lang = 'en' | 'ko'

export type LocalizedText = Record<Lang, string>

export function text(value: LocalizedText, lang: Lang): string {
  return value[lang]
}

export const exampleCopy = {
  appTitle: {
    en: 'Example App',
    ko: '예제 앱',
  },
  home: {
    en: 'Home',
    ko: '홈',
  },
  studies: {
    en: 'Study catalog',
    ko: '스터디 목록',
  },
  uid: {
    en: 'uid',
    ko: 'uid',
  },
  newUser: {
    en: 'New user',
    ko: '새 사용자',
  },
  newUserTitle: {
    en: 'Issue a new user_id and receive a different variant assignment.',
    ko: '새 user_id를 발급해 다른 variant로 재배정합니다.',
  },
  activeStudies: {
    en: 'Active studies',
    ko: '진행 중인 스터디',
  },
  activeStudiesDescription: {
    en: 'Click a study that looks interesting.',
    ko: '관심 있는 스터디를 클릭해보세요.',
  },
  allStudies: {
    en: 'All studies',
    ko: '전체 스터디',
  },
  allStudiesDescription: {
    en: 'Browse studies with contextual sponsor placements.',
    ko: '스터디 목록과 스폰서 안내를 함께 보여드립니다.',
  },
  memberCount: {
    en: (count: number) => `${count} members`,
    ko: (count: number) => `멤버 ${count}명`,
  },
  sponsored: {
    en: 'Sponsored',
    ko: 'Sponsored',
  },
  devPanel: {
    en: 'Dev Panel',
    ko: 'Dev Panel',
  },
  clear: {
    en: 'Clear',
    ko: '비우기',
  },
  clearLogs: {
    en: 'Clear logs',
    ko: '로그 비우기',
  },
  useNewUser: {
    en: 'Use the New user button in the header to try another variant.',
    ko: '헤더의 새 사용자 버튼으로 다른 variant를 받아볼 수 있어요.',
  },
  noDecisions: {
    en: 'No decide calls yet. Refresh the page or use New user in the header.',
    ko: '아직 decide 호출이 없습니다. 페이지를 새로고침 하거나 헤더의 새 사용자를 눌러보세요.',
  },
  noMappedExperiments: {
    en: 'No experiments linked to the decided flags. Set Experiment.flag_key in the admin console to link.',
    ko: 'decide 호출이 발생한 Flag에 연결된 실험이 없습니다. 관리자 콘솔에서 실험의 flag_key를 지정해 연결하세요.',
  },
  unassigned: {
    en: 'Unassigned',
    ko: '미배정',
  },
  experimentId: {
    en: 'Experiment ID',
    ko: '실험 ID',
  },
  action: {
    en: 'Action',
    ko: '조치 방법',
  },
  loadingCatalog: {
    en: (kind: string) => `Loading ${kind} catalog...`,
    ko: (kind: string) => `${kind} 카탈로그 불러오는 중...`,
  },
  catalogLoadFailed: {
    en: (kind: string) => `${kind} catalog load failed`,
    ko: (kind: string) => `${kind} 카탈로그 로드 실패`,
  },
  backendCheck: {
    en: 'Check backend (http://localhost:8000), CORS, and D1 settings.',
    ko: '백엔드(http://localhost:8000), CORS, D1 설정을 확인하세요.',
  },
  retry: {
    en: 'Retry',
    ko: '재시도',
  },
  catalogSummary: {
    en: (kind: string, count: number, loadedAt?: string) =>
      `${kind} catalog: ${count} item${count === 1 ? '' : 's'}${loadedAt ? ` · updated ${loadedAt}` : ''}`,
    ko: (kind: string, count: number, loadedAt?: string) =>
      `${kind} 카탈로그: ${count}개${loadedAt ? ` · ${loadedAt} 갱신` : ''}`,
  },
  refreshCatalog: {
    en: 'Refresh catalog',
    ko: '카탈로그 다시 가져오기',
  },
  noCalls: {
    en: 'No calls yet. Click a card or banner.',
    ko: '아직 호출이 없습니다. 카드나 배너를 클릭해보세요.',
  },
  experiments: {
    en: 'Experiments',
    ko: '실험 현황',
  },
  experimentShowcaseTitle: {
    en: 'Experiment Showcase',
    ko: '실험 현황',
  },
  experimentShowcaseDescription: {
    en: 'See how flags are assigned to your user and send test events from here.',
    ko: '현재 사용자에게 배정된 실험 variant를 확인하고 이벤트를 직접 발생시켜보세요.',
  },
  sendTestEvent: {
    en: 'Send test event',
    ko: '테스트 이벤트 전송',
  },
  eventSent: {
    en: 'Event sent!',
    ko: '전송됨!',
  },
} as const

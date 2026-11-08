/** Describe known failures without exposing server details or other projects' data. */
export function flagCreateError(error: unknown, lang: 'ko' | 'en', fallback: string): string {
  const status = error instanceof Error && 'status' in error ? error.status : undefined;
  const messages: Record<number, [string, string]> = {
    401: ['로그인이 만료됐습니다. 다시 로그인한 뒤 생성하세요.', 'Your session expired. Sign in again before creating the flag.'],
    403: ['이 프로젝트에 플래그를 생성할 권한이 없습니다. 프로젝트와 접근 권한을 확인하세요.', 'You cannot create flags in this project. Check the project and your access.'],
    404: ['선택한 프로젝트에 접근할 수 없습니다. 소유한 프로젝트를 선택한 뒤 다시 시도하세요.', 'The selected project is unavailable. Select a project you own and try again.'],
    409: ['이미 사용 중인 Flag Key입니다. 다른 키를 입력하세요.', 'This flag key is already in use. Enter a different key.'],
    422: ['입력값을 확인하세요. Flag Key는 영문 소문자·숫자로 시작하는 3~64자이며, 하이픈(-)과 밑줄(_)을 사용할 수 있습니다.', 'Check your inputs. Flag keys must be 3–64 characters, start with a lowercase letter or number, and contain only lowercase letters, numbers, hyphens (-), or underscores (_).'],
    502: ['플래그 저장을 확인하지 못했습니다. 목록에서 생성 여부를 확인한 뒤 다시 시도하세요.', 'Flag storage could not be confirmed. Check the list before trying again.'],
  };
  return typeof status === 'number' ? messages[status]?.[lang === 'ko' ? 0 : 1] || fallback : fallback;
}

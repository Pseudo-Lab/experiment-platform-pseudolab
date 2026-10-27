export const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api/v1';

let sessionVersion = 0;
export function advanceSessionVersion() {
  sessionVersion += 1;
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const requestSessionVersion = sessionVersion;
  const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
  const apiBase = new URL(API_BASE_URL, window.location.href);
  const authPath = `${apiBase.pathname.replace(/\/$/, '')}/auth/`;
  const isAuthRequest = url.origin === apiBase.origin
    && ['login', 'logout', 'me'].some(action => url.pathname.replace(/\/$/, '') === authPath + action);
  const response = await fetch(input, {
    ...init,
    credentials: init.credentials ?? 'include',
  });
  // An older request must not expire a newly established session.
  if (response.status === 401 && !isAuthRequest && requestSessionVersion === sessionVersion) {
    window.dispatchEvent(new Event('auth:unauthorized'));
  }
  return response;
}

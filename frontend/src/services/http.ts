export const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api/v1';

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: init.credentials ?? 'include',
  });
}

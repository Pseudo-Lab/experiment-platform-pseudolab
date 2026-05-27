export const API_BASE_URL =
  ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) ||
  ((import.meta as any).env?.VITE_PLATFORM_API as string | undefined) ||
  '/api/v1'

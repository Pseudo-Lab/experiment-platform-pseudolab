import { API_BASE_URL, apiFetch } from './http';

export interface AuthUser {
  username: string;
}

export interface AuthStatus {
  authenticated: boolean;
  user: AuthUser | null;
}

export const authApi = {
  me: async (): Promise<AuthStatus> => {
    const response = await apiFetch(`${API_BASE_URL}/auth/me`);
    if (!response.ok) return { authenticated: false, user: null };
    return response.json();
  },

  login: async (username: string, password: string): Promise<AuthStatus> => {
    const response = await apiFetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      throw new Error(response.status === 401 ? 'invalid_credentials' : 'login_failed');
    }
    return response.json();
  },

  logout: async (): Promise<void> => {
    await apiFetch(`${API_BASE_URL}/auth/logout`, { method: 'POST' });
  },
};

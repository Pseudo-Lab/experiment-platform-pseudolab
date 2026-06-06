import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, type AuthUser } from '@/services/authApi';

type AuthState = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  state: AuthState;
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    authApi.me()
      .then((status) => {
        if (cancelled) return;
        setUser(status.user);
        setState(status.authenticated ? 'authenticated' : 'anonymous');
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setState('anonymous');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    state,
    user,
    login: async (username: string, password: string) => {
      const status = await authApi.login(username, password);
      setUser(status.user);
      setState(status.authenticated ? 'authenticated' : 'anonymous');
    },
    logout: async () => {
      await authApi.logout();
      setUser(null);
      setState('anonymous');
    },
  }), [state, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authApi, type AuthUser } from '@/services/authApi';
import { advanceSessionVersion } from '@/services/http';

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

  const revision = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const restoreRevision = revision.current;
    const expireSession = () => {
      revision.current += 1;
      advanceSessionVersion();
      setUser(null);
      setState('anonymous');
    };
    window.addEventListener('auth:unauthorized', expireSession);
    authApi.me()
      .then((status) => {
        if (cancelled || revision.current !== restoreRevision) return;
        setUser(status.user);
        setState(status.authenticated ? 'authenticated' : 'anonymous');
      })
      .catch(() => {
        if (cancelled || revision.current !== restoreRevision) return;
        setUser(null);
        setState('anonymous');
      });
    return () => {
      cancelled = true;
      window.removeEventListener('auth:unauthorized', expireSession);
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    state,
    user,
    login: async (username: string, password: string) => {
      const status = await authApi.login(username, password);
      revision.current += 1;
      advanceSessionVersion();
      setUser(status.user);
      setState(status.authenticated ? 'authenticated' : 'anonymous');
    },
    logout: async () => {
      await authApi.logout();
      revision.current += 1;
      advanceSessionVersion();
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

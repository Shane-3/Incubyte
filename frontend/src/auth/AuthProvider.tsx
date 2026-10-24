import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { User } from '../api/types';
import { useApi } from '../app/ApiContext';

/** Dispatched on window by the API client when any request comes back 401. */
export const SESSION_EXPIRED_EVENT = 'forecourt:session-expired';

type Status = 'restoring' | 'signedIn' | 'signedOut';

interface AuthState {
  status: Status;
  user: User | null;
  /** One-off message for the sign-in page, such as an expired session. */
  notice: string | null;
  login(email: string, password: string): Promise<void>;
  register(name: string, email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Holds only the public user. The session token is an httpOnly cookie that JavaScript never sees. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>('restoring');
  const [user, setUser] = useState<User | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.auth
      .me()
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setStatus('signedIn');
      })
      .catch(() => {
        if (!cancelled) setStatus('signedOut');
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const signOutLocally = useCallback(() => {
    setUser(null);
    setStatus('signedOut');
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    const onExpired = () => {
      signOutLocally();
      setNotice('Your session expired. Sign in again.');
      navigate('/login', { replace: true });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [navigate, signOutLocally]);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      notice,
      async login(email, password) {
        const me = await api.auth.login(email, password);
        setNotice(null);
        setUser(me);
        setStatus('signedIn');
      },
      async register(name, email, password) {
        await api.auth.register(name, email, password);
        const me = await api.auth.login(email, password);
        setNotice(null);
        setUser(me);
        setStatus('signedIn');
      },
      async logout() {
        await api.auth.logout().catch(() => undefined);
        signOutLocally();
        navigate('/login', { replace: true });
      },
    }),
    [api, navigate, notice, signOutLocally, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside AuthProvider');
  return auth;
}

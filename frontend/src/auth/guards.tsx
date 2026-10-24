import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from './AuthProvider';

/** Blank page while the session is restored, so neither screen flashes before we know. */
function Restoring() {
  return <div className="min-h-dvh bg-page" aria-busy="true" />;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'restoring') return <Restoring />;
  if (status === 'signedOut') return <Navigate to="/login" replace />;
  return children;
}

export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'restoring') return <Restoring />;
  if (status === 'signedIn') return <Navigate to="/" replace />;
  return children;
}

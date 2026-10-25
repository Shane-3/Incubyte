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

/**
 * Admin pages. Others go back to the inventory before the page mounts, so it never requests admin data. The API
 * enforces the role regardless; this only keeps the UI honest.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  if (status === 'restoring') return <Restoring />;
  if (status === 'signedOut') return <Navigate to="/login" replace />;
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'restoring') return <Restoring />;
  if (status === 'signedIn') return <Navigate to="/" replace />;
  return children;
}

import type { ReactNode } from 'react';
import { Wordmark } from '../components/Wordmark';

/** A single quiet, centred form on the page background (design.md 6.3). */
export function AuthLayout({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-page px-4 py-12">
      <div className="w-full max-w-[360px]">
        <Wordmark className="mb-8 text-lg" />
        <div className="rounded-panel border border-border bg-surface p-6">
          <h1 className="mb-5 text-xl font-semibold">{title}</h1>
          {children}
        </div>
        <p className="mt-4 text-center text-sm text-muted">{footer}</p>
      </div>
    </main>
  );
}

export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mb-4 rounded-control border border-out/40 bg-out/5 px-3 py-2 text-sm text-text">
      {message}
    </p>
  );
}

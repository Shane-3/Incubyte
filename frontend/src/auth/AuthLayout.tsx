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
        {footer && <p className="mt-4 text-center text-sm text-muted">{footer}</p>}
      </div>
    </main>
  );
}
